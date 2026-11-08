from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select

from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.errors import AppError, NotFound
from app.core.permissions import Perm
from app.core.security import generate_token, now
from app.models import Campaign, CampaignTemplate, Customer, Location, MessageDelivery, ReviewRequest
from app.models.enums import CampaignStatus, Channel, RequestStatus
from app.schemas.common import ORM, Page
from app.services import audit
from app.services.campaigns import campaign_stats, channel_status, render, tracked_link
from app.services.consent import can_message
from app.services.jobs import enqueue
from app.services.locations import get_location, scoped_location_filter
from app.services.organizations import require_entitlement

router = APIRouter(tags=["campaigns"])

CHANNELS = {c.value for c in Channel}


class TemplateIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    channel: str
    language: str = Field("en", pattern="^(en|hi|hinglish)$")
    subject: str | None = Field(None, max_length=255)
    body: str = Field(min_length=10, max_length=1500)
    provider_template_name: str | None = Field(None, max_length=255)

    @field_validator("channel")
    @classmethod
    def _ch(cls, v):
        if v not in CHANNELS - {"qr"}:
            raise ValueError("Channel must be whatsapp, email or sms")
        return v

    @field_validator("body")
    @classmethod
    def _body(cls, v):
        if "{{link}}" not in v:
            raise ValueError("Message must include the {{link}} placeholder")
        lowered = v.lower()
        for banned in ("discount for", "free gift", "coupon for review", "in exchange for", "5-star", "five star", "5 star"):
            if banned in lowered:
                raise ValueError("Review requests can't incentivise or ask only for positive reviews")
        return v


class TemplateOut(ORM):
    id: uuid.UUID
    name: str
    channel: str
    language: str
    subject: str | None
    body: str
    provider_template_name: str | None
    provider_status: str | None
    is_system: bool
    created_at: datetime


class CampaignIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    location_id: uuid.UUID
    channel: str
    template_id: uuid.UUID | None = None
    message_subject: str | None = Field(None, max_length=255)
    message_body: str | None = Field(None, max_length=1500)
    audience: dict = Field(default_factory=dict)  # {"customer_ids": [...]} | {"tags": [...]} | {}
    schedule_at: datetime | None = None
    reminder_enabled: bool = False
    reminder_after_hours: int = Field(48, ge=12, le=24 * 14)
    max_reminders: int = Field(1, ge=0, le=2)
    launch: bool = False

    @field_validator("channel")
    @classmethod
    def _ch(cls, v):
        if v not in CHANNELS:
            raise ValueError("Unknown channel")
        return v

    @field_validator("message_body")
    @classmethod
    def _body(cls, v):
        if v is not None:
            TemplateIn._body.__func__(TemplateIn, v)  # type: ignore[attr-defined]
        return v


class CampaignUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    template_id: uuid.UUID | None = None
    message_subject: str | None = None
    message_body: str | None = None
    audience: dict | None = None
    schedule_at: datetime | None = None
    reminder_enabled: bool | None = None
    reminder_after_hours: int | None = Field(None, ge=12, le=24 * 14)
    max_reminders: int | None = Field(None, ge=0, le=2)


class CampaignOut(ORM):
    id: uuid.UUID
    name: str
    location_id: uuid.UUID
    location_name: str | None = None
    channel: str
    status: str
    template_id: uuid.UUID | None
    message_subject: str | None
    message_body: str | None
    audience: dict
    schedule_at: datetime | None
    reminder_enabled: bool
    reminder_after_hours: int
    max_reminders: int
    launched_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    stats: dict = {}


class RequestOut(ORM):
    id: uuid.UUID
    channel: str
    status: str
    customer_id: uuid.UUID | None
    customer_name: str | None = None
    recipient: str | None = None
    campaign_id: uuid.UUID | None
    campaign_name: str | None = None
    location_id: uuid.UUID
    sent_at: datetime | None
    delivered_at: datetime | None
    clicked_at: datetime | None
    google_clicked_at: datetime | None
    failed_reason: str | None
    reminders_sent: int
    created_at: datetime


class PreviewIn(BaseModel):
    location_id: uuid.UUID
    channel: str
    body: str
    subject: str | None = None


# ------------------------------------------------------------------ templates

@router.get("/campaigns/templates", response_model=list[TemplateOut])
async def list_templates(ctx: Org, db: DB, channel: str | None = None):
    stmt = select(CampaignTemplate).where(or_(CampaignTemplate.organization_id == ctx.org_id, CampaignTemplate.organization_id.is_(None)), CampaignTemplate.deleted_at.is_(None))
    if channel:
        stmt = stmt.where(CampaignTemplate.channel == channel)
    return (await db.scalars(stmt.order_by(CampaignTemplate.is_system.desc(), CampaignTemplate.created_at))).all()


@router.post("/campaigns/templates", response_model=TemplateOut, status_code=201)
async def create_template(data: TemplateIn, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    tpl = CampaignTemplate(organization_id=ctx.org_id, **data.model_dump(), provider_status="pending_submission" if data.channel == "whatsapp" else None)
    db.add(tpl)
    await db.commit()
    return tpl


@router.patch("/campaigns/templates/{template_id}", response_model=TemplateOut)
async def update_template(template_id: uuid.UUID, data: TemplateIn, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    tpl = await db.get(CampaignTemplate, template_id)
    if tpl is None or tpl.organization_id != ctx.org_id or tpl.deleted_at:
        raise NotFound("Template not found (system templates can't be edited — duplicate it instead)")
    for k, v in data.model_dump().items():
        setattr(tpl, k, v)
    await db.commit()
    return tpl


@router.delete("/campaigns/templates/{template_id}", status_code=204)
async def delete_template(template_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    tpl = await db.get(CampaignTemplate, template_id)
    if tpl is None or tpl.organization_id != ctx.org_id:
        raise NotFound("Template not found")
    tpl.deleted_at = now()
    await db.commit()


@router.post("/campaigns/preview")
async def preview(data: PreviewIn, ctx: Org, db: DB):
    loc = await get_location(db, ctx, data.location_id)
    link = tracked_link(loc, "preview")
    sample = Customer(name="Priya Sharma")
    return {
        "subject": render(data.subject, customer=sample, org=ctx.organization, location=loc, link=link) if data.subject else None,
        "body": render(data.body, customer=sample, org=ctx.organization, location=loc, link=link),
        "link": link,
        "characters": len(render(data.body, customer=sample, org=ctx.organization, location=loc, link=link)),
    }


@router.get("/campaigns/channels")
async def channels(ctx: Org, db: DB):
    return [await channel_status(db, ctx.org_id, c) for c in ("whatsapp", "email", "sms", "qr")]


# ------------------------------------------------------------------ campaigns

async def _get(db, ctx: OrgContext, campaign_id: uuid.UUID) -> Campaign:
    c = await db.get(Campaign, campaign_id)
    if c is None or c.organization_id != ctx.org_id or c.deleted_at is not None:
        raise NotFound("Campaign not found")
    ctx.ensure_location(c.location_id)
    return c


async def _out(db, c: Campaign) -> CampaignOut:
    loc = await db.get(Location, c.location_id)
    return CampaignOut.model_validate(c).model_copy(update={"location_name": loc.name if loc else None, "stats": await campaign_stats(db, c)})


async def _entitle(db, ctx: OrgContext, channel: str) -> None:
    if channel == Channel.WHATSAPP:
        await require_entitlement(db, ctx.org_id, "whatsapp_campaigns", "WhatsApp campaigns")
    status = await channel_status(db, ctx.org_id, channel)
    if not status["ready"]:
        raise AppError(status.get("note") or f"{channel} is not configured", code="channel_not_configured", status_code=409)


@router.get("/campaigns", response_model=Page[CampaignOut])
async def list_campaigns(
    db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: str | None = None, channel: str | None = None, location_id: uuid.UUID | None = None, q: str | None = None,
):
    conds = [Campaign.organization_id == ctx.org_id, Campaign.deleted_at.is_(None), scoped_location_filter(ctx, Campaign.location_id)]
    if status:
        conds.append(Campaign.status == status)
    else:
        conds.append(Campaign.status != CampaignStatus.ARCHIVED)
    if channel:
        conds.append(Campaign.channel == channel)
    if location_id:
        conds.append(Campaign.location_id == location_id)
    if q:
        conds.append(Campaign.name.ilike(f"%{q}%"))
    total = await db.scalar(select(func.count()).select_from(Campaign).where(*conds))
    rows = (await db.scalars(select(Campaign).where(*conds).order_by(Campaign.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return Page.build([await _out(db, c) for c in rows], total or 0, page, page_size)


@router.post("/campaigns", response_model=CampaignOut, status_code=201)
async def create_campaign(data: CampaignIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    await get_location(db, ctx, data.location_id)
    if data.template_id:
        tpl = await db.get(CampaignTemplate, data.template_id)
        if tpl is None or (tpl.organization_id not in (None, ctx.org_id)):
            raise AppError("Invalid template", code="invalid_template")
    c = Campaign(organization_id=ctx.org_id, created_by_id=ctx.user.id, **data.model_dump(exclude={"launch"}), send_window={"start_hour": 9, "end_hour": 20})
    db.add(c)
    await db.flush()
    await audit.record(db, "campaign.created", actor=ctx.user, organization_id=ctx.org_id, target_type="campaign", target_id=c.id, request=request)
    await db.commit()
    if data.launch:
        return await launch(c.id, request, db, ctx)
    return await _out(db, c)


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, ctx: Org, db: DB):
    return await _out(db, await _get(db, ctx, campaign_id))


@router.patch("/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(campaign_id: uuid.UUID, data: CampaignUpdate, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    if c.status not in (CampaignStatus.DRAFT, CampaignStatus.PAUSED, CampaignStatus.SCHEDULED):
        raise AppError("Pause the campaign before editing it.", code="campaign_not_editable")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    await db.commit()
    return await _out(db, c)


@router.post("/campaigns/{campaign_id}/launch", response_model=CampaignOut)
async def launch(campaign_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    if c.status not in (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED):
        raise AppError("Only draft campaigns can be launched.", code="invalid_state")
    await _entitle(db, ctx, c.channel)
    if c.channel != Channel.QR and not (c.message_body or c.template_id):
        raise AppError("Choose a message template first.", code="template_required")
    defer = None
    if c.schedule_at and c.schedule_at > now():
        c.status = CampaignStatus.SCHEDULED
        defer = int((c.schedule_at - now()).total_seconds())
    else:
        c.status = CampaignStatus.ACTIVE
        c.launched_at = now()
    await audit.record(db, "campaign.launched", actor=ctx.user, organization_id=ctx.org_id, target_type="campaign", target_id=c.id, request=request)
    await db.commit()
    if c.channel != Channel.QR and c.status == CampaignStatus.ACTIVE:
        await enqueue("process_campaign", organization_id=ctx.org_id, campaign_id=str(c.id))
    elif c.status == CampaignStatus.SCHEDULED:
        await enqueue("start_scheduled_campaign", organization_id=ctx.org_id, defer_seconds=defer, campaign_id=str(c.id))
    return await _out(db, c)


@router.post("/campaigns/{campaign_id}/pause", response_model=CampaignOut)
async def pause(campaign_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    if c.status not in (CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED):
        raise AppError("Only active or scheduled campaigns can be paused.", code="invalid_state")
    c.status = CampaignStatus.PAUSED
    await audit.record(db, "campaign.paused", actor=ctx.user, organization_id=ctx.org_id, target_type="campaign", target_id=c.id, request=request)
    await db.commit()
    return await _out(db, c)


@router.post("/campaigns/{campaign_id}/resume", response_model=CampaignOut)
async def resume(campaign_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    if c.status != CampaignStatus.PAUSED:
        raise AppError("Campaign is not paused.", code="invalid_state")
    await _entitle(db, ctx, c.channel)
    c.status = CampaignStatus.ACTIVE
    c.launched_at = c.launched_at or now()
    await audit.record(db, "campaign.resumed", actor=ctx.user, organization_id=ctx.org_id, target_type="campaign", target_id=c.id, request=request)
    await db.commit()
    if c.channel != Channel.QR:
        await enqueue("process_campaign", organization_id=ctx.org_id, campaign_id=str(c.id))
    return await _out(db, c)


@router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignOut, status_code=201)
async def duplicate(campaign_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    copy = Campaign(
        organization_id=ctx.org_id, location_id=c.location_id, template_id=c.template_id, created_by_id=ctx.user.id, name=f"{c.name} (copy)"[:160],
        channel=c.channel, message_subject=c.message_subject, message_body=c.message_body, audience=c.audience, send_window=c.send_window,
        reminder_enabled=c.reminder_enabled, reminder_after_hours=c.reminder_after_hours, max_reminders=c.max_reminders,
    )
    db.add(copy)
    await db.commit()
    return await _out(db, copy)


@router.post("/campaigns/{campaign_id}/archive", response_model=CampaignOut)
async def archive(campaign_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    c = await _get(db, ctx, campaign_id)
    c.status = CampaignStatus.ARCHIVED
    c.archived_at = now()
    await audit.record(db, "campaign.archived", actor=ctx.user, organization_id=ctx.org_id, target_type="campaign", target_id=c.id, request=request)
    await db.commit()
    return await _out(db, c)


@router.get("/campaigns/{campaign_id}/requests", response_model=Page[RequestOut])
async def campaign_requests(campaign_id: uuid.UUID, ctx: Org, db: DB, page: int = Query(1, ge=1), page_size: int = Query(25, le=100), status: str | None = None):
    await _get(db, ctx, campaign_id)
    return await _requests_page(db, ctx, page, page_size, status=status, campaign_id=campaign_id)


@router.get("/campaigns/{campaign_id}/timeline")
async def campaign_timeline(campaign_id: uuid.UUID, ctx: Org, db: DB):
    """Daily sent / delivered / failed / clicks for the campaign detail chart."""
    await _get(db, ctx, campaign_id)
    day = func.date_trunc("day", ReviewRequest.created_at)
    rows = (
        await db.execute(
            select(
                day.label("d"), func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.delivered_at.is_not(None)),
                func.count().filter(ReviewRequest.status == RequestStatus.FAILED), func.count().filter(ReviewRequest.clicked_at.is_not(None)),
                func.count().filter(ReviewRequest.google_clicked_at.is_not(None)),
            ).where(ReviewRequest.campaign_id == campaign_id).group_by(day).order_by(day)
        )
    ).all()
    return [{"date": r[0].date().isoformat(), "sent": r[1], "delivered": r[2], "failed": r[3], "clicks": r[4], "google_clicks": r[5]} for r in rows]


# ------------------------------------------------------------------ review requests (one-off sends)

async def _requests_page(db, ctx: OrgContext, page: int, page_size: int, *, status=None, campaign_id=None, channel=None, q=None) -> Page:
    conds = [ReviewRequest.organization_id == ctx.org_id, scoped_location_filter(ctx, ReviewRequest.location_id)]
    if status:
        conds.append(ReviewRequest.status == status)
    if campaign_id:
        conds.append(ReviewRequest.campaign_id == campaign_id)
    if channel:
        conds.append(ReviewRequest.channel == channel)
    base = select(ReviewRequest, Customer, Campaign.name).outerjoin(Customer, Customer.id == ReviewRequest.customer_id).outerjoin(Campaign, Campaign.id == ReviewRequest.campaign_id).where(*conds)
    if q:
        base = base.where(or_(Customer.name.ilike(f"%{q}%"), Customer.phone.ilike(f"%{q}%"), Customer.email.ilike(f"%{q}%")))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(ReviewRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        RequestOut.model_validate(r).model_copy(update={"customer_name": c.name if c else None, "recipient": (c.email if r.channel == "email" else c.phone) if c else None, "campaign_name": cname})
        for r, c, cname in rows
    ]
    return Page.build(items, total or 0, page, page_size)


@router.get("/review-requests", response_model=Page[RequestOut])
async def list_requests(
    db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ)), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    status: str | None = None, channel: str | None = None, q: str | None = None,
):
    return await _requests_page(db, ctx, page, page_size, status=status, channel=channel, q=q)


@router.get("/review-requests/summary")
async def requests_summary(ctx: Org, db: DB):
    conds = [ReviewRequest.organization_id == ctx.org_id, scoped_location_filter(ctx, ReviewRequest.location_id)]
    row = (
        await db.execute(
            select(
                func.count(), func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.delivered_at.is_not(None)),
                func.count().filter(ReviewRequest.status == RequestStatus.FAILED), func.count().filter(ReviewRequest.clicked_at.is_not(None)),
                func.count().filter(ReviewRequest.google_clicked_at.is_not(None)), func.count().filter(ReviewRequest.status == RequestStatus.SKIPPED),
            ).where(*conds)
        )
    ).one()
    return dict(zip(["total", "sent", "delivered", "failed", "clicked", "google_clicked", "skipped"], row))


class SendRequestIn(BaseModel):
    customer_id: uuid.UUID
    location_id: uuid.UUID
    channel: str = Field(pattern="^(whatsapp|email|sms)$")
    message_body: str | None = Field(None, max_length=1500)


@router.post("/review-requests", response_model=RequestOut, status_code=201)
async def send_one(data: SendRequestIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    await get_location(db, ctx, data.location_id)
    customer = await db.get(Customer, data.customer_id)
    if customer is None or customer.organization_id != ctx.org_id or customer.deleted_at:
        raise NotFound("Customer not found")
    await _entitle(db, ctx, data.channel)
    ok, reason = await can_message(db, customer, data.channel)
    if not ok:
        messages = {"no_consent": "This customer hasn't consented to messages on this channel.", "opted_out": "This customer has opted out.", "no_phone": "Customer has no phone number.", "no_email": "Customer has no email address."}
        raise AppError(messages.get(reason or "", "Cannot message this customer."), code=reason or "cannot_message")
    req = ReviewRequest(organization_id=ctx.org_id, location_id=data.location_id, customer_id=customer.id, channel=data.channel, tracking_token=generate_token(18))
    db.add(req)
    await db.flush()
    await audit.record(db, "review_request.sent", actor=ctx.user, organization_id=ctx.org_id, target_type="review_request", target_id=req.id, request=request)
    await db.commit()
    await enqueue("send_review_request", organization_id=ctx.org_id, request_id=str(req.id))
    return RequestOut.model_validate(req).model_copy(update={"customer_name": customer.name})


@router.get("/review-requests/{request_id}/deliveries")
async def request_deliveries(request_id: uuid.UUID, ctx: Org, db: DB):
    req = await db.get(ReviewRequest, request_id)
    if req is None or req.organization_id != ctx.org_id:
        raise NotFound("Request not found")
    rows = (await db.scalars(select(MessageDelivery).where(MessageDelivery.review_request_id == req.id).order_by(MessageDelivery.created_at))).all()
    return [{"id": str(d.id), "provider": d.provider, "status": d.status, "error": d.error_message, "is_reminder": d.is_reminder, "simulated": d.provider == "mock", "created_at": d.created_at.isoformat()} for d in rows]
