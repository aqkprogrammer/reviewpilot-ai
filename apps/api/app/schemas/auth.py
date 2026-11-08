from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORM

INDUSTRIES = {
    "restaurant", "dental", "healthcare", "salon", "hotel", "real_estate", "automotive",
    "education", "retail", "local_services", "agency", "other",
}


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value) > 128:
        raise ValueError("Password is too long")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain letters and numbers")
    return value


class SignupIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str
    business_name: str = Field(min_length=2, max_length=160)
    industry: str = "other"
    country: str = Field("IN", min_length=2, max_length=2)
    phone: str | None = Field(None, max_length=32)
    accept_terms: bool

    _pw = field_validator("password")(validate_password_strength)

    @field_validator("industry")
    @classmethod
    def _industry(cls, v: str) -> str:
        if v not in INDUSTRIES:
            raise ValueError("Unknown industry")
        return v

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Terms and Privacy Policy")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v and not re.fullmatch(r"\+?[0-9 ()-]{7,20}", v):
            raise ValueError("Enter a valid phone number")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = True


class EmailIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str
    _pw = field_validator("password")(validate_password_strength)


class ChangePasswordIn(BaseModel):
    current_password: str | None = None  # None allowed for Google-only accounts setting a first password
    new_password: str
    _pw = field_validator("new_password")(validate_password_strength)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=160)
    phone: str | None = Field(None, max_length=32)
    locale: str | None = Field(None, max_length=8)
    timezone: str | None = Field(None, max_length=64)


class UserOut(ORM):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    avatar_url: str | None
    email_verified: bool
    platform_role: str
    status: str
    locale: str
    timezone: str
    has_password: bool = False
    created_at: datetime


class OrgSummary(ORM):
    id: uuid.UUID
    name: str
    slug: str
    industry: str
    logo_url: str | None
    status: str
    is_demo: bool
    onboarding_completed: bool
    plan_code: str | None = None
    subscription_status: str | None = None


class MembershipOut(BaseModel):
    organization: OrgSummary
    role: str
    permissions: list[str]
    location_ids: list[uuid.UUID] | None


class MeOut(BaseModel):
    user: UserOut
    memberships: list[MembershipOut]
    demo_mode: bool


class SessionOut(ORM):
    id: uuid.UUID
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime
    ip_address: str | None
    user_agent: str | None
    current: bool = False


class ProvidersOut(BaseModel):
    google: bool
    google_mock: bool
    demo_mode: bool
