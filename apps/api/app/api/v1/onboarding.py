from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.deps import DB, OrgContext, require_perm
from app.core.permissions import Perm
from app.core.security import now
from app.schemas.org import OnboardingUpdate, OrganizationOut
from app.services import audit

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

STEPS = ["welcome", "business", "location", "google", "collection", "team", "plan", "finish"]


class OnboardingState(BaseModel):
    step: int
    steps: list[str]
    data: dict
    completed: bool
    organization: OrganizationOut


def _state(org) -> OnboardingState:
    return OnboardingState(step=org.onboarding_step, steps=STEPS, data=org.onboarding_data or {}, completed=org.onboarding_completed_at is not None, organization=OrganizationOut.model_validate(org))


@router.get("", response_model=OnboardingState)
async def get_state(ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    return _state(ctx.organization)


@router.put("", response_model=OnboardingState)
async def save_progress(data: OnboardingUpdate, db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    org = ctx.organization
    merged = {**(org.onboarding_data or {}), **data.data}
    org.onboarding_data = merged
    org.onboarding_step = max(org.onboarding_step, data.step) if org.onboarding_completed_at is None else org.onboarding_step
    await db.commit()
    return _state(org)


@router.post("/complete", response_model=OnboardingState)
async def complete(request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.SETTINGS_MANAGE))):
    org = ctx.organization
    org.onboarding_completed_at = org.onboarding_completed_at or now()
    org.onboarding_step = len(STEPS)
    await audit.record(db, "onboarding.completed", actor=ctx.user, organization_id=org.id, request=request)
    await db.commit()
    return _state(org)
