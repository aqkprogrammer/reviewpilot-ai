from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update

from app.core.deps import DB, CurrentUser
from app.core.errors import NotFound
from app.core.security import now
from app.models import Announcement, Notification, NotificationPreference, OrganizationMember, Subscription, SubscriptionPlan, SupportMessage, SupportTicket
from app.models.notification import NOTIFICATION_TYPES
from app.schemas.common import ORM, Page

router = APIRouter(tags=["notifications"])


class NotificationOut(ORM):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    link: str | None
    organization_id: uuid.UUID | None
    read_at: datetime | None
    created_at: datetime


@router.get("/notifications", response_model=Page[NotificationOut])
async def list_notifications(user: CurrentUser, db: DB, page: int = Query(1, ge=1), page_size: int = Query(20, le=50), unread: bool = False, organization_id: uuid.UUID | None = None):
    conds = [Notification.user_id == user.id]
    if unread:
        conds.append(Notification.read_at.is_(None))
    if organization_id:
        conds.append(or_(Notification.organization_id == organization_id, Notification.organization_id.is_(None)))
    total = await db.scalar(select(func.count()).select_from(Notification).where(*conds))
    rows = (await db.scalars(select(Notification).where(*conds).order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return Page.build(list(rows), total or 0, page, page_size)


@router.get("/notifications/unread-count")
async def unread_count(user: CurrentUser, db: DB):
    return {"count": await db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)))}


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, user: CurrentUser, db: DB):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise NotFound("Notification not found")
    n.read_at = n.read_at or now()
    await db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all(user: CurrentUser, db: DB):
    await db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)).values(read_at=now()))
    await db.commit()
    return {"ok": True}


class PrefOut(BaseModel):
    type: str
    in_app: bool
    email: bool


@router.get("/notifications/preferences", response_model=list[PrefOut])
async def get_prefs(user: CurrentUser, db: DB):
    from app.services.digest import pref_is_explicit

    rows = {p.type: p for p in (await db.scalars(select(NotificationPreference).where(NotificationPreference.user_id == user.id))).all()}
    # The weekly digest defaults to ON for owners/admins and OFF for other roles until the user
    # makes an explicit choice — show exactly what the digest sender will do.
    leads = bool(await db.scalar(select(OrganizationMember.id).where(OrganizationMember.user_id == user.id, OrganizationMember.role.in_(["owner", "admin"])).limit(1)))
    out = []
    for t in NOTIFICATION_TYPES:
        row = rows.get(t)
        if t == "digest.weekly" and not pref_is_explicit(row, user):
            out.append(PrefOut(type=t, in_app=row.in_app if row else True, email=leads))
        else:
            out.append(PrefOut(type=t, in_app=row.in_app if row else True, email=row.email if row else False))
    return out


@router.put("/notifications/preferences", response_model=list[PrefOut])
async def set_prefs(prefs: list[PrefOut], user: CurrentUser, db: DB):
    existing = {p.type: p for p in (await db.scalars(select(NotificationPreference).where(NotificationPreference.user_id == user.id))).all()}
    for p in prefs:
        if p.type not in NOTIFICATION_TYPES:
            continue
        row = existing.get(p.type) or NotificationPreference(user_id=user.id, type=p.type)
        row.in_app, row.email = p.in_app, p.email
        db.add(row)
    await db.commit()
    return await get_prefs(user, db)


@router.get("/announcements/active")
async def active_announcements(user: CurrentUser, db: DB, organization_id: uuid.UUID | None = None):
    rows = (await db.scalars(select(Announcement).where(Announcement.published_at.is_not(None), or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now()), or_(Announcement.ends_at.is_(None), Announcement.ends_at >= now())).order_by(Announcement.published_at.desc()).limit(10))).all()
    plan_code = None
    member = False
    if organization_id:
        member = bool(await db.scalar(select(OrganizationMember.id).where(OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user.id)))
        if member:
            plan_code = await db.scalar(select(SubscriptionPlan.code).join(Subscription, Subscription.plan_id == SubscriptionPlan.id).where(Subscription.organization_id == organization_id))
    out = []
    for a in rows:
        if a.audience == "organizations" and not (member and str(organization_id) in a.organization_ids):
            continue
        if a.audience == "plans" and plan_code not in a.plan_codes:
            continue
        out.append({"id": str(a.id), "title": a.title, "body": a.body, "level": a.level, "dismissible": a.dismissible, "published_at": a.published_at.isoformat() if a.published_at else None})
    return out


# ------------------------------------------------------------------ support (customer side)

class TicketIn(BaseModel):
    subject: str = Field(min_length=4, max_length=255)
    category: str = Field("general", pattern="^(general|billing|integrations|technical|account|feature_request)$")
    priority: str = Field("normal", pattern="^(low|normal|high|urgent)$")
    message: str = Field(min_length=10, max_length=5000)
    organization_id: uuid.UUID | None = None
    grant_data_access_days: int = Field(0, ge=0, le=14)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.get("/support/tickets")
async def my_tickets(user: CurrentUser, db: DB):
    rows = (await db.scalars(select(SupportTicket).where(SupportTicket.requester_id == user.id).order_by(SupportTicket.updated_at.desc()))).all()
    return [{"id": str(t.id), "subject": t.subject, "status": t.status, "priority": t.priority, "category": t.category, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()} for t in rows]


@router.post("/support/tickets", status_code=201)
async def create_ticket(data: TicketIn, user: CurrentUser, db: DB):
    if data.organization_id:
        member = await db.scalar(select(OrganizationMember.id).where(OrganizationMember.organization_id == data.organization_id, OrganizationMember.user_id == user.id))
        if not member:
            raise NotFound("Organization not found")
    from datetime import timedelta

    t = SupportTicket(
        organization_id=data.organization_id, requester_id=user.id, subject=data.subject, category=data.category, priority=data.priority,
        data_access_granted_until=now() + timedelta(days=data.grant_data_access_days) if data.grant_data_access_days else None,
    )
    db.add(t)
    await db.flush()
    db.add(SupportMessage(ticket_id=t.id, author_id=user.id, body=data.message))
    await db.commit()
    return {"id": str(t.id)}


@router.get("/support/tickets/{ticket_id}")
async def ticket_detail(ticket_id: uuid.UUID, user: CurrentUser, db: DB):
    t = await db.get(SupportTicket, ticket_id)
    if t is None or t.requester_id != user.id:
        raise NotFound("Ticket not found")
    msgs = (await db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == t.id, SupportMessage.is_internal.is_(False)).order_by(SupportMessage.created_at))).all()
    return {"id": str(t.id), "subject": t.subject, "status": t.status, "priority": t.priority, "messages": [{"id": str(m.id), "body": m.body, "from_staff": m.is_from_staff, "created_at": m.created_at.isoformat()} for m in msgs]}


@router.post("/support/tickets/{ticket_id}/messages", status_code=201)
async def reply_ticket(ticket_id: uuid.UUID, data: MessageIn, user: CurrentUser, db: DB):
    t = await db.get(SupportTicket, ticket_id)
    if t is None or t.requester_id != user.id:
        raise NotFound("Ticket not found")
    db.add(SupportMessage(ticket_id=t.id, author_id=user.id, body=data.body))
    if t.status in ("resolved", "pending"):
        t.status = "open"
    await db.commit()
    return {"ok": True}
