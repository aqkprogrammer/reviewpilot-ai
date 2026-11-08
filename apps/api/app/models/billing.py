from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk
from app.models.enums import PaymentStatus, SubscriptionStatus


class SubscriptionPlan(UUIDPk, Timestamps, Base):
    __tablename__ = "subscription_plans"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)  # starter|growth|agency|enterprise
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    price_monthly_minor: Mapped[int] = mapped_column(Integer, nullable=False)  # paise
    price_yearly_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    max_locations: Mapped[int] = mapped_column(Integer, nullable=False)
    max_team_members: Mapped[int] = mapped_column(Integer, nullable=False)
    max_organizations: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    ai_requests_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_message_quota: Mapped[int] = mapped_column(Integer, nullable=False)
    features: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # marketing bullets
    entitlements: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # feature switches
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_custom_pricing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider_refs: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # razorpay plan ids, stripe price ids


class Subscription(UUIDPk, Timestamps, Base):
    __tablename__ = "subscriptions"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=SubscriptionStatus.TRIALING, nullable=False, index=True)
    interval: Mapped[str] = mapped_column(String(8), default="monthly", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(16))  # razorpay|stripe|mock
    provider_customer_id: Mapped[str | None] = mapped_column(String(255))
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), index=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_period_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pending_plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"))
    pending_interval: Mapped[str | None] = mapped_column(String(8))
    pending_checkout: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class Payment(UUIDPk, Timestamps, Base):
    __tablename__ = "payments"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_payment_id: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=PaymentStatus.PENDING, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    plan_code: Mapped[str | None] = mapped_column(String(32))
    raw: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        UniqueConstraint("provider", "provider_payment_id", name="uq_payment_provider_id"),
        Index("ix_payments_org_created", "organization_id", "created_at"),
        Index("ix_payments_status_created", "status", "created_at"),
    )


class Invoice(UUIDPk, Timestamps, Base):
    __tablename__ = "invoices"

    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="SET NULL"))
    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="paid", nullable=False)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    line_items: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    billing_details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
