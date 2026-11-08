from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator

from app.schemas.common import ORM

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


class OrganizationOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    industry: str
    description: str | None
    website: str | None
    phone: str | None
    email: str | None
    country: str
    address: str | None
    timezone: str
    logo_url: str | None
    brand_color: str
    brand_tone: str
    default_language: str
    status: str
    is_demo: bool
    auto_publish_replies: bool
    onboarding_step: int
    onboarding_data: dict
    onboarding_completed_at: datetime | None
    created_at: datetime


class OrganizationUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    industry: str | None = None
    description: str | None = Field(None, max_length=2000)
    website: HttpUrl | None = None
    phone: str | None = Field(None, max_length=32)
    email: EmailStr | None = None
    country: str | None = Field(None, min_length=2, max_length=2)
    address: str | None = Field(None, max_length=1000)
    timezone: str | None = Field(None, max_length=64)
    brand_color: str | None = None
    brand_tone: str | None = None
    default_language: str | None = None
    auto_publish_replies: bool | None = None

    @field_validator("brand_color")
    @classmethod
    def _hex(cls, v):
        if v and not HEX.match(v):
            raise ValueError("Use a hex colour like #6a4cff")
        return v


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    industry: str = "other"
    country: str = Field("IN", min_length=2, max_length=2)
    phone: str | None = None


class LocationIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    address_line: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=120)
    state: str | None = Field(None, max_length=120)
    postal_code: str | None = Field(None, max_length=20)
    country: str = Field("IN", min_length=2, max_length=2)
    phone: str | None = Field(None, max_length=32)
    timezone: str = "Asia/Kolkata"
    google_review_url: str | None = Field(None, max_length=1024)
    google_place_id: str | None = Field(None, max_length=255)
    feedback_page: dict | None = None

    @field_validator("google_review_url")
    @classmethod
    def _google_url(cls, v: str | None) -> str | None:
        if not v:
            return None
        if not v.startswith("https://"):
            raise ValueError("Review link must start with https://")
        allowed = ("g.page/", "search.google.com/local/writereview", "www.google.com/", "google.com/", "maps.app.goo.gl/", "goo.gl/maps", "maps.google.com")
        if not any(a in v for a in allowed):
            raise ValueError("Use the review link from your Google Business Profile (g.page/r/... or search.google.com/local/writereview?placeid=...)")
        return v


class LocationUpdate(LocationIn):
    name: str | None = Field(None, min_length=2, max_length=160)  # type: ignore[assignment]
    country: str | None = None  # type: ignore[assignment]
    timezone: str | None = None  # type: ignore[assignment]
    is_active: bool | None = None


class LocationOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    address_line: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    phone: str | None
    timezone: str
    google_review_url: str | None
    google_place_id: str | None
    google_location_name: str | None
    feedback_page: dict
    is_active: bool
    created_at: datetime
    google_status: str = "not_connected"
    review_count: int = 0
    average_rating: float | None = None
    pending_responses: int = 0
    qr_count: int = 0
    campaign_count: int = 0
    effective_review_url: str | None = None


class MemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None
    role: str
    restrict_to_locations: bool
    location_ids: list[uuid.UUID]
    last_login_at: datetime | None
    joined_at: datetime
    is_you: bool = False


class InvitationIn(BaseModel):
    email: EmailStr
    role: str
    location_ids: list[uuid.UUID] = []


class InvitationOut(ORM):
    id: uuid.UUID
    email: str
    role: str
    location_ids: list
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class MemberUpdate(BaseModel):
    role: str | None = None
    restrict_to_locations: bool | None = None
    location_ids: list[uuid.UUID] | None = None


class OnboardingUpdate(BaseModel):
    step: int = Field(ge=1, le=8)
    data: dict = {}
