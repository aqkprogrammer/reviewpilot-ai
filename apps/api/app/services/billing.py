"""Subscription state machine. The ONLY code path that activates, renews, fails or cancels
paid subscriptions — invoked exclusively with signature-verified webhook events."""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import now
from app.models import Invoice, Organization, Payment, Subscription, SubscriptionPlan, WebhookEvent
from app.models.enums import PaymentStatus, SubscriptionStatus
from app.providers.payments import NormalizedEvent
from app.services import audit, gst
from app.services.notify import notify_org

log = logging.getLogger("reviewpilot.billing")


async def record_event(db: AsyncSession, evt: NormalizedEvent) -> tuple[WebhookEvent, bool]:
    """Store the verified event. Returns (row, is_new) — duplicates are acknowledged but not re-applied."""
    existing = await db.scalar(select(WebhookEvent).where(WebhookEvent.provider == evt.provider, WebhookEvent.event_id == evt.event_id))
    if existing:
        return existing, existing.processed_at is None
    row = WebhookEvent(provider=evt.provider, event_id=evt.event_id, event_type=evt.type, signature_valid=True, payload=_safe(evt.raw))
    db.add(row)
    await db.flush()
    return row, True


def _safe(raw: dict) -> dict:
    # Drop card / bank details if a provider includes them.
    blocked = {"card", "bank", "vpa", "wallet", "payment_method_details"}

    def scrub(v):
        if isinstance(v, dict):
            return {k: ("[redacted]" if k in blocked else scrub(x)) for k, x in v.items()}
        if isinstance(v, list):
            return [scrub(x) for x in v]
        return v

    return scrub(raw)


async def _find_subscription(db: AsyncSession, evt: NormalizedEvent) -> Subscription | None:
    if evt.organization_id:
        try:
            return await db.scalar(select(Subscription).where(Subscription.organization_id == uuid.UUID(evt.organization_id)))
        except ValueError:
            return None
    if evt.provider_subscription_id:
        return await db.scalar(select(Subscription).where(Subscription.provider_subscription_id == evt.provider_subscription_id))
    return None


async def _next_invoice_number(db: AsyncSession) -> str:
    n = await db.scalar(select(func.count()).select_from(Invoice))
    return f"RP-{now():%Y%m}-{(n or 0) + 1:05d}"


async def apply_event(db: AsyncSession, evt: NormalizedEvent) -> str:
    if evt.type == "ignored":
        return "ignored"
    sub = await _find_subscription(db, evt)
    if sub is None:
        log.warning("Webhook %s/%s: subscription not found", evt.provider, evt.event_id)
        return "subscription_not_found"
    org = await db.get(Organization, sub.organization_id)
    if evt.provider_plan_ref:
        # Provider-side plan ids win over metadata (Razorpay keeps old notes after a plan change).
        for candidate in (await db.scalars(select(SubscriptionPlan))).all():
            refs = candidate.provider_refs or {}
            for interval in ("monthly", "yearly"):
                if refs.get(f"{evt.provider}_{interval}") == evt.provider_plan_ref:
                    evt.plan_code, evt.interval = candidate.code, interval
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == evt.plan_code)) if evt.plan_code else None

    if evt.type == "subscription.activated":
        if plan:
            sub.plan_id = plan.id
        sub.interval = evt.interval or sub.interval
        sub.provider = evt.provider
        sub.provider_subscription_id = evt.provider_subscription_id or sub.provider_subscription_id
        sub.provider_customer_id = evt.provider_customer_id or sub.provider_customer_id
        sub.status = SubscriptionStatus.ACTIVE
        sub.trial_ends_at = None
        sub.grace_period_ends_at = None
        sub.cancel_at_period_end = False
        sub.pending_plan_id = None
        sub.pending_checkout = {}
        sub.current_period_start = evt.period_start or now()
        sub.current_period_end = evt.period_end or (now() + timedelta(days=365 if sub.interval == "yearly" else 30))
        await audit.record(db, "billing.subscription_activated", organization_id=sub.organization_id, target_type="subscription", target_id=sub.id, meta={"provider": evt.provider, "plan": evt.plan_code}, actor_type="system")
        return "activated"

    if evt.type == "payment.succeeded":
        existing = await db.scalar(select(Payment).where(Payment.provider == evt.provider, Payment.provider_payment_id == (evt.provider_payment_id or evt.event_id)))
        if existing is None:
            pay = Payment(
                organization_id=sub.organization_id, subscription_id=sub.id, provider=evt.provider, provider_payment_id=evt.provider_payment_id or evt.event_id,
                amount_minor=evt.amount_minor or 0, currency=evt.currency or "INR", status=PaymentStatus.SUCCEEDED, paid_at=now(), plan_code=evt.plan_code, raw=_safe(evt.raw),
            )
            db.add(pay)
            await db.flush()
            billing = ((org.settings or {}).get("billing") or {}) if org else {}
            split = gst.tax_split(evt.amount_minor or 0, billing.get("state_code"))
            db.add(Invoice(
                organization_id=sub.organization_id, payment_id=pay.id, number=await _next_invoice_number(db), amount_minor=evt.amount_minor or 0, tax_minor=split["tax_minor"],
                currency=evt.currency or "INR", status="paid", period_start=evt.period_start, period_end=evt.period_end,
                line_items=[{
                    "description": f"ReviewPilot AI — {evt.plan_code or 'subscription'} ({evt.interval or sub.interval})", "amount_minor": split["taxable_minor"],
                    "sac": settings.invoice_sac_code, "taxes": split["lines"],
                }],
                billing_details={
                    # Snapshot at issue time: later edits never alter an issued invoice.
                    "name": billing.get("legal_name") or (org.name if org else ""), "email": billing.get("email") or (org.email if org else ""),
                    "gstin": billing.get("gstin"), "address": ", ".join(p for p in [billing.get("address_line"), billing.get("city"), billing.get("postal_code")] if p) or None,
                    "state": gst.STATES.get(billing.get("state_code") or ""), "state_code": billing.get("state_code"), "country": org.country if org else "",
                    "place_of_supply": split["place_of_supply"],
                    "seller": {"name": settings.company_legal_name, "gstin": settings.company_gstin, "address": settings.company_address, "state_code": settings.company_state_code},
                },
            ))
        if plan:
            sub.plan_id = plan.id
            if sub.pending_plan_id == plan.id:
                sub.pending_plan_id = None  # scheduled change took effect at renewal
                sub.pending_interval = None
        if evt.interval:
            sub.interval = evt.interval
        sub.status = SubscriptionStatus.ACTIVE
        sub.provider = evt.provider
        sub.provider_subscription_id = evt.provider_subscription_id or sub.provider_subscription_id
        sub.grace_period_ends_at = None
        sub.trial_ends_at = None
        if evt.period_start:
            sub.current_period_start = evt.period_start
        if evt.period_end:
            sub.current_period_end = evt.period_end
        await notify_org(db, sub.organization_id, "billing.payment_succeeded", "Payment received", f"Thank you — your {evt.plan_code or ''} subscription payment was successful.", link="/app/subscription", send_email=True)
        return "payment_recorded"

    if evt.type == "payment.failed":
        pid = evt.provider_payment_id or evt.event_id
        if not await db.scalar(select(Payment).where(Payment.provider == evt.provider, Payment.provider_payment_id == pid)):
            db.add(Payment(organization_id=sub.organization_id, subscription_id=sub.id, provider=evt.provider, provider_payment_id=pid, amount_minor=evt.amount_minor or 0, currency=evt.currency or "INR", status=PaymentStatus.FAILED, failure_reason=evt.failure_reason, plan_code=evt.plan_code, raw=_safe(evt.raw)))
        current_plan = await db.get(SubscriptionPlan, sub.plan_id)
        pending_plan = await db.get(SubscriptionPlan, sub.pending_plan_id) if sub.pending_plan_id else None
        is_scheduled_renewal = bool(pending_plan and evt.plan_code == pending_plan.code)
        is_plan_change = bool(evt.plan_code and current_plan and evt.plan_code != current_plan.code and not is_scheduled_renewal)
        # Only a failed charge for the plan the customer is already on (a renewal) puts the
        # subscription at risk. A declined upgrade/downgrade checkout, or a declined first
        # checkout during a trial, leaves the current subscription untouched.
        if sub.status == SubscriptionStatus.TRIALING or (is_plan_change and sub.status == SubscriptionStatus.ACTIVE):
            await notify_org(db, sub.organization_id, "billing.payment_failed", "Plan change payment failed", "We couldn't process the payment for your plan change. Your current plan is unaffected — you can try again from Subscription.", link="/app/subscription", send_email=True)
            return "plan_change_failed"
        if sub.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE):
            sub.status = SubscriptionStatus.GRACE_PERIOD
            sub.grace_period_ends_at = sub.grace_period_ends_at or (now() + timedelta(days=settings.grace_period_days))
        await notify_org(db, sub.organization_id, "billing.payment_failed", "Payment failed", f"We couldn't process your payment. Update your payment method within {settings.grace_period_days} days to avoid interruption.", link="/app/subscription", send_email=True)
        return "payment_failed"

    if evt.type == "subscription.updated":
        if evt.cancel_at_period_end is not None:
            sub.cancel_at_period_end = evt.cancel_at_period_end
        if evt.period_end:
            sub.current_period_end = evt.period_end
        return "updated"

    if evt.type == "subscription.canceled":
        sub.status = SubscriptionStatus.CANCELED
        sub.canceled_at = now()
        sub.cancel_at_period_end = False
        await audit.record(db, "billing.subscription_canceled", organization_id=sub.organization_id, target_type="subscription", target_id=sub.id, meta={"provider": evt.provider}, actor_type="system")
        return "canceled"
    return "unhandled"


async def run_maintenance(db: AsyncSession) -> dict:
    """Daily: expire ended trials and lapsed grace periods; apply scheduled downgrades."""
    expired_trials = (await db.scalars(select(Subscription).where(Subscription.status == SubscriptionStatus.TRIALING, Subscription.trial_ends_at < now()))).all()
    for s in expired_trials:
        s.status = SubscriptionStatus.EXPIRED
    lapsed = (await db.scalars(select(Subscription).where(Subscription.status == SubscriptionStatus.GRACE_PERIOD, Subscription.grace_period_ends_at < now()))).all()
    for s in lapsed:
        s.status = SubscriptionStatus.EXPIRED
    await db.commit()
    applied = await _apply_due_mock_changes(db) if settings.demo_mode else 0
    return {"expired_trials": len(expired_trials), "lapsed_grace": len(lapsed), "mock_changes_applied": applied}


async def _apply_due_mock_changes(db: AsyncSession) -> int:
    """Demo mode only: the mock provider has no real renewal, so emit a signed renewal event
    for scheduled changes whose period has ended — processed through the normal pipeline."""
    import json

    from app.providers.payments import MockPaymentProvider

    due = (
        await db.scalars(
            select(Subscription).where(Subscription.provider == "mock", Subscription.pending_plan_id.is_not(None), Subscription.current_period_end < now())
        )
    ).all()
    provider = MockPaymentProvider()
    for sub in due:
        plan = await db.get(SubscriptionPlan, sub.pending_plan_id)
        interval = sub.pending_interval or sub.interval
        body = json.dumps({
            "id": f"evt_mock_renewal_{uuid.uuid4().hex[:16]}", "type": "payment.succeeded", "organization_id": str(sub.organization_id),
            "plan_code": plan.code, "interval": interval, "subscription_id": sub.provider_subscription_id, "payment_id": f"pay_mock_{uuid.uuid4().hex[:12]}",
            "amount_minor": plan.price_yearly_minor if interval == "yearly" else plan.price_monthly_minor, "currency": plan.currency,
            "period_start": now().isoformat(), "period_end": (now() + timedelta(days=365 if interval == "yearly" else 30)).isoformat(),
        }).encode()
        evt = provider.parse_webhook(body, {"x-mock-signature": provider.sign(body)})
        row, is_new = await record_event(db, evt)
        if is_new:
            await apply_event(db, evt)
            row.processed_at = now()
    await db.commit()
    return len(due)
