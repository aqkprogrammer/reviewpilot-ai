from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk


class Customer(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "customers"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(32))  # E.164
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(48)), default=list, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)  # manual|csv|feedback|demo
    preferred_language: Mapped[str] = mapped_column(String(12), default="en", nullable=False)
    # Global opt-out from all review-request messages (honoured by every channel).
    opted_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_customers_org_created", "organization_id", "created_at"),
        Index("ix_customers_org_email", "organization_id", "email"),
        Index("ix_customers_org_phone", "organization_id", "phone"),
    )


class CustomerConsent(UUIDPk, Timestamps, Base):
    """Consent ledger. Review requests require a granted 'transactional' consent for the channel."""

    __tablename__ = "customer_consents"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)  # whatsapp|email|sms
    consent_type: Mapped[str] = mapped_column(String(16), nullable=False)  # transactional|marketing
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # granted|revoked
    source: Mapped[str] = mapped_column(String(64), nullable=False)  # feedback_form|csv_import|manual|opt_out_link
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # ip, user agent, text shown
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    __table_args__ = (Index("ix_consents_customer_channel", "customer_id", "channel", "consent_type"),)
