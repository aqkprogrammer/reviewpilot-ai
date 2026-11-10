"""Service recovery API: case queue, detail, outreach log, resolution, SLA summary and settings.

reviews.read  → view (location-scoped members only see their locations)
reviews.reply → act on cases
settings.manage → recovery settings (thresholds, SLA hours, WhatsApp alert numbers)
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import aliased

from app.core.deps import DB, OrgContext, require_perm
from app.core.errors import AppError, Conflict, NotFound
from app.core.permissions import Perm, has_permission
from app.core.security import now
from app.models import Customer, FeedbackSubmission, Location, OrganizationMember, RecoveryCase, Review, User
from app.schemas.common import Page
from app.services import audit
from app.services import recovery as svc
from app.services.consent import consent_map
from app.services.locations import scoped_location_filter

router = APIRouter(prefix="/recovery", tags=["recovery"])

E164 = re.compile(r"^\+[1-9]\d{7,14}$")


# ------------------------------------------------------------------ schemas


class SlaHours(BaseModel):
    critical: int = Field(4, ge=1, le=168)
    high: int = Field(24, ge=1, le=336)
    medium: int = Field(48, ge=1, le=720)

    @model_validator(mode="after")
    def _ordered(self):
        if not (self.critical <= self.high <= self.medium):
            raise ValueError("SLA hours must increase from critical to high to medium")
        return self


class RecoverySettings(BaseModel):
    enabled: bool = True
    review_max_rating: int = Field(2, ge=1, le=4)
    feedback_max_rating: int = Field(2, ge=1, le=4)
    feedback_negative: bool = True
    review_max_age_days: int = Field(7, ge=1, le=90)
    sla_hours: SlaHours = Field(default_factory=SlaHours)
    alert_whatsapp: list[str] = Field(default_factory=list, max_length=5)
    whatsapp_template: str = Field("recovery_alert", min_length=1, max_length=128, pattern=r"^[a-z0-9_]+$")

    @field_validator("alert_whatsapp")
    @classmethod
    def _e164(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for raw in v:
            num = re.sub(r"[\s().-]", "", raw or "")
            if not E164.match(num):
                raise ValueError(f"“{raw}” is not a valid E.164 number (e.g. +919876543210)")
            if num not in out:
                out.append(num)
        return out


class SettingsOut(RecoverySettings):
    whatsapp_channel: dict


class CaseItem(BaseModel):
    id: uuid.UUID
    title: str
    summary: str | None
    source: str
    severity: str
    status: str
    location_id: uuid.UUID | None
    location_name: str | None
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    review_id: uuid.UUID | None
    feedback_id: uuid.UUID | None
    rating: int | None
    customer_name: str | None
    due_at: datetime | None
    first_response_at: datetime | None
    resolved_at: datetime | None
    resolution: str | None
    created_at: datetime
    breached: bool
    sla_missed: bool
    is_demo: bool


class LinkedReview(BaseModel):
    id: uuid.UUID
    source: str
    rating: int
    comment: str | None
    reviewer_name: str | None
    review_created_at: datetime
    response_status: str
    platform_reply: str | None


class LinkedFeedback(BaseModel):
    id: uuid.UUID
    rating: int | None
    message: str
    name: str | None
    channel: str
    sentiment: str | None
    language: str
    created_at: datetime


class ContactInfo(BaseModel):
    name: str | None
    email: str | None
    phone: str | None
    customer_id: uuid.UUID | None
    consent_contact: bool  # explicit "you may contact me about this feedback"
    consents: dict[str, bool]  # transactional consent ledger per channel
    opted_out: bool
    can_contact: bool
    suggested_message: str
    suggested_email: str


class CaseDetail(CaseItem):
    timeline: list[dict]
    review: LinkedReview | None
    feedback: LinkedFeedback | None
    contact: ContactInfo | None
    sla_hours: int
    can_act: bool


class CaseCreate(BaseModel):
    review_id: uuid.UUID | None = None
    feedback_id: uuid.UUID | None = None
    title: str | None = Field(None, min_length=3, max_length=255)
    summary: str | None = Field(None, max_length=2000)
    location_id: uuid.UUID | None = None
    severity: Literal["critical", "high", "medium"] | None = None
    assignee_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _one_source(self):
        if self.review_id and self.feedback_id:
            raise ValueError("Link a case to a review or to feedback, not both")
        if not self.review_id and not self.feedback_id and not self.title:
            raise ValueError("A title is required for a manual case")
        return self


class CaseUpdate(BaseModel):
    status: Literal["open", "in_progress", "contacted", "closed"] | None = None
    severity: Literal["critical", "high", "medium"] | None = None
    assignee_id: uuid.UUID | None = None
    unassign: bool = False


class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class ContactIn(BaseModel):
    channel: Literal["call", "whatsapp", "email", "sms"]
    outcome: Literal["reached", "no_answer", "left_message", "message_sent"] | None = None
    note: str | None = Field(None, max_length=2000)


class ResolveIn(BaseModel):
    resolution: Literal["resolved_happy", "resolved_neutral", "unreachable", "not_actionable"]
    note: str | None = Field(None, max_length=2000)


class ReopenIn(BaseModel):
    note: str | None = Field(None, max_length=2000)


class Summary(BaseModel):
    open: int
    breached: int
    due_today: int
    resolved_7d: int
    median_first_response_hours: float | None


class Assignee(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_you: bool


# ------------------------------------------------------------------ helpers

STATUS_LABEL = {"open": "Open", "in_progress": "In progress", "contacted": "Contacted", "resolved": "Resolved", "closed": "Closed"}
RESOLUTION_LABEL = {"resolved_happy": "Resolved — customer satisfied", "resolved_neutral": "Resolved — acknowledged", "unreachable": "Customer unreachable", "not_actionable": "Not actionable"}


def _base_conds(ctx: OrgContext) -> list:
    return [RecoveryCase.organization_id == ctx.org_id, scoped_location_filter(ctx, RecoveryCase.location_id)]


def _breached_expr(at: datetime):
    marked = RecoveryCase.timeline.contains([{"event": "sla_breached"}])
    return and_(
        RecoveryCase.status.in_(svc.CLOCK_STATUSES),
        or_(and_(RecoveryCase.due_at.is_not(None), RecoveryCase.due_at < at), and_(marked, RecoveryCase.first_response_at.is_(None))),
    )


async def _get_case(db, ctx: OrgContext, case_id: uuid.UUID, *, lock: bool = False) -> RecoveryCase:
    stmt = select(RecoveryCase).where(RecoveryCase.id == case_id)
    if lock:
        stmt = stmt.with_for_update()
    c = await db.scalar(stmt)
    if c is None or c.organization_id != ctx.org_id or not ctx.can_access_location(c.location_id):
        raise NotFound("Recovery case not found")
    return c


def _actor(ctx: OrgContext) -> dict:
    return {"by": ctx.user.full_name, "by_id": ctx.user.id}


async def _item_rows(db, conds: list, *, order=None, offset: int = 0, limit: int | None = None):
    Assignee_ = aliased(User)
    stmt = (
        select(RecoveryCase, Location.name, Assignee_.full_name, Review.rating, Review.reviewer_name, Review.source, FeedbackSubmission.rating, FeedbackSubmission.name)
        .outerjoin(Location, Location.id == RecoveryCase.location_id)
        .outerjoin(Assignee_, Assignee_.id == RecoveryCase.assignee_id)
        .outerjoin(Review, Review.id == RecoveryCase.review_id)
        .outerjoin(FeedbackSubmission, FeedbackSubmission.id == RecoveryCase.feedback_id)
        .where(*conds)
    )
    if order is not None:
        stmt = stmt.order_by(*order)
    if offset:
        stmt = stmt.offset(offset)
    if limit:
        stmt = stmt.limit(limit)
    return (await db.execute(stmt)).all()


def _to_item(row, at: datetime) -> CaseItem:
    c, loc_name, assignee_name, r_rating, r_name, r_source, f_rating, f_name = row
    return CaseItem(
        id=c.id, title=c.title, summary=c.summary, source=c.source, severity=c.severity, status=c.status, location_id=c.location_id, location_name=loc_name,
        assignee_id=c.assignee_id, assignee_name=assignee_name, review_id=c.review_id, feedback_id=c.feedback_id,
        rating=r_rating if r_rating is not None else f_rating, customer_name=r_name or f_name, due_at=c.due_at, first_response_at=c.first_response_at,
        resolved_at=c.resolved_at, resolution=c.resolution, created_at=c.created_at, breached=svc.is_breached(c, at), sla_missed=svc.sla_missed(c),
        is_demo=r_source == "demo" or any(e.get("event") == "demo_seeded" for e in c.timeline or []),
    )


async def _detail(db, ctx: OrgContext, c: RecoveryCase) -> CaseDetail:
    at = now()
    rows = await _item_rows(db, [RecoveryCase.id == c.id])
    item = _to_item(rows[0], at)
    review = await db.get(Review, c.review_id) if c.review_id else None
    fb = await db.get(FeedbackSubmission, c.feedback_id) if c.feedback_id else None
    customer_id = c.customer_id or (fb.customer_id if fb else None)
    customer = await db.get(Customer, customer_id) if customer_id else None
    if customer is not None and customer.deleted_at is not None:
        customer = None
    contact = None
    name = (customer.name if customer else None) or (fb.name if fb else None)
    email = (fb.email if fb else None) or (customer.email if customer else None)
    phone = (fb.phone if fb else None) or (customer.phone if customer else None)
    if (fb is not None or customer is not None) and (email or phone):
        consents = (await consent_map(db, [customer.id])).get(customer.id, {}) if customer else {}
        opted_out = bool(customer and customer.opted_out_at)
        consent_contact = bool(fb and fb.consent_contact)
        contact = ContactInfo(
            name=name, email=email, phone=phone, customer_id=customer.id if customer else None, consent_contact=consent_contact, consents=consents,
            opted_out=opted_out, can_contact=(consent_contact or any(consents.values())) and bool(email or phone) and not opted_out,
            suggested_message=svc.suggested_message(customer_name=name, business=ctx.organization.name, channel="whatsapp"),
            suggested_email=svc.suggested_message(customer_name=name, business=ctx.organization.name, channel="email"),
        )
    return CaseDetail(
        **item.model_dump(), timeline=list(c.timeline or []),
        review=LinkedReview.model_validate(review, from_attributes=True) if review else None,
        feedback=LinkedFeedback.model_validate(fb, from_attributes=True) if fb else None,
        contact=contact, sla_hours=svc.sla_hours_for(svc.get_settings(ctx.organization), c.severity), can_act=ctx.can(Perm.REVIEWS_REPLY),
    )


async def _check_assignee(db, ctx: OrgContext, user_id: uuid.UUID, location_id: uuid.UUID | None) -> User:
    ok, code = await svc.member_can_be_assigned(db, ctx.org_id, user_id, location_id)
    if not ok:
        msg = "The assignee must be a member of this organization." if code == "assignee_not_member" else "That team member doesn't have access to this case's location."
        raise AppError(msg, code=code, status_code=422)
    return await db.get(User, user_id)


# ------------------------------------------------------------------ read


@router.get("/summary", response_model=Summary)
async def summary(db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)), location_id: uuid.UUID | None = None):
    at = now()
    conds = _base_conds(ctx)
    if location_id:
        conds.append(RecoveryCase.location_id == location_id)
    active = RecoveryCase.status.in_(svc.ACTIVE_STATUSES)
    end_today = svc.org_today_end(ctx.organization, at)
    row = (
        await db.execute(
            select(
                func.count().filter(active),
                func.count().filter(_breached_expr(at)),
                func.count().filter(RecoveryCase.status.in_(svc.CLOCK_STATUSES), RecoveryCase.due_at >= at, RecoveryCase.due_at <= end_today),
                func.count().filter(RecoveryCase.status.in_(svc.CLOSED_STATUSES), RecoveryCase.resolved_at >= at - timedelta(days=7)),
            ).where(*conds)
        )
    ).one()
    hours = func.extract("epoch", RecoveryCase.first_response_at - RecoveryCase.created_at) / 3600.0
    median = await db.scalar(
        select(func.percentile_cont(0.5).within_group(hours)).where(*conds, RecoveryCase.first_response_at.is_not(None), RecoveryCase.created_at >= at - timedelta(days=30))
    )
    return Summary(open=row[0], breached=row[1], due_today=row[2], resolved_7d=row[3], median_first_response_hours=round(float(median), 1) if median is not None else None)


@router.get("/settings", response_model=SettingsOut)
async def get_settings(db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    from app.services.campaigns import channel_status

    return SettingsOut(**svc.get_settings(ctx.organization), whatsapp_channel=await channel_status(db, ctx.org_id, "whatsapp"))


@router.put("/settings", response_model=SettingsOut)
async def put_settings(data: RecoverySettings, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    from app.services.campaigns import channel_status

    org = ctx.organization
    before = svc.get_settings(org)
    org.settings = {**(org.settings or {}), "recovery": data.model_dump()}
    changed = sorted(k for k, v in data.model_dump().items() if before.get(k) != v)
    await audit.record(db, "recovery.settings_updated", actor=ctx.user, organization_id=ctx.org_id, target_type="organization", target_id=org.id, request=request,
                       meta={"changed": changed, "alert_numbers": len(data.alert_whatsapp)})
    await db.commit()
    return SettingsOut(**svc.get_settings(org), whatsapp_channel=await channel_status(db, ctx.org_id, "whatsapp"))


@router.get("/assignees", response_model=list[Assignee])
async def assignees(db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)), location_id: uuid.UUID | None = None):
    """Members who can act on recovery cases (optionally: who can access a given location)."""
    allowed = set(await svc.recipients(db, ctx.org_id, location_id)) if location_id else None
    rows = (await db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == ctx.org_id).order_by(User.full_name))).all()
    return [
        Assignee(user_id=u.id, full_name=u.full_name, email=u.email, role=m.role, is_you=u.id == ctx.user.id)
        for m, u in rows
        if has_permission(m.role, Perm.REVIEWS_REPLY) and (allowed is None or u.id in allowed)
    ]


class CaseRef(BaseModel):
    id: uuid.UUID
    status: str
    severity: str
    breached: bool


class Lookup(BaseModel):
    reviews: dict[str, CaseRef]
    feedback: dict[str, CaseRef]


@router.get("/lookup", response_model=Lookup)
async def lookup(
    db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)),
    review_id: list[uuid.UUID] | None = Query(None, max_length=100), feedback_id: list[uuid.UUID] | None = Query(None, max_length=100),
):
    """Which of these reviews / feedback items already have a recovery case (for inbox badges)."""
    at = now()
    out = Lookup(reviews={}, feedback={})
    if not review_id and not feedback_id:
        return out
    links = []
    if review_id:
        links.append(RecoveryCase.review_id.in_(review_id))
    if feedback_id:
        links.append(RecoveryCase.feedback_id.in_(feedback_id))
    rows = (await db.scalars(select(RecoveryCase).where(*_base_conds(ctx), or_(*links)))).all()
    for c in rows:
        ref = CaseRef(id=c.id, status=c.status, severity=c.severity, breached=svc.is_breached(c, at))
        if c.review_id:
            out.reviews[str(c.review_id)] = ref
        if c.feedback_id:
            out.feedback[str(c.feedback_id)] = ref
    return out


@router.get("", response_model=Page[CaseItem])
async def list_cases(
    db: DB,
    ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern="^(active|breached|open|in_progress|contacted|resolved|closed|all)$"),
    severity: str | None = Query(None, pattern="^(critical|high|medium)$"),
    location_id: uuid.UUID | None = None,
    assignee: str | None = Query(None, max_length=40, description="'me', 'unassigned' or a user id"),
    review_id: uuid.UUID | None = None,
    feedback_id: uuid.UUID | None = None,
    q: str | None = Query(None, max_length=200),
    sort: str = Query("due", pattern="^(due|newest|oldest|severity)$"),
):
    at = now()
    conds = _base_conds(ctx)
    if status == "active":
        conds.append(RecoveryCase.status.in_(svc.ACTIVE_STATUSES))
    elif status == "breached":
        conds.append(_breached_expr(at))
    elif status and status != "all":
        conds.append(RecoveryCase.status == status)
    if severity:
        conds.append(RecoveryCase.severity == severity)
    if location_id:
        conds.append(RecoveryCase.location_id == location_id)
    if assignee == "me":
        conds.append(RecoveryCase.assignee_id == ctx.user.id)
    elif assignee == "unassigned":
        conds.append(RecoveryCase.assignee_id.is_(None))
    elif assignee:
        try:
            conds.append(RecoveryCase.assignee_id == uuid.UUID(assignee))
        except ValueError:
            raise AppError("Invalid assignee filter", code="validation_error", status_code=422)
    if review_id:
        conds.append(RecoveryCase.review_id == review_id)
    if feedback_id:
        conds.append(RecoveryCase.feedback_id == feedback_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(RecoveryCase.title.ilike(like), RecoveryCase.summary.ilike(like), Review.reviewer_name.ilike(like), FeedbackSubmission.name.ilike(like)))

    count_stmt = (
        select(func.count()).select_from(RecoveryCase)
        .outerjoin(Review, Review.id == RecoveryCase.review_id)
        .outerjoin(FeedbackSubmission, FeedbackSubmission.id == RecoveryCase.feedback_id)
        .where(*conds)
    )
    total = await db.scalar(count_stmt) or 0
    closed_last = case((RecoveryCase.status.in_(svc.CLOSED_STATUSES), 1), else_=0)
    sev_rank = case((RecoveryCase.severity == "critical", 0), (RecoveryCase.severity == "high", 1), else_=2)
    order = {
        "due": [closed_last, case((RecoveryCase.status.in_(svc.CLOCK_STATUSES), 0), else_=1), RecoveryCase.due_at.asc().nulls_last(), RecoveryCase.created_at.desc()],
        "newest": [RecoveryCase.created_at.desc()],
        "oldest": [RecoveryCase.created_at.asc()],
        "severity": [closed_last, sev_rank, RecoveryCase.due_at.asc().nulls_last()],
    }[sort] + [RecoveryCase.id]
    rows = await _item_rows(db, conds, order=order, offset=(page - 1) * page_size, limit=page_size)
    return Page.build([_to_item(r, at) for r in rows], total, page, page_size)


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(case_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ))):
    return await _detail(db, ctx, await _get_case(db, ctx, case_id))


# ------------------------------------------------------------------ act


@router.post("", response_model=CaseDetail, status_code=201)
async def create_case(data: CaseCreate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    review = fb = None
    if data.review_id:
        review = await db.get(Review, data.review_id)
        if review is None or review.organization_id != ctx.org_id or not ctx.can_access_location(review.location_id):
            raise NotFound("Review not found")
        existing = await svc._existing_case(db, review_id=review.id)
    elif data.feedback_id:
        fb = await db.get(FeedbackSubmission, data.feedback_id)
        if fb is None or fb.organization_id != ctx.org_id or not ctx.can_access_location(fb.location_id):
            raise NotFound("Feedback not found")
        existing = await svc._existing_case(db, feedback_id=fb.id)
    else:
        existing = None
        if data.location_id:
            loc = await db.get(Location, data.location_id)
            if loc is None or loc.organization_id != ctx.org_id or loc.deleted_at is not None:
                raise NotFound("Location not found")
        ctx.ensure_location(data.location_id)
    if existing is not None:
        raise Conflict("A recovery case already exists for this item.", code="case_exists", details={"case_id": str(existing.id)})
    svc.assert_policy_safe(data.summary)
    location_id = review.location_id if review else fb.location_id if fb else data.location_id
    assignee = await _check_assignee(db, ctx, data.assignee_id, location_id) if data.assignee_id else None
    c = await svc.open_manual(
        db, ctx.organization, actor_name=ctx.user.full_name, actor_id=ctx.user.id, review=review, feedback=fb, title=data.title, summary=data.summary,
        location_id=data.location_id, severity=data.severity, assignee_id=assignee.id if assignee else None,
    )
    if assignee:
        svc.append_timeline(c, svc.timeline_entry("assigned", **_actor(ctx), note=f"Assigned to {assignee.full_name}"))
    await audit.record(db, "recovery.case_created", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request, meta={"source": c.source, "severity": c.severity})
    await db.commit()
    return await _detail(db, ctx, c)


@router.patch("/{case_id}", response_model=CaseDetail)
async def update_case(case_id: uuid.UUID, data: CaseUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    c = await _get_case(db, ctx, case_id, lock=True)
    changes: dict[str, list] = {}
    if data.status and data.status != c.status:
        if c.status in svc.CLOSED_STATUSES and data.status != "closed":
            raise AppError("Reopen the case before changing its status.", code="case_closed", status_code=409)
        changes["status"] = [c.status, data.status]
        svc.append_timeline(c, svc.timeline_entry("status_changed", **_actor(ctx), note=f"{STATUS_LABEL[c.status]} → {STATUS_LABEL[data.status]}"))
        c.status = data.status
        if data.status == "closed":
            c.resolved_at = c.resolved_at or now()
            c.resolution = c.resolution or "not_actionable"
    if data.severity and data.severity != c.severity:
        changes["severity"] = [c.severity, data.severity]
        cfg = svc.get_settings(ctx.organization)
        note = f"Severity {c.severity} → {data.severity}"
        c.severity = data.severity
        if c.status in svc.CLOCK_STATUSES and c.first_response_at is None:
            c.due_at = c.created_at + timedelta(hours=svc.sla_hours_for(cfg, c.severity))
            note += f"; first-response due {svc.sla_hours_for(cfg, c.severity)}h after opening"
        svc.append_timeline(c, svc.timeline_entry("severity_changed", **_actor(ctx), note=note))
    if data.unassign and c.assignee_id is not None:
        changes["assignee"] = [str(c.assignee_id), None]
        c.assignee_id = None
        svc.append_timeline(c, svc.timeline_entry("unassigned", **_actor(ctx), note="Assignee removed"))
    elif data.assignee_id and data.assignee_id != c.assignee_id:
        user = await _check_assignee(db, ctx, data.assignee_id, c.location_id)
        changes["assignee"] = [str(c.assignee_id) if c.assignee_id else None, str(user.id)]
        c.assignee_id = user.id
        svc.append_timeline(c, svc.timeline_entry("assigned", **_actor(ctx), note=f"Assigned to {user.full_name}"))
        if user.id != ctx.user.id:
            from app.services.notify import notify_user

            await notify_user(db, user.id, "recovery.case_opened", "Recovery case assigned to you", c.title, organization_id=ctx.org_id, link=f"/app/recovery?case={c.id}", data={"case_id": str(c.id)})
    if changes:
        await audit.record(db, "recovery.case_updated", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request, meta=changes)
        await db.commit()
    return await _detail(db, ctx, c)


@router.post("/{case_id}/notes", response_model=CaseDetail)
async def add_note(case_id: uuid.UUID, data: NoteIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    c = await _get_case(db, ctx, case_id, lock=True)
    svc.assert_policy_safe(data.note)
    svc.append_timeline(c, svc.timeline_entry("note", **_actor(ctx), note=data.note.strip()))
    await audit.record(db, "recovery.note_added", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request)
    await db.commit()
    return await _detail(db, ctx, c)


@router.post("/{case_id}/contact", response_model=CaseDetail)
async def log_contact(case_id: uuid.UUID, data: ContactIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    """Log an outreach attempt made outside ReviewPilot (a call, a click-to-chat, an email)."""
    c = await _get_case(db, ctx, case_id, lock=True)
    if c.status in svc.CLOSED_STATUSES:
        raise AppError("Reopen the case to log more outreach.", code="case_closed", status_code=409)
    svc.assert_policy_safe(data.note)
    first = c.first_response_at is None
    at = now()
    if first:
        c.first_response_at = at
    if c.status in svc.CLOCK_STATUSES:
        c.status = "contacted"
    sla = ""
    if first and c.due_at:
        sla = " · first response within SLA" if at <= c.due_at else " · first response after SLA"
    svc.append_timeline(c, svc.timeline_entry("contact_logged", **_actor(ctx), channel=data.channel, outcome=data.outcome, first=first or None, note=((data.note or "").strip() or None)))
    if sla:
        svc.append_timeline(c, svc.timeline_entry("first_response", **_actor(ctx), note=f"First outreach via {data.channel}{sla}"))
    await audit.record(db, "recovery.contact_logged", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request, meta={"channel": data.channel, "outcome": data.outcome, "first": first})
    await db.commit()
    return await _detail(db, ctx, c)


@router.post("/{case_id}/resolve", response_model=CaseDetail)
async def resolve_case(case_id: uuid.UUID, data: ResolveIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    c = await _get_case(db, ctx, case_id, lock=True)
    if c.status == "resolved":
        raise AppError("This case is already resolved.", code="case_closed", status_code=409)
    svc.assert_policy_safe(data.note)
    c.status, c.resolution, c.resolved_at = "resolved", data.resolution, now()
    svc.append_timeline(c, svc.timeline_entry("resolved", **_actor(ctx), resolution=data.resolution, note=((data.note or "").strip() or RESOLUTION_LABEL[data.resolution])))
    if c.feedback_id:
        fb = await db.get(FeedbackSubmission, c.feedback_id)
        if fb is not None:
            fb.status = "resolved"
    await audit.record(db, "recovery.case_resolved", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request, meta={"resolution": data.resolution})
    await db.commit()
    return await _detail(db, ctx, c)


@router.post("/{case_id}/reopen", response_model=CaseDetail)
async def reopen_case(case_id: uuid.UUID, request: Request, db: DB, data: ReopenIn | None = None, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    c = await _get_case(db, ctx, case_id, lock=True)
    if c.status not in svc.CLOSED_STATUSES:
        raise AppError("Only resolved or closed cases can be reopened.", code="case_not_closed", status_code=409)
    note = (data.note or "").strip() if data else ""
    svc.assert_policy_safe(note)
    cfg = svc.get_settings(ctx.organization)
    previous = c.resolution
    c.status, c.resolution, c.resolved_at = "open", None, None
    c.due_at = now() + timedelta(hours=svc.sla_hours_for(cfg, c.severity))
    svc.append_timeline(c, svc.timeline_entry("reopened", **_actor(ctx), note=note or f"Reopened (was: {RESOLUTION_LABEL.get(previous or '', previous or 'closed')}). Follow-up due in {svc.sla_hours_for(cfg, c.severity)}h."))
    if c.feedback_id:
        fb = await db.get(FeedbackSubmission, c.feedback_id)
        if fb is not None and fb.status == "resolved":
            fb.status = "in_progress"
    await audit.record(db, "recovery.case_reopened", actor=ctx.user, organization_id=ctx.org_id, target_type="recovery_case", target_id=c.id, request=request)
    await db.commit()
    return await _detail(db, ctx, c)
