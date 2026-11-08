from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk
from app.models.enums import OrgRole, OrgStatus


class Organization(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    industry: Mapped[str] = mapped_column(String(48), default="other", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(512))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(320))
    country: Mapped[str] = mapped_column(String(2), default="IN", nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1024))
    brand_color: Mapped[str] = mapped_column(String(9), default="#6a4cff", nullable=False)
    brand_tone: Mapped[str] = mapped_column(String(32), default="professional", nullable=False)
    default_language: Mapped[str] = mapped_column(String(12), default="en", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=OrgStatus.ACTIVE, nullable=False, index=True)
    suspended_reason: Mapped[str | None] = mapped_column(String(500))
    onboarding_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    onboarding_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Demo organizations hold seeded, clearly-labelled sample data only.
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Auto-publish AI replies is OFF unless an owner explicitly enables it.
    auto_publish_replies: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    white_label: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", lazy="raise")
    locations: Mapped[list["Location"]] = relationship(back_populates="organization", lazy="raise")


class OrganizationMember(UUIDPk, Timestamps, Base):
    __tablename__ = "organization_members"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default=OrgRole.STAFF, nullable=False)
    # When true the member is limited to locations listed in location_members.
    restrict_to_locations: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="members", lazy="raise")
    user: Mapped["User"] = relationship(back_populates="memberships", lazy="raise")  # noqa: F821

    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_member"),)


class Invitation(UUIDPk, Timestamps, Base):
    __tablename__ = "invitations"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    location_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_invitations_org_email", "organization_id", "email"),)


class Location(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "locations"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)  # public /r/{slug}
    address_line: Mapped[str | None] = mapped_column(String(300))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(2), default="IN", nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    # Manual fallback while Google API access is pending.
    google_review_url: Mapped[str | None] = mapped_column(String(1024))
    google_place_id: Mapped[str | None] = mapped_column(String(255))
    # Resource name from the Business Profile API, e.g. "accounts/123/locations/456".
    google_location_name: Mapped[str | None] = mapped_column(String(255), index=True)
    google_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("google_accounts.id", ondelete="SET NULL"))
    feedback_page: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # headline, languages, etc.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="locations", lazy="raise")


class LocationMember(UUIDPk, Timestamps, Base):
    __tablename__ = "location_members"

    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organization_members.id", ondelete="CASCADE"), index=True)

    __table_args__ = (UniqueConstraint("location_id", "member_id", name="uq_location_member"),)
