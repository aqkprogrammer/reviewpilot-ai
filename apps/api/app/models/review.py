from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk
from app.models.enums import ReplyStatus, ResponseStatus


class Review(UUIDPk, Timestamps, Base):
    __tablename__ = "reviews"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)  # google | demo
    platform: Mapped[str] = mapped_column(String(32), default="google", nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)  # Google review name/id
    reviewer_name: Mapped[str | None] = mapped_column(String(200))
    reviewer_photo_url: Mapped[str | None] = mapped_column(String(1024))
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(12))
    review_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    review_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_status: Mapped[str] = mapped_column(String(16), default=ResponseStatus.PENDING, nullable=False)
    # Existing owner reply as reported by the platform (may predate ReviewPilot).
    platform_reply: Mapped[str | None] = mapped_column(Text)
    platform_reply_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sentiment: Mapped[str | None] = mapped_column(String(16))
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    topics: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list, nullable=False)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    handled_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    history: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    __table_args__ = (
        UniqueConstraint("location_id", "source", "external_id", name="uq_review_external"),
        Index("ix_reviews_org_created", "organization_id", "review_created_at"),
        Index("ix_reviews_org_rating", "organization_id", "rating"),
        Index("ix_reviews_org_status", "organization_id", "response_status"),
        Index("ix_reviews_location_created", "location_id", "review_created_at"),
    )


class ReviewReply(UUIDPk, Timestamps, Base):
    __tablename__ = "review_replies"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[str | None] = mapped_column(String(32))
    language: Mapped[str | None] = mapped_column(String(12))
    ai_generation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_generations.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(24), default=ReplyStatus.DRAFT, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    publish_error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
