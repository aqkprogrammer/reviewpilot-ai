"""Growth features: post-visit automations (API keys, rules, visit events) and service recovery."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk

# ------------------------------------------------------------------ automations


class ApiKey(UUIDPk, Timestamps, Base):
    """Organization API key for inbound integrations (POS, booking, Zapier). Stored hashed;
    the full secret is shown once at creation. `prefix` identifies the key in the UI."""

    __tablename__ = "api_keys"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    scopes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # e.g. ["visits:write"]
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AutomationRule(UUIDPk, Timestamps, Base):
    """When a visit is recorded, send a review request after `delay_minutes`, respecting
    quiet hours, a per-customer cooldown and recorded consent."""

    __tablename__ = "automation_rules"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True)  # NULL = all locations
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    trigger: Mapped[str] = mapped_column(String(32), default="visit", nullable=False)
    channel: Mapped[str] = mapped_column(String(16), default="whatsapp", nullable=False)  # whatsapp|email|sms|auto
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaign_templates.id", ondelete="SET NULL"))
    message_body: Mapped[str | None] = mapped_column(Text)
    delay_minutes: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    quiet_hours: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # {"start": 21, "end": 9} local time
    cooldown_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class VisitEvent(UUIDPk, Timestamps, Base):
    """A real-world visit/order/appointment reported by an integration or a team member."""

    __tablename__ = "visit_events"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("automation_rules.id", ondelete="SET NULL"))
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # api|shopify|manual|zapier
    external_id: Mapped[str | None] = mapped_column(String(160))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(16), default="received", nullable=False)  # received|scheduled|sent|skipped|failed
    skip_reason: Mapped[str | None] = mapped_column(String(64))
    review_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("review_requests.id", ondelete="SET NULL"))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        UniqueConstraint("organization_id", "source", "external_id", name="uq_visit_event_external"),
        Index("ix_visit_events_org_created", "organization_id", "created_at"),
        Index("ix_visit_events_due", "status", "scheduled_for"),
    )


# ------------------------------------------------------------------ service recovery


class RecoveryCase(UUIDPk, Timestamps, Base):
    """A tracked follow-up for an unhappy customer: opened automatically from a low-rated
    review or negative private feedback (or manually), with an owner and a response SLA."""

    __tablename__ = "recovery_cases"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False)  # review|feedback|manual
    review_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="SET NULL"), unique=True)
    feedback_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("feedback_submissions.id", ondelete="SET NULL"), unique=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(16), default="high", nullable=False)  # critical|high|medium
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)  # open|in_progress|contacted|resolved|closed
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution: Mapped[str | None] = mapped_column(String(32))  # resolved_happy|resolved_neutral|unreachable|not_actionable
    timeline: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # [{at, by, event, note}]
    alerted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_recovery_cases_org_status", "organization_id", "status"),
        Index("ix_recovery_cases_org_created", "organization_id", "created_at"),
    )
