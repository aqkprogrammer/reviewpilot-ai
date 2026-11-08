from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.core.deps import DB, CurrentUser, Org, OrgContext, require_perm
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.permissions import ASSIGNABLE_ROLES, Perm
from app.core.ratelimit import limiter
from app.core.security import generate_token, hash_token, now
from app.models import Invitation, Location, LocationMember, Organization, OrganizationMember, User
from app.models.enums import OrgRole
from app.providers.email import get_email_provider
from app.schemas.common import Message
from app.schemas.org import InvitationIn, InvitationOut, MemberOut, MemberUpdate
from app.services import audit, email_templates
from app.services.notify import notify_user
from app.services.organizations import enforce_team_limit

router = APIRouter(prefix="/team", tags=["team"])


async def _members(db, ctx: OrgContext) -> list[MemberOut]:
    rows = (
        await db.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == ctx.org_id)
            .order_by(OrganizationMember.created_at)
        )
    ).all()
    member_ids = [m.id for m, _ in rows]
    loc_rows = (await db.execute(select(LocationMember.member_id, LocationMember.location_id).where(LocationMember.member_id.in_(member_ids)))).all() if member_ids else []
    by_member: dict[uuid.UUID, list[uuid.UUID]] = {}
    for mid, lid in loc_rows:
        by_member.setdefault(mid, []).append(lid)
    return [
        MemberOut(
            id=m.id, user_id=u.id, full_name=u.full_name, email=u.email, avatar_url=u.avatar_url, role=m.role,
            restrict_to_locations=m.restrict_to_locations, location_ids=by_member.get(m.id, []),
            last_login_at=u.last_login_at, joined_at=m.created_at, is_you=u.id == ctx.user.id,
        )
        for m, u in rows
    ]


def _check_assignable(ctx: OrgContext, role: str) -> None:
    if role not in {r.value for r in OrgRole}:
        raise AppError("Unknown role", code="invalid_role")
    if role not in ASSIGNABLE_ROLES.get(ctx.role, set()):
        raise Forbidden(f"As {ctx.role} you cannot assign the {role} role.", code="permission_denied")


async def _validate_locations(db, ctx: OrgContext, ids: list[uuid.UUID]) -> None:
    if not ids:
        return
    count = await db.scalar(select(func.count()).select_from(Location).where(Location.id.in_(ids), Location.organization_id == ctx.org_id, Location.deleted_at.is_(None)))
    if count != len(set(ids)):
        raise AppError("One or more locations are invalid.", code="invalid_location")


@router.get("/members", response_model=list[MemberOut])
async def list_members(ctx: Org, db: DB):
    return await _members(db, ctx)


@router.patch("/members/{member_id}", response_model=MemberOut)
async def update_member(member_id: uuid.UUID, data: MemberUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.TEAM_MANAGE))):
    member = await db.get(OrganizationMember, member_id)
    if member is None or member.organization_id != ctx.org_id:
        raise NotFound("Member not found")
    if member.user_id == ctx.user.id and data.role and data.role != member.role:
        raise Forbidden("You can't change your own role.")
    if member.role == OrgRole.OWNER and ctx.role != OrgRole.OWNER:
        raise Forbidden("Only owners can modify another owner.")
    if data.role and data.role != member.role:
        _check_assignable(ctx, data.role)
        if member.role == OrgRole.OWNER:
            owners = await db.scalar(select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == ctx.org_id, OrganizationMember.role == OrgRole.OWNER))
            if owners <= 1:
                raise AppError("An organization needs at least one owner.", code="last_owner")
        old = member.role
        member.role = data.role
        await audit.record(db, "team.role_changed", actor=ctx.user, organization_id=ctx.org_id, target_type="member", target_id=member.id, request=request, meta={"from": old, "to": data.role})
    if data.restrict_to_locations is not None:
        member.restrict_to_locations = data.restrict_to_locations
    if data.location_ids is not None:
        await _validate_locations(db, ctx, data.location_ids)
        await db.execute(delete(LocationMember).where(LocationMember.member_id == member.id))
        for lid in set(data.location_ids):
            db.add(LocationMember(location_id=lid, member_id=member.id))
        await audit.record(db, "team.location_access_changed", actor=ctx.user, organization_id=ctx.org_id, target_type="member", target_id=member.id, request=request, meta={"location_ids": [str(i) for i in data.location_ids]})
    await db.commit()
    return next(m for m in await _members(db, ctx) if m.id == member.id)


@router.delete("/members/{member_id}", status_code=204)
async def remove_member(member_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.TEAM_MANAGE))):
    member = await db.get(OrganizationMember, member_id)
    if member is None or member.organization_id != ctx.org_id:
        raise NotFound("Member not found")
    if member.user_id == ctx.user.id:
        raise Forbidden("You can't remove yourself. Transfer ownership first.")
    if member.role in (OrgRole.OWNER, OrgRole.ADMIN) and ctx.role != OrgRole.OWNER:
        raise Forbidden("Only owners can remove owners or admins.")
    await db.delete(member)
    await audit.record(db, "team.member_removed", actor=ctx.user, organization_id=ctx.org_id, target_type="user", target_id=member.user_id, request=request)
    await db.commit()


@router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(ctx: Org, db: DB):
    rows = await db.scalars(
        select(Invitation).where(Invitation.organization_id == ctx.org_id, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None)).order_by(Invitation.created_at.desc())
    )
    return rows.all()


@router.post("/invitations", response_model=InvitationOut, status_code=201, dependencies=[Depends(limiter("invite", 30, 3600))])
async def invite(data: InvitationIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.TEAM_MANAGE))):
    _check_assignable(ctx, data.role)
    await _validate_locations(db, ctx, data.location_ids)
    email = data.email.lower()
    existing_member = await db.scalar(
        select(OrganizationMember).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == ctx.org_id, User.email == email)
    )
    if existing_member:
        raise Conflict("That person is already a member.")
    pending = await db.scalar(
        select(func.count()).select_from(Invitation).where(Invitation.organization_id == ctx.org_id, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None), Invitation.expires_at > now())
    )
    await enforce_team_limit(db, ctx.org_id, pending_invites=pending or 0)
    # Revoke older pending invites for the same email.
    for old in (await db.scalars(select(Invitation).where(Invitation.organization_id == ctx.org_id, Invitation.email == email, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None)))).all():
        old.revoked_at = now()
    raw = generate_token(32)
    inv = Invitation(
        organization_id=ctx.org_id, email=email, role=data.role, location_ids=[str(i) for i in data.location_ids],
        token_hash=hash_token(raw), invited_by_id=ctx.user.id, expires_at=now() + timedelta(days=7),
    )
    db.add(inv)
    await db.flush()
    subject, html, text = email_templates.invitation(ctx.organization.name, ctx.user.full_name, data.role, raw)
    await get_email_provider().send(to=email, subject=subject, html=html, text=text)
    invitee = await db.scalar(select(User).where(User.email == email, User.deleted_at.is_(None)))
    if invitee:
        await notify_user(db, invitee.id, "team.invitation", f"You're invited to {ctx.organization.name}", f"{ctx.user.full_name} invited you as {data.role}.", link=f"/invite?token={raw}", send_email=False)
    await audit.record(db, "team.invited", actor=ctx.user, organization_id=ctx.org_id, target_type="invitation", target_id=inv.id, request=request, meta={"email": email, "role": data.role})
    await db.commit()
    return inv


@router.post("/invitations/{invitation_id}/resend", response_model=Message)
async def resend_invitation(invitation_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.TEAM_MANAGE))):
    inv = await db.get(Invitation, invitation_id)
    if inv is None or inv.organization_id != ctx.org_id or inv.accepted_at or inv.revoked_at:
        raise NotFound("Invitation not found")
    raw = generate_token(32)
    inv.token_hash = hash_token(raw)
    inv.expires_at = now() + timedelta(days=7)
    subject, html, text = email_templates.invitation(ctx.organization.name, ctx.user.full_name, inv.role, raw)
    await get_email_provider().send(to=inv.email, subject=subject, html=html, text=text)
    await audit.record(db, "team.invitation_resent", actor=ctx.user, organization_id=ctx.org_id, target_type="invitation", target_id=inv.id, request=request)
    await db.commit()
    return Message(message="Invitation resent")


@router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(invitation_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.TEAM_MANAGE))):
    inv = await db.get(Invitation, invitation_id)
    if inv is None or inv.organization_id != ctx.org_id:
        raise NotFound("Invitation not found")
    inv.revoked_at = now()
    await audit.record(db, "team.invitation_revoked", actor=ctx.user, organization_id=ctx.org_id, target_type="invitation", target_id=inv.id, request=request)
    await db.commit()


class InvitePreview(BaseModel):
    organization_name: str
    role: str
    email: str
    expired: bool


class AcceptIn(BaseModel):
    token: str


async def _invitation_by_token(db, token: str) -> Invitation:
    inv = await db.scalar(select(Invitation).where(Invitation.token_hash == hash_token(token)))
    if inv is None or inv.revoked_at is not None or inv.accepted_at is not None:
        raise NotFound("This invitation is no longer valid.")
    return inv


@router.get("/invitations/preview/{token}", response_model=InvitePreview, dependencies=[Depends(limiter("invite-preview", 30, 60))])
async def preview_invitation(token: str, db: DB):
    inv = await _invitation_by_token(db, token)
    org = await db.get(Organization, inv.organization_id)
    return InvitePreview(organization_name=org.name if org else "", role=inv.role, email=inv.email, expired=inv.expires_at < now())


@router.post("/invitations/accept", response_model=Message)
async def accept_invitation(data: AcceptIn, user: CurrentUser, db: DB, request: Request):
    inv = await _invitation_by_token(db, data.token)
    if inv.expires_at < now():
        raise AppError("This invitation has expired. Ask for a new one.", code="invitation_expired")
    if inv.email.lower() != user.email.lower():
        raise Forbidden(f"This invitation was sent to {inv.email}. Sign in with that email to accept.", code="invitation_email_mismatch")
    exists = await db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == inv.organization_id, OrganizationMember.user_id == user.id))
    if not exists:
        member = OrganizationMember(organization_id=inv.organization_id, user_id=user.id, role=inv.role, restrict_to_locations=bool(inv.location_ids))
        db.add(member)
        await db.flush()
        for lid in inv.location_ids:
            db.add(LocationMember(location_id=uuid.UUID(lid), member_id=member.id))
    inv.accepted_at = now()
    if not user.email_verified_at:
        user.email_verified_at = now()  # proven by receiving the invitation email
    await audit.record(db, "team.invitation_accepted", actor=user, organization_id=inv.organization_id, target_type="invitation", target_id=inv.id, request=request)
    await db.commit()
    return Message(message=str(inv.organization_id))
