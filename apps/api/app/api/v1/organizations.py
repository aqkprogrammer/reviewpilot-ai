from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.deps import DB, CurrentUser, Org, OrgContext, require_perm
from app.core.errors import Forbidden
from app.core.permissions import Perm
from app.core.ratelimit import limiter
from app.core.security import now
from app.models.enums import OrgRole
from app.providers.storage import save_image
from app.schemas.org import OrganizationCreate, OrganizationOut, OrganizationUpdate
from app.services import audit
from app.services import white_label as wl_svc
from app.services.data_export import organization_export
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
    if "auto_publish_replies" in changes or "auto_publish_min_rating" in changes:
        # Only owners may authorize automatic publishing of AI-generated replies.
        ctx.require(Perm.ORG_MANAGE)
    min_rating = changes.pop("auto_publish_min_rating", None)
    if min_rating is not None:
        ctx.organization.settings = {**(ctx.organization.settings or {}), "auto_publish_min_rating": min_rating}
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
    """Owner-only soft delete. After a 30-day grace window the retention job erases customer and
    operational data; invoices, payments and the audit log are retained as statutory records."""
    ctx.organization.deleted_at = now()
    await audit.record(db, "organization.deleted", actor=ctx.user, organization_id=ctx.org_id, target_type="organization", target_id=ctx.org_id, request=request)
    await db.commit()


@router.get("/current/export", dependencies=[Depends(limiter("org-export", 5, 3600))])
async def export_org(request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.ORG_MANAGE))):
    """Owner-only full data export (ZIP of CSV files + manifest). Secrets are excluded."""
    blob = await organization_export(db, ctx.organization)
    await audit.record(db, "organization.exported", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"bytes": len(blob)})
    await db.commit()
    return Response(blob, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{ctx.organization.slug}-export-{now().date()}.zip"'})


class WhiteLabelIn(BaseModel):
    hide_attribution: bool = False
    sender_name: str | None = Field(None, max_length=70)
    footer_text: str | None = Field(None, max_length=160)


@router.get("/current/white-label")
async def get_white_label(db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    eff = await wl_svc.effective(db, ctx.organization)
    return {**eff, "settings": ctx.organization.white_label or {}}


@router.put("/current/white-label")
async def set_white_label(data: WhiteLabelIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    from app.services.organizations import require_entitlement

    await require_entitlement(db, ctx.org_id, "white_label", "White-label branding")
    clean = {k: (v.strip() if isinstance(v, str) else v) or (False if k == "hide_attribution" else None) for k, v in data.model_dump().items()}
    ctx.organization.white_label = clean
    await audit.record(db, "organization.white_label_updated", actor=ctx.user, organization_id=ctx.org_id, request=request, meta=clean)
    await db.commit()
    eff = await wl_svc.effective(db, ctx.organization)
    return {**eff, "settings": clean}
