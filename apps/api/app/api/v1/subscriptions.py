from __future__ import annotations

import io
import json
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.errors import AppError, NotFound
from app.core.permissions import Perm
from app.core.security import now
from app.models import AIUsage, Invoice, Location, OrganizationMember, Payment, SubscriptionPlan
from app.models.enums import SubscriptionStatus
from app.providers.payments import MockPaymentProvider, get_provider, provider_by_name
from app.services import audit
from app.services.billing import apply_event, record_event
from app.services.organizations import get_subscription_with_plan

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
Billing = Depends(require_perm(Perm.BILLING_MANAGE))


def plan_out(p: SubscriptionPlan) -> dict:
    return {
        "id": str(p.id), "code": p.code, "name": p.name, "description": p.description, "currency": p.currency,
        "price_monthly_minor": p.price_monthly_minor, "price_yearly_minor": p.price_yearly_minor, "max_locations": p.max_locations,
        "max_team_members": p.max_team_members, "max_organizations": p.max_organizations, "ai_requests_per_month": p.ai_requests_per_month,
        "monthly_message_quota": p.monthly_message_quota, "features": p.features, "entitlements": p.entitlements, "is_popular": p.is_popular,
        "is_custom_pricing": p.is_custom_pricing,
    }


@router.get("/plans")
async def plans(db: DB):
    """Public. Pricing is configured by Super Admins (no hard-coded prices in the clients)."""
    rows = (await db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True)).order_by(SubscriptionPlan.sort_order))).all()
    return [plan_out(p) for p in rows]


@router.get("/current")
async def current(ctx: Org, db: DB):
    sub, plan = await get_subscription_with_plan(db, ctx.org_id)
    locations = await db.scalar(select(func.count()).select_from(Location).where(Location.organization_id == ctx.org_id, Location.deleted_at.is_(None)))
    members = await db.scalar(select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == ctx.org_id))
    ai = await db.scalar(select(AIUsage.requests).where(AIUsage.organization_id == ctx.org_id, AIUsage.period == now().strftime("%Y-%m")))
    pending_plan = await db.get(SubscriptionPlan, sub.pending_plan_id) if sub and sub.pending_plan_id else None
    return {
        "subscription": None if sub is None else {
            "id": str(sub.id), "status": sub.status, "interval": sub.interval, "provider": sub.provider, "trial_ends_at": sub.trial_ends_at,
            "current_period_start": sub.current_period_start, "current_period_end": sub.current_period_end, "grace_period_ends_at": sub.grace_period_ends_at,
            "cancel_at_period_end": sub.cancel_at_period_end, "canceled_at": sub.canceled_at, "pending_plan": plan_out(pending_plan) if pending_plan else None,
            "pending_checkout": sub.pending_checkout or None,
        },
        "plan": plan_out(plan) if plan else None,
        "usage": {"locations": locations or 0, "team_members": members or 0, "ai_requests": ai or 0},
        "providers": {"razorpay": settings.razorpay_configured, "stripe": settings.stripe_configured, "mock": settings.demo_mode, "default": settings.default_payment_provider},
        "can_manage": ctx.can(Perm.BILLING_MANAGE),
    }


class CheckoutIn(BaseModel):
    plan_code: str
    interval: str = Field("monthly", pattern="^(monthly|yearly)$")
    provider: str | None = Field(None, pattern="^(razorpay|stripe|mock)$")


@router.post("/checkout")
async def checkout(data: CheckoutIn, request: Request, db: DB, ctx: OrgContext = Billing):
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == data.plan_code, SubscriptionPlan.is_active.is_(True)))
    if plan is None:
        raise NotFound("Plan not found")
    if plan.is_custom_pricing:
        raise AppError("Enterprise pricing is custom — contact sales.", code="contact_sales")
    sub, current_plan = await get_subscription_with_plan(db, ctx.org_id)
    locations = await db.scalar(select(func.count()).select_from(Location).where(Location.organization_id == ctx.org_id, Location.deleted_at.is_(None)))
    if (locations or 0) > plan.max_locations:
        raise AppError(f"You have {locations} locations; the {plan.name} plan allows {plan.max_locations}. Remove locations before downgrading.", code="downgrade_blocked")
    provider = get_provider(data.provider)
    session = await provider.create_checkout(org_id=str(ctx.org_id), org_name=ctx.organization.name, email=ctx.user.email, plan=plan, interval=data.interval)
    if sub is not None:
        sub.pending_plan_id = plan.id
        sub.pending_interval = data.interval
        sub.pending_checkout = {"provider": session.provider, "reference": session.reference, "created_at": now().isoformat(), "plan_code": plan.code, "interval": data.interval}
    await audit.record(db, "billing.checkout_started", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"plan": plan.code, "interval": data.interval, "provider": session.provider})
    await db.commit()  # also persists any provider plan ids created on the fly
    return {"provider": session.provider, "checkout_url": session.checkout_url, "reference": session.reference, **session.extra}


@router.post("/cancel")
async def cancel(request: Request, db: DB, ctx: OrgContext = Billing):
    sub, _ = await get_subscription_with_plan(db, ctx.org_id)
    if sub is None:
        raise NotFound("No subscription")
    if sub.status == SubscriptionStatus.TRIALING and not sub.provider_subscription_id:
        # No paid subscription exists at any provider — ending a free trial is a local action.
        sub.status = SubscriptionStatus.CANCELED
        sub.canceled_at = now()
    elif sub.provider and sub.provider_subscription_id:
        await provider_by_name(sub.provider).cancel(sub.provider_subscription_id, at_period_end=True)
        # Intent only; the provider's webhook confirms the change.
        sub.cancel_at_period_end = True
        if sub.provider == "mock":
            await _simulate(db, ctx, "subscription.canceled", sub.provider_subscription_id)
    else:
        raise AppError("Nothing to cancel.", code="invalid_state")
    await audit.record(db, "billing.cancel_requested", actor=ctx.user, organization_id=ctx.org_id, request=request)
    await db.commit()
    return await current(ctx, db)


@router.get("/payments")
async def payments(db: DB, ctx: OrgContext = Billing):
    rows = (await db.scalars(select(Payment).where(Payment.organization_id == ctx.org_id).order_by(Payment.created_at.desc()).limit(100))).all()
    inv = {i.payment_id: i for i in (await db.scalars(select(Invoice).where(Invoice.organization_id == ctx.org_id))).all()}
    return [
        {"id": str(p.id), "provider": p.provider, "amount_minor": p.amount_minor, "currency": p.currency, "status": p.status, "failure_reason": p.failure_reason, "plan_code": p.plan_code,
         "paid_at": p.paid_at, "created_at": p.created_at, "invoice_id": str(inv[p.id].id) if p.id in inv else None, "invoice_number": inv[p.id].number if p.id in inv else None, "simulated": p.provider == "mock"}
        for p in rows
    ]


@router.get("/invoices/{invoice_id}.pdf")
async def invoice_pdf(invoice_id: uuid.UUID, db: DB, ctx: OrgContext = Billing):
    inv = await db.get(Invoice, invoice_id)
    if inv is None or inv.organization_id != ctx.org_id:
        raise NotFound("Invoice not found")
    pay = await db.get(Payment, inv.payment_id) if inv.payment_id else None
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFillColor(HexColor("#0e9aa7"))
    c.rect(0, h - 8, w, 8, stroke=0, fill=1)
    c.setFillColor(HexColor("#0b1218"))
    c.setFont("Helvetica-Bold", 22)
    c.drawString(40, h - 64, "Tax Invoice" if not (pay and pay.provider == "mock") else "Invoice (SIMULATED — demo mode)")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 84, f"Invoice {inv.number}   ·   {inv.created_at:%d %b %Y}")
    c.drawString(40, h - 120, "Billed to")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, h - 136, inv.billing_details.get("name", ""))
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 150, inv.billing_details.get("email", ""))
    c.drawString(360, h - 120, "From")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(360, h - 136, "ReviewPilot AI")
    y = h - 200
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y, "DESCRIPTION")
    c.drawRightString(w - 40, y, "AMOUNT")
    c.setFont("Helvetica", 10)
    sym = "₹" if inv.currency == "INR" else inv.currency + " "
    for item in inv.line_items:
        y -= 20
        c.drawString(40, y, item["description"])
        c.drawRightString(w - 40, y, f"{inv.currency} {item['amount_minor'] / 100:,.2f}")
    y -= 24
    c.drawString(360, y, "GST (18%, included)")
    c.drawRightString(w - 40, y, f"{inv.currency} {inv.tax_minor / 100:,.2f}")
    y -= 20
    c.setFont("Helvetica-Bold", 12)
    c.drawString(360, y, "Total")
    c.drawRightString(w - 40, y, f"{inv.currency} {inv.amount_minor / 100:,.2f}")
    c.setFont("Helvetica", 8)
    c.drawString(40, 40, f"Paid via {pay.provider if pay else '—'} · Reference {pay.provider_payment_id if pay else '—'}")
    _ = sym
    c.showPage()
    c.save()
    return Response(buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{inv.number}.pdf"'})


# ------------------------------------------------------------------ demo-only simulated checkout

class SimulateIn(BaseModel):
    session: str = Field(min_length=8, max_length=64)
    outcome: str = Field(pattern="^(success|failure)$")


async def _simulate(db, ctx: OrgContext, type_: str, subscription_id: str, plan_code: str | None = None, interval: str | None = None, amount: int | None = None, failure: str | None = None) -> str:
    """Builds a signed mock webhook and runs it through the standard verification pipeline."""
    payload = {
        "id": f"evt_mock_{uuid.uuid4().hex[:16]}", "type": type_, "organization_id": str(ctx.org_id), "plan_code": plan_code, "interval": interval,
        "subscription_id": subscription_id, "payment_id": f"pay_mock_{uuid.uuid4().hex[:12]}", "amount_minor": amount, "currency": "INR",
        "period_start": now().isoformat(), "period_end": (now() + timedelta(days=365 if interval == "yearly" else 30)).isoformat(), "failure_reason": failure,
    }
    body = json.dumps(payload).encode()
    provider = MockPaymentProvider()
    evt = provider.parse_webhook(body, {"x-mock-signature": provider.sign(body)})
    row, is_new = await record_event(db, evt)
    result = await apply_event(db, evt) if is_new else "duplicate"
    row.processed_at = now()
    return result


@router.post("/mock-checkout/complete")
async def mock_complete(data: SimulateIn, request: Request, db: DB, ctx: OrgContext = Billing):
    if not settings.demo_mode:
        raise NotFound("Not available")
    sub, _ = await get_subscription_with_plan(db, ctx.org_id)
    pc = (sub.pending_checkout if sub else {}) or {}
    if not sub or pc.get("reference") != data.session or pc.get("provider") != "mock":
        raise AppError("Checkout session not found or expired.", code="invalid_session")
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == pc["plan_code"]))
    amount = plan.price_yearly_minor if pc["interval"] == "yearly" else plan.price_monthly_minor
    if data.outcome == "success":
        await _simulate(db, ctx, "subscription.activated", data.session, pc["plan_code"], pc["interval"])
        result = await _simulate(db, ctx, "payment.succeeded", data.session, pc["plan_code"], pc["interval"], amount)
    else:
        result = await _simulate(db, ctx, "payment.failed", data.session, pc["plan_code"], pc["interval"], amount, "Card declined (simulated)")
    await audit.record(db, "billing.mock_checkout", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"outcome": data.outcome})
    await db.commit()
    return {"result": result}
