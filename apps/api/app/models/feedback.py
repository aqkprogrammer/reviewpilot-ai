from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk


class FeedbackSubmission(UUIDPk, Timestamps, Base):
    """Private feedback from the public /r/{slug} page. Never published to Google by ReviewPilot."""

    __tablename__ = "feedback_submissions"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"))
    review_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("review_requests.id", ondelete="SET NULL"))
    qr_code_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("qr_codes.id", ondelete="SET NULL"))
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(12), default="en", nullable=False)
    consent_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sentiment: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="new", nullable=False)  # new|in_progress|resolved
    channel: Mapped[str] = mapped_column(String(16), default="direct", nullable=False)  # qr|whatsapp|email|direct
    meta: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (Index("ix_feedback_org_created", "organization_id", "created_at"),)
