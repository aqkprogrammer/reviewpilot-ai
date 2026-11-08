from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk
from app.models.enums import CampaignStatus, RequestStatus


class CampaignTemplate(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "campaign_templates"

    # NULL organization_id → system template available to all organizations.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    language: Mapped[str] = mapped_column(String(12), default="en", nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # WhatsApp: name of the approved Meta template + approval status reported by Meta.
    provider_template_name: Mapped[str | None] = mapped_column(String(255))
    provider_status: Mapped[str | None] = mapped_column(String(32))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Campaign(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "campaigns"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaign_templates.id", ondelete="SET NULL"))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=CampaignStatus.DRAFT, nullable=False)
    message_subject: Mapped[str | None] = mapped_column(String(255))
    message_body: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # {customer_ids|tags|all}
    schedule_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    send_window: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # {start_hour,end_hour}
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_after_hours: Mapped[int] = mapped_column(Integer, default=48, nullable=False)
    max_reminders: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    launched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # denormalized counters cache

    __table_args__ = (Index("ix_campaigns_org_status", "organization_id", "status"),)


class ReviewRequest(UUIDPk, Timestamps, Base):
    __tablename__ = "review_requests"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=RequestStatus.QUEUED, nullable=False)
    # Opaque token used in the tracked first-party link: /r/{slug}?t={token}
    tracking_token: Mapped[str] = mapped_column(String(48), unique=True, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # opened feedback page
    google_clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # clicked "Review on Google"
    failed_reason: Mapped[str | None] = mapped_column(Text)
    reminders_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    __table_args__ = (
        Index("ix_review_requests_org_created", "organization_id", "created_at"),
        Index("ix_review_requests_org_status", "organization_id", "status"),
    )


class MessageDelivery(UUIDPk, Timestamps, Base):
    __tablename__ = "message_deliveries"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    review_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("review_requests.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # whatsapp_cloud|resend|twilio|mock
    provider_message_id: Mapped[str | None] = mapped_column(String(255), index=True)
    recipient: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_reminder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    events: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
