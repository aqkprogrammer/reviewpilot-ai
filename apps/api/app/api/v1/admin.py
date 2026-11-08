"""Super Admin API. Every route requires platform_super_admin (router-level dependency).

Least privilege: admins see organisation metadata and counts — never review text or customer
PII — unless the organisation granted time-boxed data access on a support ticket. Every
mutating action and every customer-data access is written to the append-only audit log.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, or_, select, update

from app.core.config import settings
from app.core.deps import DB, SuperAdmin, require_super_admin
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.security import now
from app.models import (
    AIGeneration,
    AIUsage,
    Announcement,
    AuditLog,
    AuthSession,
    BackgroundJob,
    Campaign,
    Customer,
    ErrorEvent,
    FeatureFlag,
    FeedbackSubmission,
    GoogleConnection,
    IntegrationCredential,
    Location,
    Organization,
    OrganizationMember,
    Payment,
    QRCode,
    Review,
    ReviewRequest,
    Subscription,
    SubscriptionPlan,
    SupportMessage,
    SupportTicket,
    SystemSetting,
    User,
)
from app.models.enums import JobStatus, OrgStatus, PaymentStatus, RequestStatus, SubscriptionStatus, UserStatus
from app.schemas.common import Page
from app.services import audit
from app.services.system_health import health_snapshot

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_super_admin)])

PAID = (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD)


def _iso(v: datetime | None) -> str | None:
    return v.isoformat() if v else None


def _page(items: list, total: int, page: int, page_size: int) -> dict:
    return Page.build(items, total, page, page_size).model_dump()


def _monthly_minor(plan: SubscriptionPlan, interval: str) -> int:
    return round(plan.price_yearly_minor / 12) if interval == "yearly" else plan.price_monthly_minor


async def _mrr(db) -> tuple[int, dict[str, int]]:
    rows = (
        await db.execute(
            select(Subscription.interval, SubscriptionPlan)
            .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .where(Subscription.status.in_(PAID))
        )
    ).all()
    total, by_plan = 0, {}
    for interval, plan in rows:
        m = _monthly_minor(plan, interval)
        total += m
        by_plan[plan.code] = by_plan.get(plan.code, 0) + m
    return total, by_plan


def _month_starts(n: int) -> list[datetime]:
    first = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    out = []
    for i in range(n - 1, -1, -1):
        y, m = first.year, first.month - i
        while m <= 0:
            m += 12
            y -= 1
        out.append(first.replace(year=y, month=m))
    return out


# ================================================================== overview

@router.get("/overview")
async def overview(db: DB):
    day_ago = now() - timedelta(days=1)
    mrr, _ = await _mrr(db)
    reviews_by_source = dict((await db.execute(select(Review.source, func.count()).group_by(Review.source))).all())
    sub_counts = dict((await db.execute(select(Subscription.status, func.count()).group_by(Subscription.status))).all())
    totals = {
        "users": await db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None))),
        "organizations": await db.scalar(select(func.count()).select_from(Organization).where(Organization.deleted_at.is_(None))),
        "active_organizations": await db.scalar(
            select(func.count()).select_from(Organization).join(Subscription, Subscription.organization_id == Organization.id).where(
                Organization.deleted_at.is_(None), Organization.status == OrgStatus.ACTIVE, Subscription.status.in_((*PAID, SubscriptionStatus.TRIALING))
            )
        ),
        "trial_accounts": sub_counts.get(SubscriptionStatus.TRIALING, 0),
        "paid_subscriptions": sum(sub_counts.get(s, 0) for s in PAID),
        "mrr_minor": mrr,
        "arr_minor": mrr * 12,
        "reviews_google": reviews_by_source.get("google", 0),
        "reviews_demo": reviews_by_source.get("demo", 0),
        "campaigns_sent": await db.scalar(select(func.count()).select_from(ReviewRequest).where(ReviewRequest.sent_at.is_not(None))),
        "ai_requests": await db.scalar(select(func.coalesce(func.sum(AIUsage.requests), 0))),
        "failed_jobs_24h": await db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status == JobStatus.FAILED, BackgroundJob.created_at > day_ago)),
    }

    week = func.date_trunc("week", User.created_at)
    regs = (await db.execute(select(week, func.count()).where(User.created_at > now() - timedelta(weeks=12)).group_by(week).order_by(week))).all()
    months = _month_starts(12)
    org_growth, sub_growth, revenue, churn = [], [], [], []
    for m in months:
        nxt = (m + timedelta(days=32)).replace(day=1)
        org_growth.append({"month": m.strftime("%Y-%m"), "organizations": await db.scalar(select(func.count()).select_from(Organization).where(Organization.created_at < nxt, Organization.deleted_at.is_(None)))})
        sub_growth.append({"month": m.strftime("%Y-%m"), "subscriptions": await db.scalar(select(func.count()).select_from(Subscription).where(Subscription.created_at < nxt))})
        revenue.append({
            "month": m.strftime("%Y-%m"),
            "revenue_minor": await db.scalar(select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(Payment.status == PaymentStatus.SUCCEEDED, Payment.created_at >= m, Payment.created_at < nxt)),
        })
        churn.append({
            "month": m.strftime("%Y-%m"),
            "churned": await db.scalar(
                select(func.count()).select_from(Subscription).where(
                    Subscription.status.in_((SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED)),
                    func.coalesce(Subscription.canceled_at, Subscription.updated_at) >= m,
                    func.coalesce(Subscription.canceled_at, Subscription.updated_at) < nxt,
                )
            ),
        })
    plan_dist = (
        await db.execute(select(SubscriptionPlan.code, SubscriptionPlan.name, func.count(Subscription.id)).outerjoin(Subscription, Subscription.plan_id == SubscriptionPlan.id).group_by(SubscriptionPlan.id).order_by(SubscriptionPlan.sort_order))
    ).all()
    return {
        "totals": totals,
        "registrations": [{"week": d.date().isoformat(), "users": n} for d, n in regs],
        "organization_growth": org_growth,
        "subscription_growth": sub_growth,
        "monthly_revenue": revenue,
        "plan_distribution": [{"code": c, "name": n, "count": k} for c, n, k in plan_dist],
        "churn": churn,
        "subscription_status": sub_counts,
        "demo_mode": settings.demo_mode,
    }


# ================================================================== organizations

class ReasonIn(BaseModel):
    reason: str = Field(min_length=4, max_length=500)


@router.get("/organizations")
async def list_orgs(
    db: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), q: str | None = None,
    status: str | None = None, plan: str | None = None, subscription_status: str | None = None,
):
    base = (
        select(Organization, Subscription, SubscriptionPlan)
        .outerjoin(Subscription, Subscription.organization_id == Organization.id)
        .outerjoin(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
        .where(Organization.deleted_at.is_(None))
    )
    if q:
        base = base.where(or_(Organization.name.ilike(f"%{q}%"), Organization.slug.ilike(f"%{q}%"), Organization.email.ilike(f"%{q}%")))
    if status:
        base = base.where(Organization.status == status)
    if plan:
        base = base.where(SubscriptionPlan.code == plan)
    if subscription_status:
        base = base.where(Subscription.status == subscription_status)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(Organization.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    ids = [o.id for o, _, _ in rows]
    members = dict((await db.execute(select(OrganizationMember.organization_id, func.count()).where(OrganizationMember.organization_id.in_(ids)).group_by(OrganizationMember.organization_id))).all()) if ids else {}
    locs = dict((await db.execute(select(Location.organization_id, func.count()).where(Location.organization_id.in_(ids), Location.deleted_at.is_(None)).group_by(Location.organization_id))).all()) if ids else {}
    reviews = dict((await db.execute(select(Review.organization_id, func.count()).where(Review.organization_id.in_(ids)).group_by(Review.organization_id))).all()) if ids else {}
    items = [
        {
            "id": str(o.id), "name": o.name, "slug": o.slug, "industry": o.industry, "country": o.country, "status": o.status, "is_demo": o.is_demo,
            "created_at": _iso(o.created_at), "plan_code": p.code if p else None, "plan_name": p.name if p else None,
            "subscription_status": s.status if s else None, "members": members.get(o.id, 0), "locations": locs.get(o.id, 0), "reviews": reviews.get(o.id, 0),
            "mrr_minor": _monthly_minor(p, s.interval) if (p and s and s.status in PAID) else 0,
        }
        for o, s, p in rows
    ]
    return _page(items, total or 0, page, page_size)


async def _org(db, org_id: uuid.UUID) -> Organization:
    org = await db.get(Organization, org_id)
    if org is None or org.deleted_at is not None:
        raise NotFound("Organization not found")
    return org


@router.get("/organizations/{org_id}")
async def org_detail(org_id: uuid.UUID, db: DB):
    org = await _org(db, org_id)
    members = (
        await db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org.id).order_by(OrganizationMember.created_at))
    ).all()
    locations = (await db.scalars(select(Location).where(Location.organization_id == org.id, Location.deleted_at.is_(None)))).all()
    sub, plan = (await db.execute(select(Subscription, SubscriptionPlan).join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id).where(Subscription.organization_id == org.id))).first() or (None, None)
    gconn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == org.id))
    ai_month = await db.scalar(select(AIUsage.requests).where(AIUsage.organization_id == org.id, AIUsage.period == now().strftime("%Y-%m")))
    usage = {
        "reviews": await db.scalar(select(func.count()).select_from(Review).where(Review.organization_id == org.id)),
        "customers": await db.scalar(select(func.count()).select_from(Customer).where(Customer.organization_id == org.id, Customer.deleted_at.is_(None))),
        "campaigns": await db.scalar(select(func.count()).select_from(Campaign).where(Campaign.organization_id == org.id, Campaign.deleted_at.is_(None))),
        "requests_sent": await db.scalar(select(func.count()).select_from(ReviewRequest).where(ReviewRequest.organization_id == org.id, ReviewRequest.sent_at.is_not(None))),
        "qr_codes": await db.scalar(select(func.count()).select_from(QRCode).where(QRCode.organization_id == org.id, QRCode.deleted_at.is_(None))),
        "feedback": await db.scalar(select(func.count()).select_from(FeedbackSubmission).where(FeedbackSubmission.organization_id == org.id)),
        "ai_requests_this_month": ai_month or 0,
    }
    audit_rows = (await db.scalars(select(AuditLog).where(AuditLog.organization_id == org.id).order_by(AuditLog.created_at.desc()).limit(25))).all()
    payments = (await db.scalars(select(Payment).where(Payment.organization_id == org.id).order_by(Payment.created_at.desc()).limit(10))).all()
    return {
        "organization": {
            "id": str(org.id), "name": org.name, "slug": org.slug, "industry": org.industry, "country": org.country, "timezone": org.timezone, "website": org.website,
            "status": org.status, "suspended_reason": org.suspended_reason, "is_demo": org.is_demo, "created_at": _iso(org.created_at),
            "onboarding_completed_at": _iso(org.onboarding_completed_at), "logo_url": org.logo_url,
        },
        "members": [{"member_id": str(m.id), "user_id": str(u.id), "full_name": u.full_name, "email": u.email, "role": m.role, "status": u.status, "last_login_at": _iso(u.last_login_at)} for m, u in members],
        "locations": [{"id": str(l.id), "name": l.name, "city": l.city, "is_active": l.is_active, "google_linked": bool(l.google_location_name)} for l in locations],
        "subscription": None if sub is None else {
            "id": str(sub.id), "status": sub.status, "interval": sub.interval, "provider": sub.provider, "plan_code": plan.code, "plan_name": plan.name,
            "trial_ends_at": _iso(sub.trial_ends_at), "current_period_end": _iso(sub.current_period_end), "grace_period_ends_at": _iso(sub.grace_period_ends_at),
            "cancel_at_period_end": sub.cancel_at_period_end, "mrr_minor": _monthly_minor(plan, sub.interval) if sub.status in PAID else 0,
        },
        "integrations": {"google": gconn.status if gconn else "not_connected", "google_last_synced_at": _iso(gconn.last_synced_at) if gconn else None},
        "usage": usage,
        "payments": [{"id": str(p.id), "amount_minor": p.amount_minor, "currency": p.currency, "status": p.status, "provider": p.provider, "created_at": _iso(p.created_at)} for p in payments],
        "audit": [{"id": str(a.id), "action": a.action, "actor_email": a.actor_email, "actor_type": a.actor_type, "created_at": _iso(a.created_at), "meta": a.meta} for a in audit_rows],
    }


@router.post("/organizations/{org_id}/suspend")
async def suspend_org(org_id: uuid.UUID, data: ReasonIn, request: Request, db: DB, admin: SuperAdmin):
    org = await _org(db, org_id)
    if org.status == OrgStatus.SUSPENDED:
        raise Conflict("Organization is already suspended")
    org.status, org.suspended_reason = OrgStatus.SUSPENDED, data.reason
    await audit.record(db, "admin.organization_suspended", actor=admin, organization_id=org.id, target_type="organization", target_id=org.id, request=request, meta={"reason": data.reason})
    await db.commit()
    return {"status": org.status}


@router.post("/organizations/{org_id}/reactivate")
async def reactivate_org(org_id: uuid.UUID, data: ReasonIn, request: Request, db: DB, admin: SuperAdmin):
    org = await _org(db, org_id)
    org.status, org.suspended_reason = OrgStatus.ACTIVE, None
    await audit.record(db, "admin.organization_reactivated", actor=admin, organization_id=org.id, target_type="organization", target_id=org.id, request=request, meta={"reason": data.reason})
    await db.commit()
    return {"status": org.status}


# ================================================================== users

def _user_row(u: User) -> dict:
    return {
        "id": str(u.id), "email": u.email, "full_name": u.full_name, "avatar_url": u.avatar_url, "platform_role": u.platform_role, "status": u.status,
        "email_verified": u.email_verified, "last_login_at": _iso(u.last_login_at), "created_at": _iso(u.created_at), "is_seed": u.is_seed,
    }


@router.get("/users")
async def list_users(db: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), q: str | None = None, status: str | None = None, role: str | None = None, verified: bool | None = None):
    conds = [User.deleted_at.is_(None)]
    if q:
        conds.append(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    if status:
        conds.append(User.status == status)
    if role:
        conds.append(User.platform_role == role)
    if verified is not None:
        conds.append(User.email_verified_at.is_not(None) if verified else User.email_verified_at.is_(None))
    total = await db.scalar(select(func.count()).select_from(User).where(*conds))
    users = (await db.scalars(select(User).where(*conds).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    ids = [u.id for u in users]
    orgs = dict((await db.execute(select(OrganizationMember.user_id, func.count()).where(OrganizationMember.user_id.in_(ids)).group_by(OrganizationMember.user_id))).all()) if ids else {}
    return _page([{**_user_row(u), "organizations": orgs.get(u.id, 0)} for u in users], total or 0, page, page_size)


async def _user(db, user_id: uuid.UUID) -> User:
    u = await db.get(User, user_id)
    if u is None or u.deleted_at is not None:
        raise NotFound("User not found")
    return u


@router.get("/users/{user_id}")
async def user_detail(user_id: uuid.UUID, db: DB):
    u = await _user(db, user_id)
    memberships = (await db.execute(select(OrganizationMember, Organization).join(Organization, Organization.id == OrganizationMember.organization_id).where(OrganizationMember.user_id == u.id))).all()
    active_sessions = await db.scalar(select(func.count()).select_from(AuthSession).where(AuthSession.user_id == u.id, AuthSession.revoked_at.is_(None), AuthSession.expires_at > now()))
    audit_rows = (await db.scalars(select(AuditLog).where(or_(AuditLog.actor_id == u.id, AuditLog.target_id == str(u.id))).order_by(AuditLog.created_at.desc()).limit(25))).all()
    return {
        "user": {**_user_row(u), "phone": u.phone, "timezone": u.timezone, "locale": u.locale, "has_password": u.password_hash is not None},
        "memberships": [{"organization_id": str(o.id), "organization_name": o.name, "role": m.role, "organization_status": o.status, "joined_at": _iso(m.created_at)} for m, o in memberships],
        "active_sessions": active_sessions or 0,
        "audit": [{"id": str(a.id), "action": a.action, "created_at": _iso(a.created_at), "ip_address": a.ip_address, "meta": a.meta} for a in audit_rows],
    }


@router.post("/users/{user_id}/disable")
async def disable_user(user_id: uuid.UUID, data: ReasonIn, request: Request, db: DB, admin: SuperAdmin):
    u = await _user(db, user_id)
    if u.id == admin.id:
        raise Forbidden("You cannot disable your own account.")
    if u.is_super_admin:
        raise Forbidden("Super Admin accounts cannot be disabled from the console.")
    u.status = UserStatus.DISABLED
    await db.execute(update(AuthSession).where(AuthSession.user_id == u.id, AuthSession.revoked_at.is_(None)).values(revoked_at=now(), revoked_reason="disabled_by_admin"))
    await audit.record(db, "admin.user_disabled", actor=admin, target_type="user", target_id=u.id, request=request, meta={"reason": data.reason})
    await db.commit()
    return {"status": u.status}


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(user_id: uuid.UUID, data: ReasonIn, request: Request, db: DB, admin: SuperAdmin):
    u = await _user(db, user_id)
    u.status = UserStatus.ACTIVE
    await audit.record(db, "admin.user_reactivated", actor=admin, target_type="user", target_id=u.id, request=request, meta={"reason": data.reason})
    await db.commit()
    return {"status": u.status}


@router.post("/users/{user_id}/revoke-sessions")
async def revoke_user_sessions(user_id: uuid.UUID, data: ReasonIn, request: Request, db: DB, admin: SuperAdmin):
    u = await _user(db, user_id)
    res = await db.execute(update(AuthSession).where(AuthSession.user_id == u.id, AuthSession.revoked_at.is_(None)).values(revoked_at=now(), revoked_reason="revoked_by_admin"))
    await audit.record(db, "admin.user_sessions_revoked", actor=admin, target_type="user", target_id=u.id, request=request, meta={"reason": data.reason})
    await db.commit()
    return {"revoked": res.rowcount}


# ================================================================== subscriptions & payments

@router.get("/subscriptions")
async def list_subscriptions(db: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: str | None = None, plan: str | None = None, q: str | None = None):
    base = (
        select(Subscription, SubscriptionPlan, Organization)
        .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
        .join(Organization, Organization.id == Subscription.organization_id)
        .where(Organization.deleted_at.is_(None))
    )
    if status:
        base = base.where(Subscription.status == status)
    if plan:
        base = base.where(SubscriptionPlan.code == plan)
    if q:
        base = base.where(Organization.name.ilike(f"%{q}%"))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(Subscription.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        {
            "id": str(s.id), "organization_id": str(o.id), "organization_name": o.name, "is_demo": o.is_demo, "plan_code": p.code, "plan_name": p.name,
            "status": s.status, "interval": s.interval, "provider": s.provider, "trial_ends_at": _iso(s.trial_ends_at), "current_period_end": _iso(s.current_period_end),
            "grace_period_ends_at": _iso(s.grace_period_ends_at), "cancel_at_period_end": s.cancel_at_period_end, "mrr_minor": _monthly_minor(p, s.interval) if s.status in PAID else 0,
            "created_at": _iso(s.created_at),
        }
        for s, p, o in rows
    ]
    counts = dict((await db.execute(select(Subscription.status, func.count()).group_by(Subscription.status))).all())
    return {**_page(items, total or 0, page, page_size), "counts": counts}


class SubscriptionActionIn(BaseModel):
    action: str = Field(pattern="^(extend_trial|set_grace_period|clear_grace_period|change_plan)$")
    days: int | None = Field(None, ge=1, le=90)
    plan_code: str | None = None
    reason: str = Field(min_length=4, max_length=500)


@router.post("/subscriptions/{sub_id}/action")
async def subscription_action(sub_id: uuid.UUID, data: SubscriptionActionIn, request: Request, db: DB, admin: SuperAdmin):
    """Audited manual overrides. Never marks payments as paid — payment state comes only from provider webhooks."""
    sub = await db.get(Subscription, sub_id)
    if sub is None:
        raise NotFound("Subscription not found")
    before = {"status": sub.status, "trial_ends_at": _iso(sub.trial_ends_at), "grace_period_ends_at": _iso(sub.grace_period_ends_at)}
    if data.action == "extend_trial":
        if sub.status not in (SubscriptionStatus.TRIALING, SubscriptionStatus.EXPIRED):
            raise AppError("Only trialing or expired-trial subscriptions can have the trial extended.", code="invalid_state")
        if not data.days:
            raise AppError("Specify the number of days.", code="validation_error", status_code=422)
        base = max(sub.trial_ends_at or now(), now())
        sub.trial_ends_at = base + timedelta(days=data.days)
        sub.current_period_end = sub.trial_ends_at
        sub.status = SubscriptionStatus.TRIALING
    elif data.action == "set_grace_period":
        if not data.days:
            raise AppError("Specify the number of days.", code="validation_error", status_code=422)
        if sub.status not in (SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.EXPIRED, SubscriptionStatus.ACTIVE):
            raise AppError("Grace periods apply to paid subscriptions only.", code="invalid_state")
        sub.status = SubscriptionStatus.GRACE_PERIOD
        sub.grace_period_ends_at = now() + timedelta(days=data.days)
    elif data.action == "clear_grace_period":
        if sub.status != SubscriptionStatus.GRACE_PERIOD:
            raise AppError("Subscription is not in a grace period.", code="invalid_state")
        sub.grace_period_ends_at = now()
    elif data.action == "change_plan":
        if sub.status != SubscriptionStatus.TRIALING:
            raise AppError("Plan changes for paid subscriptions must go through checkout so the provider bills correctly. Only trial plans can be switched here.", code="invalid_state")
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == data.plan_code))
        if plan is None:
            raise NotFound("Plan not found")
        sub.plan_id = plan.id
    await audit.record(db, f"admin.subscription_{data.action}", actor=admin, organization_id=sub.organization_id, target_type="subscription", target_id=sub.id, request=request,
                       meta={"reason": data.reason, "days": data.days, "plan_code": data.plan_code, "before": before})
    await db.commit()
    return {"status": sub.status, "trial_ends_at": _iso(sub.trial_ends_at), "grace_period_ends_at": _iso(sub.grace_period_ends_at)}


@router.get("/payments")
async def list_payments(db: DB, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), status: str | None = None, provider: str | None = None, q: str | None = None):
    base = select(Payment, Organization).join(Organization, Organization.id == Payment.organization_id)
    if status:
        base = base.where(Payment.status == status)
    if provider:
        base = base.where(Payment.provider == provider)
    if q:
        base = base.where(or_(Organization.name.ilike(f"%{q}%"), Payment.provider_payment_id.ilike(f"%{q}%")))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    summary = (
        await db.execute(select(func.coalesce(func.sum(Payment.amount_minor).filter(Payment.status == PaymentStatus.SUCCEEDED), 0), func.count().filter(Payment.status == PaymentStatus.FAILED), func.count()))
    ).one()
    items = [
        {"id": str(p.id), "organization_id": str(o.id), "organization_name": o.name, "provider": p.provider, "provider_payment_id": p.provider_payment_id, "amount_minor": p.amount_minor,
         "currency": p.currency, "status": p.status, "failure_reason": p.failure_reason, "plan_code": p.plan_code, "paid_at": _iso(p.paid_at), "created_at": _iso(p.created_at), "simulated": p.provider == "mock"}
        for p, o in rows
    ]
    return {**_page(items, total or 0, page, page_size), "summary": {"collected_minor": summary[0], "failed": summary[1], "total": summary[2]}}


# ================================================================== plans

class PlanIn(BaseModel):
    code: str = Field(pattern=r"^[a-z][a-z0-9_]{1,31}$")
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(None, max_length=1000)
    currency: str = Field("INR", min_length=3, max_length=3)
    price_monthly_minor: int = Field(ge=0)
    price_yearly_minor: int = Field(ge=0)
    max_locations: int = Field(ge=1)
    max_team_members: int = Field(ge=1)
    max_organizations: int = Field(1, ge=1)
    ai_requests_per_month: int = Field(ge=0)
    monthly_message_quota: int = Field(ge=0)
    features: list[str] = []
    entitlements: dict[str, bool] = {}
    is_popular: bool = False
    is_custom_pricing: bool = False
    is_active: bool = True
    sort_order: int = 0


class PlanUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=80)
    description: str | None = Field(None, max_length=1000)
    price_monthly_minor: int | None = Field(None, ge=0)
    price_yearly_minor: int | None = Field(None, ge=0)
    max_locations: int | None = Field(None, ge=1)
    max_team_members: int | None = Field(None, ge=1)
    max_organizations: int | None = Field(None, ge=1)
    ai_requests_per_month: int | None = Field(None, ge=0)
    monthly_message_quota: int | None = Field(None, ge=0)
    features: list[str] | None = None
    entitlements: dict[str, bool] | None = None
    is_popular: bool | None = None
    is_custom_pricing: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None


def _plan(p: SubscriptionPlan, subs: int = 0) -> dict:
    return {
        "id": str(p.id), "code": p.code, "name": p.name, "description": p.description, "currency": p.currency, "price_monthly_minor": p.price_monthly_minor,
        "price_yearly_minor": p.price_yearly_minor, "max_locations": p.max_locations, "max_team_members": p.max_team_members, "max_organizations": p.max_organizations,
        "ai_requests_per_month": p.ai_requests_per_month, "monthly_message_quota": p.monthly_message_quota, "features": p.features, "entitlements": p.entitlements,
        "is_popular": p.is_popular, "is_custom_pricing": p.is_custom_pricing, "is_active": p.is_active, "sort_order": p.sort_order, "subscriptions": subs,
        "updated_at": _iso(p.updated_at),
    }


@router.get("/plans")
async def list_plans(db: DB):
    counts = dict((await db.execute(select(Subscription.plan_id, func.count()).group_by(Subscription.plan_id))).all())
    plans = (await db.scalars(select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order))).all()
    return [_plan(p, counts.get(p.id, 0)) for p in plans]


@router.post("/plans", status_code=201)
async def create_plan(data: PlanIn, request: Request, db: DB, admin: SuperAdmin):
    if await db.scalar(select(SubscriptionPlan.id).where(SubscriptionPlan.code == data.code)):
        raise Conflict("A plan with this code already exists")
    plan = SubscriptionPlan(**data.model_dump())
    db.add(plan)
    await db.flush()
    await audit.record(db, "admin.plan_created", actor=admin, target_type="plan", target_id=plan.id, request=request, meta={"code": data.code})
    await db.commit()
    await db.refresh(plan)
    return _plan(plan)


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: uuid.UUID, data: PlanUpdate, request: Request, db: DB, admin: SuperAdmin):
    plan = await db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise NotFound("Plan not found")
    changes = data.model_dump(exclude_unset=True)
    before = {k: getattr(plan, k) for k in changes}
    for k, v in changes.items():
        setattr(plan, k, v)
    if any(k in changes for k in ("price_monthly_minor", "price_yearly_minor")):
        plan.provider_refs = {}  # providers need fresh price/plan objects for new prices
    await audit.record(db, "admin.plan_updated", actor=admin, target_type="plan", target_id=plan.id, request=request, meta={"code": plan.code, "before": before, "after": changes})
    await db.commit()
    await db.refresh(plan)
    return _plan(plan)


# ================================================================== revenue analytics

@router.get("/revenue")
async def revenue(db: DB):
    mrr, by_plan = await _mrr(db)
    plans = {p.code: p.name for p in (await db.scalars(select(SubscriptionPlan))).all()}
    months = _month_starts(12)
    monthly = []
    for m in months:
        nxt = (m + timedelta(days=32)).replace(day=1)
        row = (
            await db.execute(
                select(
                    func.coalesce(func.sum(Payment.amount_minor).filter(Payment.status == PaymentStatus.SUCCEEDED), 0),
                    func.count().filter(Payment.status == PaymentStatus.SUCCEEDED),
                    func.count().filter(Payment.status == PaymentStatus.FAILED),
                    func.coalesce(func.sum(Payment.amount_minor).filter(Payment.status == PaymentStatus.FAILED), 0),
                ).where(Payment.created_at >= m, Payment.created_at < nxt)
            )
        ).one()
        monthly.append({"month": m.strftime("%Y-%m"), "revenue_minor": row[0], "payments": row[1], "failed": row[2], "failed_minor": row[3]})
    paying = await db.scalar(select(func.count()).select_from(Subscription).where(Subscription.status.in_(PAID))) or 0
    since = now() - timedelta(days=90)
    churned_90d = await db.scalar(
        select(func.count()).select_from(Subscription).where(Subscription.status.in_((SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED)), func.coalesce(Subscription.canceled_at, Subscription.updated_at) >= since)
    ) or 0
    monthly_churn = (churned_90d / 3) / max(1, paying + churned_90d) if (paying + churned_90d) else 0.0
    arpa = mrr / paying if paying else 0
    ever_trialed = await db.scalar(select(func.count()).select_from(Subscription)) or 0
    converted = await db.scalar(select(func.count(func.distinct(Payment.organization_id))).where(Payment.status == PaymentStatus.SUCCEEDED)) or 0
    failed_recent = (
        await db.execute(select(Payment, Organization.name).join(Organization, Organization.id == Payment.organization_id).where(Payment.status == PaymentStatus.FAILED).order_by(Payment.created_at.desc()).limit(10))
    ).all()
    return {
        "mrr_minor": mrr,
        "arr_minor": mrr * 12,
        "paying_customers": paying,
        "arpa_minor": round(arpa),
        "monthly_churn_rate": round(monthly_churn, 4),
        "trial_conversion_rate": round(converted / ever_trialed, 4) if ever_trialed else None,
        "ltv_estimate_minor": round(arpa / monthly_churn) if monthly_churn > 0 else None,
        "revenue_by_plan": [{"code": c, "name": plans.get(c, c), "mrr_minor": v} for c, v in sorted(by_plan.items(), key=lambda kv: -kv[1])],
        "monthly": monthly,
        "failed_payments": [{"id": str(p.id), "organization_name": n, "amount_minor": p.amount_minor, "currency": p.currency, "failure_reason": p.failure_reason, "created_at": _iso(p.created_at)} for p, n in failed_recent],
        "definitions": {
            "mrr": "Sum of monthly-equivalent plan prices for active, past-due and grace-period subscriptions (yearly ÷ 12).",
            "monthly_churn_rate": "Estimate: subscriptions canceled or expired in the last 90 days ÷ 3, over paying + churned subscriptions.",
            "trial_conversion_rate": "Organisations with at least one successful payment ÷ all organisations that started a subscription (incl. trials).",
            "ltv_estimate": "Estimate: ARPA ÷ monthly churn rate. Not shown when churn is zero.",
        },
        "includes_simulated": bool(await db.scalar(select(func.count()).select_from(Payment).where(Payment.provider == "mock"))),
    }


# ================================================================== integrations

@router.get("/integrations")
async def integrations(db: DB):
    google = dict((await db.execute(select(GoogleConnection.status, func.count()).group_by(GoogleConnection.status))).all())
    creds = (await db.execute(select(IntegrationCredential.provider, IntegrationCredential.status, func.count()).group_by(IntegrationCredential.provider, IntegrationCredential.status))).all()
    by_provider: dict[str, dict[str, int]] = {}
    for prov, st, n in creds:
        by_provider.setdefault(prov, {})[st] = n
    errors = (
        await db.execute(
            select(GoogleConnection, Organization.name).join(Organization, Organization.id == GoogleConnection.organization_id).where(GoogleConnection.last_error.is_not(None)).order_by(GoogleConnection.updated_at.desc()).limit(10)
        )
    ).all()
    cred_errors = (
        await db.execute(
            select(IntegrationCredential, Organization.name).join(Organization, Organization.id == IntegrationCredential.organization_id).where(IntegrationCredential.last_error.is_not(None)).order_by(IntegrationCredential.updated_at.desc()).limit(10)
        )
    ).all()
    recent = [{"provider": "google", "organization_name": n, "status": c.status, "error": c.last_error, "at": _iso(c.updated_at)} for c, n in errors]
    recent += [{"provider": c.provider, "organization_name": n, "status": c.status, "error": c.last_error, "at": _iso(c.updated_at)} for c, n in cred_errors]
    recent.sort(key=lambda r: r["at"] or "", reverse=True)
    deliveries = dict(
        (await db.execute(select(ReviewRequest.channel, func.count()).where(ReviewRequest.status == RequestStatus.FAILED, ReviewRequest.created_at > now() - timedelta(days=7)).group_by(ReviewRequest.channel))).all()
    )
    return {
        "platform": {
            "google_oauth": settings.google_configured, "openai": settings.openai_configured, "resend": settings.resend_configured,
            "whatsapp_platform": settings.whatsapp_platform_configured, "stripe": settings.stripe_configured, "razorpay": settings.razorpay_configured,
            "s3": settings.s3_configured, "twilio": bool(settings.twilio_account_sid), "demo_mode": settings.demo_mode,
        },
        "google_connections": google,
        "credentials": by_provider,
        "failed_deliveries_7d": deliveries,
        "recent_errors": recent[:15],
    }


# ================================================================== AI usage

@router.get("/ai-usage")
async def ai_usage(db: DB, period: str | None = Query(None, pattern=r"^\d{4}-\d{2}$")):
    period = period or now().strftime("%Y-%m")
    tot = (
        await db.execute(
            select(
                func.coalesce(func.sum(AIUsage.requests), 0), func.coalesce(func.sum(AIUsage.failed_requests), 0),
                func.coalesce(func.sum(AIUsage.prompt_tokens), 0), func.coalesce(func.sum(AIUsage.completion_tokens), 0), func.coalesce(func.sum(AIUsage.cost_usd), 0),
            ).where(AIUsage.period == period)
        )
    ).one()
    per_org = (
        await db.execute(
            select(AIUsage, Organization.name).join(Organization, Organization.id == AIUsage.organization_id).where(AIUsage.period == period).order_by(AIUsage.requests.desc()).limit(50)
        )
    ).all()
    by_model = (await db.execute(select(AIGeneration.provider, AIGeneration.model, func.count(), func.sum(AIGeneration.prompt_tokens + AIGeneration.completion_tokens), func.sum(AIGeneration.cost_usd)).group_by(AIGeneration.provider, AIGeneration.model))).all()
    by_kind = dict((await db.execute(select(AIGeneration.kind, func.count()).group_by(AIGeneration.kind))).all())
    months = (await db.execute(select(AIUsage.period, func.sum(AIUsage.requests), func.sum(AIUsage.prompt_tokens + AIUsage.completion_tokens), func.sum(AIUsage.cost_usd)).group_by(AIUsage.period).order_by(AIUsage.period.desc()).limit(12))).all()
    failures = (
        await db.execute(select(AIGeneration, Organization.name).join(Organization, Organization.id == AIGeneration.organization_id).where(AIGeneration.success.is_(False)).order_by(AIGeneration.created_at.desc()).limit(10))
    ).all()
    return {
        "period": period,
        "configured": settings.openai_configured,
        "model": settings.openai_model,
        "totals": {"requests": tot[0], "failed": tot[1], "prompt_tokens": tot[2], "completion_tokens": tot[3], "estimated_cost_usd": float(tot[4])},
        "per_organization": [{"organization_id": str(u.organization_id), "organization_name": n, "requests": u.requests, "failed": u.failed_requests, "tokens": u.prompt_tokens + u.completion_tokens, "estimated_cost_usd": float(u.cost_usd)} for u, n in per_org],
        "by_model": [{"provider": p, "model": m, "requests": c, "tokens": int(t or 0), "estimated_cost_usd": float(cost or 0)} for p, m, c, t, cost in by_model],
        "by_kind": by_kind,
        "monthly": [{"period": p, "requests": int(r or 0), "tokens": int(t or 0), "estimated_cost_usd": float(c or 0)} for p, r, t, c in reversed(months)],
        "recent_failures": [{"id": str(g.id), "organization_name": n, "kind": g.kind, "model": g.model, "error": (g.error or "")[:300], "created_at": _iso(g.created_at)} for g, n in failures],
    }


# ================================================================== campaign monitoring

@router.get("/campaigns")
async def campaigns(db: DB, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: str | None = None, channel: str | None = None):
    stmt = (
        select(
            Campaign, Organization.name,
            func.count(ReviewRequest.id).filter(ReviewRequest.sent_at.is_not(None)),
            func.count(ReviewRequest.id).filter(ReviewRequest.delivered_at.is_not(None)),
            func.count(ReviewRequest.id).filter(ReviewRequest.status == RequestStatus.FAILED),
            func.count(ReviewRequest.id).filter(ReviewRequest.status == RequestStatus.SKIPPED),
        )
        .join(Organization, Organization.id == Campaign.organization_id)
        .outerjoin(ReviewRequest, ReviewRequest.campaign_id == Campaign.id)
        .where(Campaign.deleted_at.is_(None))
        .group_by(Campaign.id, Organization.name)
    )
    if status:
        stmt = stmt.where(Campaign.status == status)
    if channel:
        stmt = stmt.where(Campaign.channel == channel)
    total = await db.scalar(select(func.count()).select_from(Campaign).where(Campaign.deleted_at.is_(None), *( [Campaign.status == status] if status else []), *( [Campaign.channel == channel] if channel else [])))
    rows = (await db.execute(stmt.order_by(Campaign.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        {"id": str(c.id), "name": c.name, "organization_id": str(c.organization_id), "organization_name": n, "channel": c.channel, "status": c.status, "launched_at": _iso(c.launched_at),
         "sent": s, "delivered": d, "failed": f, "skipped": sk, "failure_rate": round(f / (s + f), 4) if (s + f) else None}
        for c, n, s, d, f, sk in rows
    ]
    since = now() - timedelta(days=30)
    agg = (
        await db.execute(
            select(func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.delivered_at.is_not(None)), func.count().filter(ReviewRequest.status == RequestStatus.FAILED), func.count().filter(ReviewRequest.status == RequestStatus.SKIPPED)).where(ReviewRequest.created_at >= since)
        )
    ).one()
    top_failing = (
        await db.execute(
            select(Organization.id, Organization.name, func.count().filter(ReviewRequest.status == RequestStatus.FAILED).label("failed"), func.count())
            .join(ReviewRequest, ReviewRequest.organization_id == Organization.id)
            .where(ReviewRequest.created_at >= since)
            .group_by(Organization.id, Organization.name)
            .order_by(func.count().filter(ReviewRequest.status == RequestStatus.FAILED).desc())
            .limit(8)
        )
    ).all()
    by_channel = (await db.execute(select(ReviewRequest.channel, func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.status == RequestStatus.FAILED)).where(ReviewRequest.created_at >= since).group_by(ReviewRequest.channel))).all()
    status_counts = dict((await db.execute(select(Campaign.status, func.count()).where(Campaign.deleted_at.is_(None)).group_by(Campaign.status))).all())
    return {
        **_page(items, total or 0, page, page_size),
        "summary_30d": {"sent": agg[0], "delivered": agg[1], "failed": agg[2], "skipped": agg[3], "failure_rate": round(agg[2] / (agg[0] + agg[2]), 4) if (agg[0] + agg[2]) else None},
        "top_failing": [{"organization_id": str(i), "organization_name": n, "failed": f, "total": t} for i, n, f, t in top_failing if f],
        "by_channel": [{"channel": ch, "sent": s, "failed": f} for ch, s, f in by_channel],
        "status_counts": status_counts,
    }


# ================================================================== support tickets

class TicketReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    internal: bool = False


class TicketUpdateIn(BaseModel):
    status: str | None = Field(None, pattern="^(open|pending|resolved|closed)$")
    priority: str | None = Field(None, pattern="^(low|normal|high|urgent)$")
    assignee_id: uuid.UUID | None = None
    unassign: bool = False


@router.get("/support/tickets")
async def list_tickets(db: DB, admin: SuperAdmin, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: str | None = None, priority: str | None = None, assignee: str | None = None, q: str | None = None):
    base = select(SupportTicket, Organization.name, User.full_name, User.email).outerjoin(Organization, Organization.id == SupportTicket.organization_id).outerjoin(User, User.id == SupportTicket.requester_id)
    if status:
        base = base.where(SupportTicket.status == status)
    if priority:
        base = base.where(SupportTicket.priority == priority)
    if assignee == "me":
        base = base.where(SupportTicket.assignee_id == admin.id)
    elif assignee == "unassigned":
        base = base.where(SupportTicket.assignee_id.is_(None))
    if q:
        base = base.where(or_(SupportTicket.subject.ilike(f"%{q}%"), Organization.name.ilike(f"%{q}%")))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(SupportTicket.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    assignees = {u.id: u.full_name for u in (await db.scalars(select(User).where(User.id.in_({t.assignee_id for t, *_ in rows if t.assignee_id})))).all()} if rows else {}
    items = [
        {"id": str(t.id), "subject": t.subject, "category": t.category, "status": t.status, "priority": t.priority, "organization_name": on, "requester_name": rn, "requester_email": re,
         "assignee_id": str(t.assignee_id) if t.assignee_id else None, "assignee_name": assignees.get(t.assignee_id), "data_access_active": bool(t.data_access_granted_until and t.data_access_granted_until > now()),
         "created_at": _iso(t.created_at), "updated_at": _iso(t.updated_at)}
        for t, on, rn, re in rows
    ]
    counts = dict((await db.execute(select(SupportTicket.status, func.count()).group_by(SupportTicket.status))).all())
    return {**_page(items, total or 0, page, page_size), "counts": counts}


async def _ticket(db, ticket_id: uuid.UUID) -> SupportTicket:
    t = await db.get(SupportTicket, ticket_id)
    if t is None:
        raise NotFound("Ticket not found")
    return t


@router.get("/support/tickets/{ticket_id}")
async def ticket_detail(ticket_id: uuid.UUID, db: DB):
    t = await _ticket(db, ticket_id)
    org = await db.get(Organization, t.organization_id) if t.organization_id else None
    requester = await db.get(User, t.requester_id) if t.requester_id else None
    msgs = (await db.execute(select(SupportMessage, User.full_name).outerjoin(User, User.id == SupportMessage.author_id).where(SupportMessage.ticket_id == t.id).order_by(SupportMessage.created_at))).all()
    admins = (await db.scalars(select(User).where(User.platform_role == "platform_super_admin", User.status == UserStatus.ACTIVE))).all()
    return {
        "ticket": {
            "id": str(t.id), "subject": t.subject, "category": t.category, "status": t.status, "priority": t.priority, "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            "data_access_granted_until": _iso(t.data_access_granted_until), "data_access_active": bool(t.data_access_granted_until and t.data_access_granted_until > now()),
            "created_at": _iso(t.created_at), "resolved_at": _iso(t.resolved_at),
        },
        "organization": {"id": str(org.id), "name": org.name, "status": org.status} if org else None,
        "requester": {"id": str(requester.id), "full_name": requester.full_name, "email": requester.email} if requester else None,
        "messages": [{"id": str(m.id), "body": m.body, "author_name": n, "is_internal": m.is_internal, "is_from_staff": m.is_from_staff, "created_at": _iso(m.created_at)} for m, n in msgs],
        "admins": [{"id": str(a.id), "full_name": a.full_name} for a in admins],
    }


@router.post("/support/tickets/{ticket_id}/messages", status_code=201)
async def ticket_reply(ticket_id: uuid.UUID, data: TicketReplyIn, request: Request, db: DB, admin: SuperAdmin):
    t = await _ticket(db, ticket_id)
    db.add(SupportMessage(ticket_id=t.id, author_id=admin.id, body=data.body, is_internal=data.internal, is_from_staff=True))
    if not data.internal and t.status == "open":
        t.status = "pending"
    if t.assignee_id is None:
        t.assignee_id = admin.id
    t.updated_at = now()
    await audit.record(db, "admin.ticket_note_added" if data.internal else "admin.ticket_replied", actor=admin, organization_id=t.organization_id, target_type="support_ticket", target_id=t.id, request=request)
    if not data.internal and t.requester_id:
        from app.services.notify import notify_user

        await notify_user(db, t.requester_id, "system.announcement", f"Support replied: {t.subject}", data.body[:160], organization_id=t.organization_id, link="/app/settings?tab=support", send_email=True)
    await db.commit()
    return {"ok": True}


@router.patch("/support/tickets/{ticket_id}")
async def ticket_update(ticket_id: uuid.UUID, data: TicketUpdateIn, request: Request, db: DB, admin: SuperAdmin):
    t = await _ticket(db, ticket_id)
    changes: dict[str, Any] = {}
    if data.status:
        t.status = data.status
        t.resolved_at = now() if data.status in ("resolved", "closed") else None
        changes["status"] = data.status
    if data.priority:
        t.priority = data.priority
        changes["priority"] = data.priority
    if data.unassign:
        t.assignee_id = None
        changes["assignee"] = None
    elif data.assignee_id:
        a = await db.get(User, data.assignee_id)
        if a is None or not a.is_super_admin:
            raise AppError("Tickets can only be assigned to Super Admins.", code="invalid_assignee")
        t.assignee_id = a.id
        changes["assignee"] = str(a.id)
    await audit.record(db, "admin.ticket_updated", actor=admin, organization_id=t.organization_id, target_type="support_ticket", target_id=t.id, request=request, meta=changes)
    await db.commit()
    return await ticket_detail(ticket_id, db)


@router.get("/support/tickets/{ticket_id}/org-snapshot")
async def ticket_org_snapshot(ticket_id: uuid.UUID, request: Request, db: DB, admin: SuperAdmin):
    """Limited customer-data view, available only while the customer's time-boxed grant is active."""
    t = await _ticket(db, ticket_id)
    if not t.organization_id or not t.data_access_granted_until or t.data_access_granted_until <= now():
        await audit.record(db, "admin.org_snapshot_denied", actor=admin, organization_id=t.organization_id, target_type="support_ticket", target_id=t.id, request=request)
        await db.commit()
        raise Forbidden("The customer has not granted data access for this ticket (or the grant expired).", code="data_access_not_granted")
    reviews = (await db.scalars(select(Review).where(Review.organization_id == t.organization_id).order_by(Review.review_created_at.desc()).limit(10))).all()
    campaigns_ = (await db.scalars(select(Campaign).where(Campaign.organization_id == t.organization_id, Campaign.deleted_at.is_(None)).order_by(Campaign.created_at.desc()).limit(10))).all()
    locations = (await db.scalars(select(Location).where(Location.organization_id == t.organization_id, Location.deleted_at.is_(None)))).all()
    gconn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == t.organization_id))
    await audit.record(db, "admin.org_snapshot_accessed", actor=admin, organization_id=t.organization_id, target_type="support_ticket", target_id=t.id, request=request,
                       meta={"grant_until": _iso(t.data_access_granted_until)})
    await db.commit()
    return {
        "granted_until": _iso(t.data_access_granted_until),
        "locations": [{"name": l.name, "google_review_url_set": bool(l.google_review_url), "google_linked": bool(l.google_location_name), "is_active": l.is_active} for l in locations],
        "google": {"status": gconn.status if gconn else "not_connected", "last_error": gconn.last_error if gconn else None, "last_synced_at": _iso(gconn.last_synced_at) if gconn else None},
        # Reviewer names are dropped; review text is public content but limited to the latest 10.
        "recent_reviews": [{"rating": r.rating, "comment": (r.comment or "")[:300], "source": r.source, "response_status": r.response_status, "created_at": _iso(r.review_created_at)} for r in reviews],
        "recent_campaigns": [{"name": c.name, "channel": c.channel, "status": c.status, "launched_at": _iso(c.launched_at)} for c in campaigns_],
    }


# ================================================================== announcements

class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=4000)
    level: str = Field("info", pattern="^(info|warning|critical)$")
    audience: str = Field("all", pattern="^(all|organizations|plans)$")
    organization_ids: list[uuid.UUID] = []
    plan_codes: list[str] = []
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    dismissible: bool = True
    publish: bool = False


def _ann(a: Announcement) -> dict:
    return {
        "id": str(a.id), "title": a.title, "body": a.body, "level": a.level, "audience": a.audience, "organization_ids": a.organization_ids, "plan_codes": a.plan_codes,
        "starts_at": _iso(a.starts_at), "ends_at": _iso(a.ends_at), "published_at": _iso(a.published_at), "dismissible": a.dismissible, "created_at": _iso(a.created_at),
    }


@router.get("/announcements")
async def list_announcements(db: DB):
    return [_ann(a) for a in (await db.scalars(select(Announcement).order_by(Announcement.created_at.desc()).limit(200))).all()]


def _apply_ann(a: Announcement, data: AnnouncementIn) -> None:
    if data.audience == "organizations" and not data.organization_ids:
        raise AppError("Choose at least one organization.", code="validation_error", status_code=422)
    if data.audience == "plans" and not data.plan_codes:
        raise AppError("Choose at least one plan.", code="validation_error", status_code=422)
    a.title, a.body, a.level, a.audience = data.title, data.body, data.level, data.audience
    a.organization_ids = [str(i) for i in data.organization_ids] if data.audience == "organizations" else []
    a.plan_codes = data.plan_codes if data.audience == "plans" else []
    a.starts_at, a.ends_at, a.dismissible = data.starts_at, data.ends_at, data.dismissible


@router.post("/announcements", status_code=201)
async def create_announcement(data: AnnouncementIn, request: Request, db: DB, admin: SuperAdmin):
    a = Announcement(created_by_id=admin.id, title=data.title, body=data.body)
    _apply_ann(a, data)
    if data.publish:
        a.published_at = now()
    db.add(a)
    await db.flush()
    await audit.record(db, "admin.announcement_created", actor=admin, target_type="announcement", target_id=a.id, request=request, meta={"published": data.publish, "audience": data.audience})
    await db.commit()
    await db.refresh(a)
    return _ann(a)


@router.put("/announcements/{ann_id}")
async def update_announcement(ann_id: uuid.UUID, data: AnnouncementIn, request: Request, db: DB, admin: SuperAdmin):
    a = await db.get(Announcement, ann_id)
    if a is None:
        raise NotFound("Announcement not found")
    _apply_ann(a, data)
    await audit.record(db, "admin.announcement_updated", actor=admin, target_type="announcement", target_id=a.id, request=request)
    await db.commit()
    await db.refresh(a)
    return _ann(a)


@router.post("/announcements/{ann_id}/publish")
async def publish_announcement(ann_id: uuid.UUID, request: Request, db: DB, admin: SuperAdmin, publish: bool = True):
    a = await db.get(Announcement, ann_id)
    if a is None:
        raise NotFound("Announcement not found")
    a.published_at = now() if publish else None
    await audit.record(db, "admin.announcement_published" if publish else "admin.announcement_unpublished", actor=admin, target_type="announcement", target_id=a.id, request=request)
    await db.commit()
    await db.refresh(a)
    return _ann(a)


@router.delete("/announcements/{ann_id}", status_code=204)
async def delete_announcement(ann_id: uuid.UUID, request: Request, db: DB, admin: SuperAdmin):
    a = await db.get(Announcement, ann_id)
    if a is None:
        raise NotFound("Announcement not found")
    await db.delete(a)
    await audit.record(db, "admin.announcement_deleted", actor=admin, target_type="announcement", target_id=ann_id, request=request, meta={"title": a.title})
    await db.commit()


# ================================================================== audit logs (read-only)

@router.get("/audit-logs")
async def audit_logs(
    db: DB, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), action: str | None = None, actor: str | None = None,
    organization_id: uuid.UUID | None = None, actor_type: str | None = None, date_from: date | None = None, date_to: date | None = None,
):
    conds = []
    if action:
        conds.append(AuditLog.action.ilike(f"{action}%"))
    if actor:
        conds.append(AuditLog.actor_email.ilike(f"%{actor}%"))
    if organization_id:
        conds.append(AuditLog.organization_id == organization_id)
    if actor_type:
        conds.append(AuditLog.actor_type == actor_type)
    if date_from:
        conds.append(AuditLog.created_at >= datetime.combine(date_from, time.min, UTC))
    if date_to:
        conds.append(AuditLog.created_at <= datetime.combine(date_to, time.max, UTC))
    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*conds))
    rows = (
        await db.execute(select(AuditLog, Organization.name).outerjoin(Organization, Organization.id == AuditLog.organization_id).where(*conds).order_by(AuditLog.seq.desc()).offset((page - 1) * page_size).limit(page_size))
    ).all()
    items = [
        {"id": str(a.id), "seq": a.seq, "created_at": _iso(a.created_at), "actor_email": a.actor_email, "actor_type": a.actor_type, "organization_id": str(a.organization_id) if a.organization_id else None,
         "organization_name": n, "action": a.action, "target_type": a.target_type, "target_id": a.target_id, "ip_address": a.ip_address, "user_agent": a.user_agent, "meta": a.meta}
        for a, n in rows
    ]
    return _page(items, total or 0, page, page_size)


# ================================================================== system health

@router.get("/system-health")
async def system_health(db: DB):
    snap = await health_snapshot()
    jobs = (await db.scalars(select(BackgroundJob).order_by(BackgroundJob.created_at.desc()).limit(20))).all()
    snap["recent_jobs"] = [
        {"id": str(j.id), "name": j.name, "status": j.status, "runner": j.runner, "attempts": j.attempts, "error": (j.error or "")[:300] or None, "created_at": _iso(j.created_at), "finished_at": _iso(j.finished_at)}
        for j in jobs
    ]
    hour = func.date_trunc("hour", ErrorEvent.created_at)
    snap["error_series"] = [{"hour": h.isoformat(), "errors": n} for h, n in (await db.execute(select(hour, func.count()).where(ErrorEvent.created_at > now() - timedelta(hours=24)).group_by(hour).order_by(hour))).all()]
    return snap


# ================================================================== feature flags

class FlagIn(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_.]{1,95}$")
    description: str | None = Field(None, max_length=500)
    enabled: bool = False
    rollout_percentage: int = Field(100, ge=0, le=100)
    organization_ids: list[uuid.UUID] = []
    plan_codes: list[str] = []


class FlagUpdate(BaseModel):
    description: str | None = Field(None, max_length=500)
    enabled: bool | None = None
    rollout_percentage: int | None = Field(None, ge=0, le=100)
    organization_ids: list[uuid.UUID] | None = None
    plan_codes: list[str] | None = None


def _flag(f: FeatureFlag) -> dict:
    return {"id": str(f.id), "key": f.key, "description": f.description, "enabled": f.enabled, "rollout_percentage": f.rollout_percentage, "organization_ids": f.organization_ids, "plan_codes": f.plan_codes, "updated_at": _iso(f.updated_at)}


@router.get("/feature-flags")
async def list_flags(db: DB):
    return [_flag(f) for f in (await db.scalars(select(FeatureFlag).order_by(FeatureFlag.key))).all()]


@router.post("/feature-flags", status_code=201)
async def create_flag(data: FlagIn, request: Request, db: DB, admin: SuperAdmin):
    if await db.scalar(select(FeatureFlag.id).where(FeatureFlag.key == data.key)):
        raise Conflict("A flag with this key already exists")
    f = FeatureFlag(**{**data.model_dump(), "organization_ids": [str(i) for i in data.organization_ids]})
    db.add(f)
    await db.flush()
    await audit.record(db, "admin.feature_flag_created", actor=admin, target_type="feature_flag", target_id=f.id, request=request, meta={"key": f.key, "enabled": f.enabled})
    await db.commit()
    await db.refresh(f)
    return _flag(f)


@router.patch("/feature-flags/{flag_id}")
async def update_flag(flag_id: uuid.UUID, data: FlagUpdate, request: Request, db: DB, admin: SuperAdmin):
    f = await db.get(FeatureFlag, flag_id)
    if f is None:
        raise NotFound("Flag not found")
    changes = data.model_dump(exclude_unset=True, mode="json")
    before = {k: getattr(f, k) for k in changes}
    for k, v in changes.items():
        setattr(f, k, v)
    await audit.record(db, "admin.feature_flag_updated", actor=admin, target_type="feature_flag", target_id=f.id, request=request, meta={"key": f.key, "before": before, "after": changes})
    await db.commit()
    await db.refresh(f)
    return _flag(f)


# ================================================================== system settings

class SettingIn(BaseModel):
    value: dict
    description: str | None = Field(None, max_length=500)


SENSITIVE_KEY_HINTS = ("secret", "token", "password", "key")


@router.get("/settings")
async def list_settings(db: DB):
    rows = (await db.scalars(select(SystemSetting).order_by(SystemSetting.key))).all()
    return {
        "settings": [{"id": str(s.id), "key": s.key, "value": s.value, "description": s.description, "updated_at": _iso(s.updated_at)} for s in rows],
        "environment": {
            "environment": settings.environment, "demo_mode": settings.demo_mode, "frontend_url": settings.frontend_url, "backend_url": settings.backend_url,
            "default_payment_provider": settings.default_payment_provider, "trial_days": settings.trial_days, "grace_period_days": settings.grace_period_days,
            "openai_model": settings.openai_model, "access_token_ttl_minutes": settings.access_token_ttl_minutes, "refresh_token_ttl_days": settings.refresh_token_ttl_days,
            "login_max_attempts": settings.login_max_attempts, "cookie_secure": settings.cookie_secure,
        },
    }


@router.put("/settings/{key}")
async def upsert_setting(key: str, data: SettingIn, request: Request, db: DB, admin: SuperAdmin):
    if not (2 <= len(key) <= 96) or any(h in key.lower() for h in SENSITIVE_KEY_HINTS):
        raise AppError("Secrets must be configured through environment variables, not system settings.", code="invalid_setting_key")
    s = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    before = s.value if s else None
    if s is None:
        s = SystemSetting(key=key, value=data.value, description=data.description)
        db.add(s)
    else:
        s.value = data.value
        if data.description is not None:
            s.description = data.description
    s.updated_by_id = admin.id
    await db.flush()
    await audit.record(db, "admin.setting_updated", actor=admin, target_type="system_setting", target_id=s.id, request=request, meta={"key": key, "before": before, "after": data.value})
    await db.commit()
    await db.refresh(s)
    return {"id": str(s.id), "key": s.key, "value": s.value, "description": s.description, "updated_at": _iso(s.updated_at)}


# ================================================================== global search (⌘K)

@router.get("/search")
async def search(db: DB, q: str = Query(min_length=2, max_length=100)):
    like = f"%{q}%"
    orgs = (await db.scalars(select(Organization).where(Organization.deleted_at.is_(None), or_(Organization.name.ilike(like), Organization.slug.ilike(like))).limit(6))).all()
    users = (await db.scalars(select(User).where(User.deleted_at.is_(None), or_(User.email.ilike(like), User.full_name.ilike(like))).limit(6))).all()
    tickets = (await db.scalars(select(SupportTicket).where(or_(SupportTicket.subject.ilike(like), cast(SupportTicket.id, String).ilike(like))).limit(5))).all()
    return {
        "organizations": [{"id": str(o.id), "name": o.name, "status": o.status} for o in orgs],
        "users": [{"id": str(u.id), "name": u.full_name, "email": u.email} for u in users],
        "tickets": [{"id": str(t.id), "subject": t.subject, "status": t.status} for t in tickets],
    }
