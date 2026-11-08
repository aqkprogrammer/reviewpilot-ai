from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request

from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.permissions import Perm
from app.core.security import now
from app.models import Location
from app.schemas.org import LocationIn, LocationOut, LocationUpdate
from app.services import audit
from app.services.locations import get_location, list_with_stats
from app.services.organizations import enforce_location_limit
from app.services.slugs import unique_slug

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
async def list_locations(ctx: Org, db: DB):
    return await list_with_stats(db, ctx)


@router.post("", response_model=LocationOut, status_code=201)
async def create_location(data: LocationIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.LOCATIONS_MANAGE))):
    await enforce_location_limit(db, ctx.org_id)  # server-side plan enforcement
    loc = Location(
        organization_id=ctx.org_id,
        slug=await unique_slug(db, Location.slug, f"{ctx.organization.name} {data.city or data.name}", 90),
        **data.model_dump(exclude={"feedback_page"}),
        feedback_page=data.feedback_page or {},
    )
    db.add(loc)
    await db.flush()
    await audit.record(db, "location.created", actor=ctx.user, organization_id=ctx.org_id, target_type="location", target_id=loc.id, request=request)
    await db.commit()
    items = await list_with_stats(db, ctx)
    return next(i for i in items if i.id == loc.id)


@router.get("/{location_id}", response_model=LocationOut)
async def get_one(location_id: uuid.UUID, ctx: Org, db: DB):
    await get_location(db, ctx, location_id)
    items = await list_with_stats(db, ctx)
    return next(i for i in items if i.id == location_id)


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(location_id: uuid.UUID, data: LocationUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.LOCATIONS_MANAGE))):
    loc = await get_location(db, ctx, location_id)
    changes = data.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(loc, k, v)
    await audit.record(db, "location.updated", actor=ctx.user, organization_id=ctx.org_id, target_type="location", target_id=loc.id, request=request, meta={"fields": list(changes)})
    await db.commit()
    items = await list_with_stats(db, ctx)
    return next(i for i in items if i.id == loc.id)


@router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.LOCATIONS_MANAGE))):
    loc = await get_location(db, ctx, location_id)
    loc.deleted_at = now()
    loc.is_active = False
    await audit.record(db, "location.deleted", actor=ctx.user, organization_id=ctx.org_id, target_type="location", target_id=loc.id, request=request, meta={"name": loc.name})
    await db.commit()
