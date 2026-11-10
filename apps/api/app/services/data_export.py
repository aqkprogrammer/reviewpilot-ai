"""Data-portability exports (DPDP Act 2023 / GDPR Art. 20).

* Organization export — everything the business owns, as a ZIP of CSV files plus a JSON
  manifest. Secrets (OAuth tokens, API keys, password hashes) are never included.
* Personal export — what ReviewPilot holds about one user account, as JSON.
"""

from __future__ import annotations

import csv
import io
import json
import uuid
import zipfile
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import now
from app.models import (
    AuditLog,
    AuthSession,
    Campaign,
    CampaignTemplate,
    Customer,
    CustomerConsent,
    FeedbackSubmission,
    Invoice,
    Location,
    MessageDelivery,
    Notification,
    Organization,
    OrganizationMember,
    Payment,
    QRCode,
    Review,
    ReviewReply,
    ReviewRequest,
    Subscription,
    User,
)

# Columns that must never leave the system.
_SECRET_COLUMNS = {"password_hash", "token_hash", "previous_token_hash", "access_token_enc", "refresh_token_enc", "secrets_enc", "raw"}


def _plain(v: Any) -> Any:
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, datetime | date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, list | dict):
        return json.dumps(v, ensure_ascii=False, default=str)
    return v


def _rows(objs: list[Any]) -> tuple[list[str], list[dict]]:
    if not objs:
        return [], []
    cols = [c.key for c in objs[0].__table__.columns if c.key not in _SECRET_COLUMNS]
    return cols, [{c: _plain(getattr(o, c)) for c in cols} for o in objs]


def _csv(cols: list[str], rows: list[dict]) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols or ["empty"])
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue().encode("utf-8-sig")


async def organization_export(db: AsyncSession, org: Organization) -> bytes:
    oid = org.id
    review_ids = select(Review.id).where(Review.organization_id == oid)
    request_ids = select(ReviewRequest.id).where(ReviewRequest.organization_id == oid)
    members = (
        await db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == oid))
    ).all()
    tables: dict[str, list[Any]] = {
        "locations": list((await db.scalars(select(Location).where(Location.organization_id == oid))).all()),
        "reviews": list((await db.scalars(select(Review).where(Review.organization_id == oid))).all()),
        "review_replies": list((await db.scalars(select(ReviewReply).where(ReviewReply.review_id.in_(review_ids)))).all()),
        "customers": list((await db.scalars(select(Customer).where(Customer.organization_id == oid, Customer.deleted_at.is_(None)))).all()),
        "customer_consents": list((await db.scalars(select(CustomerConsent).where(CustomerConsent.organization_id == oid))).all()),
        "feedback": list((await db.scalars(select(FeedbackSubmission).where(FeedbackSubmission.organization_id == oid))).all()),
        "campaigns": list((await db.scalars(select(Campaign).where(Campaign.organization_id == oid))).all()),
        "message_templates": list((await db.scalars(select(CampaignTemplate).where(CampaignTemplate.organization_id == oid))).all()),
        "review_requests": list((await db.scalars(select(ReviewRequest).where(ReviewRequest.organization_id == oid))).all()),
        "message_deliveries": list((await db.scalars(select(MessageDelivery).where(MessageDelivery.review_request_id.in_(request_ids)))).all()),
        "qr_codes": list((await db.scalars(select(QRCode).where(QRCode.organization_id == oid))).all()),
        "subscription": list((await db.scalars(select(Subscription).where(Subscription.organization_id == oid))).all()),
        "payments": list((await db.scalars(select(Payment).where(Payment.organization_id == oid))).all()),
        "invoices": list((await db.scalars(select(Invoice).where(Invoice.organization_id == oid))).all()),
        "audit_log": list((await db.scalars(select(AuditLog).where(AuditLog.organization_id == oid).order_by(AuditLog.created_at))).all()),
    }
    buf = io.BytesIO()
    manifest: dict[str, Any] = {
        "generated_at": now().isoformat(),
        "organization": {c: v for c, v in _rows([org])[1][0].items()},
        "members": [{"name": u.full_name, "email": u.email, "role": m.role, "joined_at": m.created_at.isoformat()} for m, u in members],
        "files": {},
        "notes": "Secrets (OAuth tokens, API keys, password hashes) are intentionally excluded.",
    }
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, objs in tables.items():
            cols, rows = _rows(objs)
            z.writestr(f"{name}.csv", _csv(cols, rows))
            manifest["files"][f"{name}.csv"] = len(rows)
        z.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False, default=str))
    return buf.getvalue()


async def personal_export(db: AsyncSession, user: User) -> dict:
    memberships = (
        await db.execute(select(OrganizationMember, Organization).join(Organization, Organization.id == OrganizationMember.organization_id).where(OrganizationMember.user_id == user.id))
    ).all()
    sessions = (await db.scalars(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.created_at.desc()))).all()
    notifications = (await db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(500))).all()
    activity = (
        await db.scalars(select(AuditLog).where(or_(AuditLog.actor_id == user.id, AuditLog.target_id == str(user.id))).order_by(AuditLog.created_at.desc()).limit(1000))
    ).all()
    profile = _rows([user])[1][0]
    return {
        "generated_at": now().isoformat(),
        "profile": profile,
        "memberships": [{"organization": o.name, "role": m.role, "since": m.created_at.isoformat()} for m, o in memberships],
        "sessions": [{"created_at": s.created_at.isoformat(), "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None, "ip_address": s.ip_address, "user_agent": s.user_agent, "revoked_at": s.revoked_at.isoformat() if s.revoked_at else None} for s in sessions],
        "notifications": [{"type": n.type, "title": n.title, "created_at": n.created_at.isoformat()} for n in notifications],
        "activity": [{"action": a.action, "at": a.created_at.isoformat(), "ip_address": a.ip_address, "meta": a.meta} for a in activity],
    }
