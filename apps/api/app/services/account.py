"""Self-service account deletion (right to erasure)."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import now
from app.models import AuthToken, Notification, NotificationPreference, OAuthIdentity, Organization, OrganizationMember, User
from app.models.enums import OrgRole, PlatformRole, UserStatus
from app.services import audit
from app.services.auth import revoke_all_sessions


async def deletion_blockers(db: AsyncSession, user: User) -> tuple[list[str], list[Organization]]:
    """Return (blocking org names, sole-member orgs that will be scheduled for deletion)."""
    blocking: list[str] = []
    solo: list[Organization] = []
    rows = (
        await db.execute(
            select(OrganizationMember, Organization)
            .join(Organization, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user.id, Organization.deleted_at.is_(None))
        )
    ).all()
    for member, org in rows:
        if member.role != OrgRole.OWNER:
            continue
        other_owners = await db.scalar(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org.id, OrganizationMember.role == OrgRole.OWNER, OrganizationMember.user_id != user.id
            )
        )
        if other_owners:
            continue
        others = await db.scalar(select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org.id, OrganizationMember.user_id != user.id))
        if others:
            blocking.append(org.name)
        else:
            solo.append(org)
    return blocking, solo


async def delete_account(db: AsyncSession, user: User, request) -> dict:
    if user.platform_role == PlatformRole.SUPER_ADMIN:
        admins = await db.scalar(
            select(func.count()).select_from(User).where(User.platform_role == PlatformRole.SUPER_ADMIN, User.deleted_at.is_(None), User.status == UserStatus.ACTIVE)
        )
        if (admins or 0) <= 1:
            raise AppError("You are the last Super Admin. Bootstrap another Super Admin before deleting this account.", code="last_super_admin", status_code=409)
    blocking, solo = await deletion_blockers(db, user)
    if blocking:
        raise AppError(
            "Transfer ownership first — you are the only owner of: " + ", ".join(blocking),
            code="ownership_transfer_required", status_code=409, details={"organizations": blocking},
        )
    for org in solo:
        org.deleted_at = now()
        await audit.record(db, "organization.deleted", actor=user, organization_id=org.id, target_type="organization", target_id=org.id, request=request, meta={"reason": "owner_account_deleted"})

    original_email = user.email
    await audit.record(db, "user.account_deleted", actor=user, target_type="user", target_id=user.id, request=request, meta={"scheduled_org_deletions": [str(o.id) for o in solo]})
    await revoke_all_sessions(db, user.id, "account_deleted")
    for model in (OrganizationMember, OAuthIdentity, Notification, NotificationPreference, AuthToken):
        await db.execute(delete(model).where(model.user_id == user.id))
    # Anonymise in place so audit history keeps a valid (but non-identifying) actor reference.
    user.email = f"deleted-{user.id.hex[:12]}@deleted.reviewpilot.invalid"
    user.full_name = "Deleted user"
    user.phone = None
    user.avatar_url = None
    user.password_hash = None
    user.preferences = {}
    user.status = UserStatus.DISABLED
    user.deleted_at = now()
    await db.commit()
    return {"email": original_email, "organizations_scheduled": [o.name for o in solo]}
