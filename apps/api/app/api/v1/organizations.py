from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.core.deps import DB, CurrentUser, Org, OrgContext, require_perm
from app.core.errors import Forbidden
from app.core.permissions import Perm
from app.core.security import now
from app.models.enums import OrgRole
from app.providers.storage import save_image
from app.schemas.org import OrganizationCreate, OrganizationOut, OrganizationUpdate
from app.services import audit
from app.services.organizations import create_organization, effective_plan, memberships_for

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/current", response_model=OrganizationOut)
async def current(ctx: Org):
    return ctx.organization


@router.post("", response_model=OrganizationOut, status_code=201)
async def create(data: OrganizationCreate, user: CurrentUser, db: DB, request: Request):
    """Create an organization. Users without one (e.g. new Google sign-ups) may create their first;
    additional organizations require an Agency-tier plan on an organization the user owns."""
    memberships = await memberships_for(db, user)
    if memberships:
        owned = [m for m in memberships if m["role"] == OrgRole.OWNER]
        allowed = 1
        for m in owned:
            plan = await effective_plan(db, m["organization"]["id"])
            if plan:
                allowed = max(allowed, plan.max_organizations)
        if len(owned) >= allowed:
            raise Forbidden("Managing multiple organizations requires the Agency plan.", code="plan_limit_exceeded")
    org = await create_organization(db, owner=user, name=data.name, industry=data.industry, country=data.country, phone=data.phone)
    await audit.record(db, "organization.created", actor=user, organization_id=org.id, target_type="organization", target_id=org.id, request=request)
    await db.commit()
    return org


@router.patch("/current", response_model=OrganizationOut)
async def update(data: OrganizationUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    changes = data.model_dump(exclude_unset=True, mode="json")
    if "auto_publish_replies" in changes:
        # Only owners may authorize automatic publishing of AI-generated replies.
        ctx.require(Perm.ORG_MANAGE)
    for k, v in changes.items():
        setattr(ctx.organization, k, v)
    await audit.record(db, "organization.updated", actor=ctx.user, organization_id=ctx.org_id, target_type="organization", target_id=ctx.org_id, request=request, meta={"fields": list(changes)})
    await db.commit()
    return ctx.organization


@router.post("/current/logo", response_model=OrganizationOut)
async def upload_logo(request: Request, db: DB, file: UploadFile = File(...), ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    ctx.organization.logo_url = await save_image(file, f"orgs/{ctx.org_id}", 512)
    await audit.record(db, "organization.logo_updated", actor=ctx.user, organization_id=ctx.org_id, request=request)
    await db.commit()
    return ctx.organization


@router.delete("/current", status_code=204)
async def delete_org(request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.ORG_MANAGE))):
    """Owner-only soft delete. Data is purged by the retention job after 30 days."""
    ctx.organization.deleted_at = now()
    await audit.record(db, "organization.deleted", actor=ctx.user, organization_id=ctx.org_id, target_type="organization", target_id=ctx.org_id, request=request)
    await db.commit()
