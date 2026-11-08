"""Request dependencies: authentication, CSRF, organization (tenant) context, RBAC, super-admin."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Annotated

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError, Forbidden, Unauthorized
from app.core.permissions import Perm, has_permission
from app.core.security import constant_time_eq, decode_access_token
from app.models import AuthSession, LocationMember, Organization, OrganizationMember, User
from app.models.enums import OrgStatus, UserStatus

ACCESS_COOKIE = "rp_access"
REFRESH_COOKIE = "rp_refresh"
CSRF_COOKIE = "rp_csrf"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

DB = Annotated[AsyncSession, Depends(get_db)]


def _extract_token(request: Request) -> tuple[str | None, bool]:
    """Return (token, from_cookie)."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip(), False
    return request.cookies.get(ACCESS_COOKIE), True


def enforce_csrf(request: Request) -> None:
    """Double-submit cookie check for cookie-authenticated unsafe requests."""
    if request.method not in UNSAFE_METHODS:
        return
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get("x-csrf-token")
    if not cookie or not header or not constant_time_eq(cookie, header):
        raise Forbidden("CSRF token missing or invalid. Refresh the page and try again.", code="csrf_failed")


async def get_optional_user(request: Request, db: DB) -> User | None:
    token, from_cookie = _extract_token(request)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise Unauthorized("Session expired", code="token_expired")
    except jwt.InvalidTokenError:
        raise Unauthorized("Invalid session", code="not_authenticated")
    if from_cookie:
        enforce_csrf(request)
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user or user.deleted_at is not None:
        raise Unauthorized("Account not found")
    if user.status != UserStatus.ACTIVE:
        raise Forbidden("This account has been disabled. Contact support.", code="account_disabled")
    session = await db.get(AuthSession, uuid.UUID(payload["sid"])) if payload.get("sid") else None
    if session is None or session.revoked_at is not None:
        raise Unauthorized("Session revoked", code="not_authenticated")
    request.state.user = user
    request.state.session_id = session.id
    return user


async def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise Unauthorized("Authentication required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@dataclass
class OrgContext:
    user: User
    organization: Organization
    member: OrganizationMember
    # None → all locations in the organization; otherwise the explicit allow-list.
    location_ids: set[uuid.UUID] | None = field(default=None)

    @property
    def org_id(self) -> uuid.UUID:
        return self.organization.id

    @property
    def role(self) -> str:
        return self.member.role

    def can(self, perm: Perm) -> bool:
        return has_permission(self.member.role, perm)

    def require(self, perm: Perm) -> None:
        if not self.can(perm):
            raise Forbidden(f"Your role ({self.member.role}) does not allow this action.", code="permission_denied")

    def can_access_location(self, location_id: uuid.UUID | None) -> bool:
        return self.location_ids is None or (location_id is not None and location_id in self.location_ids)

    def ensure_location(self, location_id: uuid.UUID | None) -> None:
        if not self.can_access_location(location_id):
            raise Forbidden("You do not have access to this location.", code="location_forbidden")


async def get_org_context(
    request: Request,
    user: CurrentUser,
    db: DB,
    x_organization_id: Annotated[str | None, Header(alias="X-Organization-Id")] = None,
) -> OrgContext:
    if not x_organization_id:
        raise AppError("Select an organization first.", code="organization_required", status_code=400)
    try:
        org_id = uuid.UUID(x_organization_id)
    except ValueError:
        raise AppError("Invalid organization id", code="organization_required", status_code=400)

    row = (
        await db.execute(
            select(OrganizationMember, Organization)
            .join(Organization, Organization.id == OrganizationMember.organization_id)
            .where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user.id,
                Organization.deleted_at.is_(None),
            )
        )
    ).first()
    # Super admins are NOT implicitly members of customer organizations (least privilege).
    if row is None:
        raise Forbidden("You are not a member of this organization.", code="not_a_member")
    member, org = row
    if org.status == OrgStatus.SUSPENDED:
        raise Forbidden("This organization is suspended. Contact support.", code="org_suspended")

    location_ids: set[uuid.UUID] | None = None
    if member.restrict_to_locations:
        ids = (await db.scalars(select(LocationMember.location_id).where(LocationMember.member_id == member.id))).all()
        location_ids = set(ids)
    ctx = OrgContext(user=user, organization=org, member=member, location_ids=location_ids)
    request.state.org_id = org.id
    return ctx


Org = Annotated[OrgContext, Depends(get_org_context)]


def require_perm(perm: Perm):
    async def _dep(ctx: Org) -> OrgContext:
        ctx.require(perm)
        return ctx

    return _dep


async def require_super_admin(user: CurrentUser) -> User:
    if not user.is_super_admin:
        # Deliberately indistinguishable from a missing route for non-admins.
        raise Forbidden("Super Admin access required.", code="super_admin_required")
    return user


SuperAdmin = Annotated[User, Depends(require_super_admin)]
