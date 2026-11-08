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
from app.services import audit
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
            tax = round((evt.amount_minor or 0) * 18 / 118)  # GST-inclusive pricing (18%)
            db.add(Invoice(
                organization_id=sub.organization_id, payment_id=pay.id, number=await _next_invoice_number(db), amount_minor=evt.amount_minor or 0, tax_minor=tax,
                currency=evt.currency or "INR", status="paid", period_start=evt.period_start, period_end=evt.period_end,
                line_items=[{"description": f"ReviewPilot AI — {evt.plan_code or 'subscription'} ({evt.interval or sub.interval})", "amount_minor": (evt.amount_minor or 0) - tax}],
                billing_details={"name": org.name if org else "", "email": org.email if org else "", "country": org.country if org else ""},
            ))
        if plan:
            sub.plan_id = plan.id
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
        if sub.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING):
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
    return {"expired_trials": len(expired_trials), "lapsed_grace": len(lapsed)}
