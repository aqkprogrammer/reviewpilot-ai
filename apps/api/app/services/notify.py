"""In-app + email notifications respecting per-user preferences."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Perm, has_permission
from app.models import Notification, NotificationPreference, OrganizationMember, User
from app.providers.email import get_email_provider
from app.services import email_templates

# Which permission a member needs to receive each organization notification type.
TYPE_PERMISSION = {
    "review.new": Perm.REVIEWS_READ,
    "feedback.new": Perm.REVIEWS_READ,
    "campaign.completed": Perm.CAMPAIGNS_MANAGE,
    "campaign.failed": Perm.CAMPAIGNS_MANAGE,
    "integration.disconnected": Perm.INTEGRATIONS_MANAGE,
    "billing.payment_succeeded": Perm.BILLING_MANAGE,
    "billing.payment_failed": Perm.BILLING_MANAGE,
    "ai.usage_limit": Perm.AI_USE,
}


async def notify_user(
    db: AsyncSession, user_id: uuid.UUID, type: str, title: str, body: str | None = None, *,
    organization_id: uuid.UUID | None = None, link: str | None = None, data: dict | None = None, send_email: bool = True,
) -> None:
    pref = await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id, NotificationPreference.type == type))
    in_app = pref.in_app if pref else True
    email = pref.email if pref else False
    if in_app:
        db.add(Notification(user_id=user_id, organization_id=organization_id, type=type, title=title, body=body, link=link, data=data or {}))
    if email and send_email:
        user = await db.get(User, user_id)
        if user:
            html, text = email_templates.notification(title, body or "", link)
            await get_email_provider().send(to=user.email, subject=title, html=html, text=text)


async def notify_org(
    db: AsyncSession, organization_id: uuid.UUID, type: str, title: str, body: str | None = None, *,
    link: str | None = None, data: dict | None = None, send_email: bool = True,
) -> int:
    perm = TYPE_PERMISSION.get(type)
    members = (await db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == organization_id))).all()
    count = 0
    for m in members:
        if perm is None or has_permission(m.role, perm):
            await notify_user(db, m.user_id, type, title, body, organization_id=organization_id, link=link, data=data, send_email=send_email)
            count += 1
    return count
