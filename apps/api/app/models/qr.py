from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk


class QRCode(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "qr_codes"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)  # short code for /q/{code}
    foreground: Mapped[str] = mapped_column(String(9), default="#0b1218", nullable=False)
    background: Mapped[str] = mapped_column(String(9), default="#ffffff", nullable=False)
    template: Mapped[str] = mapped_column(String(32), default="classic", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1024))
    card_headline: Mapped[str | None] = mapped_column(String(160))
    card_subtext: Mapped[str | None] = mapped_column(String(255))
    scan_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class QRScan(UUIDPk, Base):
    __tablename__ = "qr_scans"

    qr_code_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("qr_codes.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    device: Mapped[str | None] = mapped_column(String(32))
    # Only a salted hash of the IP is kept, for unique-scan estimation.
    ip_hash: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (Index("ix_qr_scans_code_time", "qr_code_id", "scanned_at"), Index("ix_qr_scans_org_time", "organization_id", "scanned_at"))
