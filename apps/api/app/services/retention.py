"""Data retention.

Deleted organizations get a 30-day grace window (owners can ask support to restore).
After that, `purge_deleted_organizations` erases all customer and operational data and
scrubs the organization row into an anonymous tombstone.

Retained on purpose (legal / integrity):
  * payments + invoices — statutory tax records (India: GST invoices retained for 6+ years);
  * audit_logs — append-only by design (enforced by a DB trigger);
  * the tombstoned organization row, so the records above keep a valid foreign key.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import now
from app.models import (
    AIGeneration,
    AIInsight,
    AIUsage,
    Campaign,
    CampaignTemplate,
    Customer,
    FeedbackSubmission,
    GoogleAccount,
    GoogleConnection,
    IntegrationCredential,
    Invitation,
    Location,
    Notification,
    Organization,
    OrganizationMember,
    QRCode,
    Review,
    ReviewRequest,
    Subscription,
)
from app.models.enums import SubscriptionStatus
from app.services import audit

log = logging.getLogger("reviewpilot.retention")
GRACE_DAYS = 30

# Order matters only for readability; child rows cascade from these parents.
_ORG_SCOPED = (
    ReviewRequest,  # → message_deliveries (cascade)
    FeedbackSubmission,
    Review,  # → review_replies (cascade)
    AIGeneration,
    AIInsight,
    AIUsage,
    Campaign,
    CampaignTemplate,
    QRCode,  # → qr_scans (cascade)
    Customer,  # → customer_consents (cascade)
    Notification,
    Invitation,
    IntegrationCredential,
    OrganizationMember,  # → location_members (cascade)
)


async def purge_organization(db: AsyncSession, org: Organization) -> dict:
    org_id = org.id
    counts: dict[str, int] = {}
    # Locations reference google_accounts; clear that link before removing Google data.
    await db.execute(update(Location).where(Location.organization_id == org_id).values(google_account_id=None))
    for model in _ORG_SCOPED:
        res = await db.execute(delete(model).where(model.organization_id == org_id))
        counts[model.__tablename__] = res.rowcount or 0
    for model in (GoogleAccount, GoogleConnection, Location):
        res = await db.execute(delete(model).where(model.organization_id == org_id))
        counts[model.__tablename__] = res.rowcount or 0

    sub = await db.scalar(select(Subscription).where(Subscription.organization_id == org_id))
    if sub is not None and sub.status not in (SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED):
        sub.status = SubscriptionStatus.CANCELED
        sub.canceled_at = sub.canceled_at or now()
    if sub is not None:
        sub.pending_checkout = {}

    short = org_id.hex[:8]
    org.name = "Deleted organization"
    org.slug = f"deleted-{short}"
    org.description = org.website = org.phone = org.email = org.address = org.logo_url = None
    org.onboarding_data = {}
    org.white_label = {}
    org.settings = {"purged_at": now().isoformat()}
    await audit.record(db, "organization.purged", organization_id=org_id, target_type="organization", target_id=org_id, meta={"deleted": counts}, actor_type="system")
    await db.commit()
    return counts


async def purge_deleted_organizations(db: AsyncSession, grace_days: int = GRACE_DAYS) -> dict:
    cutoff = now() - timedelta(days=grace_days)
    orgs = (
        await db.scalars(select(Organization).where(Organization.deleted_at.is_not(None), Organization.deleted_at < cutoff))
    ).all()
    purged = 0
    for org in orgs:
        if (org.settings or {}).get("purged_at"):
            continue
        try:
            await purge_organization(db, org)
            purged += 1
        except Exception:  # noqa: BLE001 — one tenant's failure must not block others
            await db.rollback()
            log.exception("Failed to purge organization %s", org.id)
    return {"candidates": len(orgs), "purged": purged}

