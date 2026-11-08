"""Consent ledger helpers. The latest record per (customer, channel, type) wins."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Customer, CustomerConsent
from app.models.enums import ConsentStatus, ConsentType


async def record_consent(
    db: AsyncSession, customer: Customer, channel: str, consent_type: str, status: str, source: str,
    evidence: dict | None = None, recorded_by_id: uuid.UUID | None = None,
) -> CustomerConsent:
    entry = CustomerConsent(
        organization_id=customer.organization_id, customer_id=customer.id, channel=channel, consent_type=consent_type,
        status=status, source=source, evidence=evidence or {}, recorded_by_id=recorded_by_id,
    )
    db.add(entry)
    await db.flush()
    return entry


async def consent_map(db: AsyncSession, customer_ids: list[uuid.UUID], consent_type: str = ConsentType.TRANSACTIONAL) -> dict[uuid.UUID, dict[str, bool]]:
    if not customer_ids:
        return {}
    rows = (
        await db.execute(
            select(CustomerConsent.customer_id, CustomerConsent.channel, CustomerConsent.status)
            .where(CustomerConsent.customer_id.in_(customer_ids), CustomerConsent.consent_type == consent_type)
            .order_by(CustomerConsent.created_at.asc(), CustomerConsent.id)
        )
    ).all()
    out: dict[uuid.UUID, dict[str, bool]] = {}
    for cid, channel, status in rows:
        out.setdefault(cid, {})[channel] = status == ConsentStatus.GRANTED
    return out


async def can_message(db: AsyncSession, customer: Customer, channel: str) -> tuple[bool, str | None]:
    if customer.deleted_at is not None:
        return False, "customer_deleted"
    if customer.opted_out_at is not None:
        return False, "opted_out"
    if channel in ("whatsapp", "sms") and not customer.phone:
        return False, "no_phone"
    if channel == "email" and not customer.email:
        return False, "no_email"
    consents = (await consent_map(db, [customer.id])).get(customer.id, {})
    if not consents.get(channel):
        return False, "no_consent"
    return True, None
