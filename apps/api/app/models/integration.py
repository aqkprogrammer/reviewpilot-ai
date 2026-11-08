from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk
from app.models.enums import IntegrationStatus


class GoogleConnection(UUIDPk, Timestamps, Base):
    """OAuth grant for the Google Business Profile API (scope business.manage). Tokens encrypted at rest."""

    __tablename__ = "google_connections"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True)
    connected_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    google_email: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(32), default=IntegrationStatus.NOT_CONNECTED, nullable=False)
    access_token_enc: Mapped[str | None] = mapped_column(Text)
    refresh_token_enc: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[str | None] = mapped_column(String(1024))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quota_used_today: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quota_day: Mapped[str | None] = mapped_column(String(10))


class GoogleAccount(UUIDPk, Timestamps, Base):
    """A Business Profile account discovered through the API (accounts/{id})."""

    __tablename__ = "google_accounts"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    connection_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("google_connections.id", ondelete="CASCADE"), index=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)  # accounts/123
    display_name: Mapped[str | None] = mapped_column(String(255))
    account_type: Mapped[str | None] = mapped_column(String(64))
    discovered_locations: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    __table_args__ = (UniqueConstraint("organization_id", "account_name", name="uq_google_account"),)


class IntegrationCredential(UUIDPk, Timestamps, Base):
    """Per-organization provider credentials (WhatsApp Cloud API, Resend sender, SMS). Encrypted JSON."""

    __tablename__ = "integration_credentials"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # whatsapp | email | sms
    status: Mapped[str] = mapped_column(String(32), default=IntegrationStatus.NOT_CONNECTED, nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # non-secret settings
    secrets_enc: Mapped[str | None] = mapped_column(Text)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("organization_id", "provider", name="uq_integration_provider"),)
