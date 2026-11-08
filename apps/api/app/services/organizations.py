from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import PlanLimitExceeded
from app.core.permissions import ROLE_PERMISSIONS
from app.core.security import now
from app.models import (
    Location,
    LocationMember,
    Organization,
    OrganizationMember,
    Subscription,
    SubscriptionPlan,
    User,
)
from app.models.enums import OrgRole, SubscriptionStatus
from app.services.slugs import unique_slug

DEFAULT_TRIAL_PLAN = "growth"


async def create_organization(
    db: AsyncSession,
    *,
    owner: User,
    name: str,
    industry: str = "other",
    country: str = "IN",
    phone: str | None = None,
    is_demo: bool = False,
) -> Organization:
    org = Organization(
        name=name.strip(),
        slug=await unique_slug(db, Organization.slug, name),
        industry=industry,
        country=country.upper(),
        phone=phone,
        email=owner.email,
        is_demo=is_demo,
        onboarding_step=2,
    )
    db.add(org)
    await db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=owner.id, role=OrgRole.OWNER))
    await start_trial(db, org)
    return org


async def start_trial(db: AsyncSession, org: Organization, plan_code: str = DEFAULT_TRIAL_PLAN) -> Subscription | None:
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code))
    if plan is None:
        return None
    sub = Subscription(
        organization_id=org.id,
        plan_id=plan.id,
        status=SubscriptionStatus.TRIALING,
        interval="monthly",
        trial_ends_at=now() + timedelta(days=settings.trial_days),
        current_period_start=now(),
        current_period_end=now() + timedelta(days=settings.trial_days),
    )
    db.add(sub)
    return sub


async def get_subscription_with_plan(db: AsyncSession, org_id: uuid.UUID) -> tuple[Subscription | None, SubscriptionPlan | None]:
    row = (
        await db.execute(
            select(Subscription, SubscriptionPlan)
            .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .where(Subscription.organization_id == org_id)
        )
    ).first()
    return (row[0], row[1]) if row else (None, None)


ENTITLED_STATUSES = {SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD}


async def effective_plan(db: AsyncSession, org_id: uuid.UUID) -> SubscriptionPlan | None:
    sub, plan = await get_subscription_with_plan(db, org_id)
    if sub is None or sub.status not in ENTITLED_STATUSES:
        return None
    return plan


async def has_entitlement(db: AsyncSession, org_id: uuid.UUID, key: str) -> bool:
    plan = await effective_plan(db, org_id)
    return bool(plan and plan.entitlements.get(key))


async def require_entitlement(db: AsyncSession, org_id: uuid.UUID, key: str, label: str) -> None:
    if not await has_entitlement(db, org_id, key):
        raise PlanLimitExceeded(f"{label} is not included in your current plan. Upgrade to unlock it.", details={"entitlement": key})


async def enforce_location_limit(db: AsyncSession, org_id: uuid.UUID) -> None:
    plan = await effective_plan(db, org_id)
    if plan is None:
        raise PlanLimitExceeded("Your subscription is inactive. Choose a plan to add locations.")
    count = await db.scalar(
        select(func.count()).select_from(Location).where(Location.organization_id == org_id, Location.deleted_at.is_(None))
    )
    if (count or 0) >= plan.max_locations:
        raise PlanLimitExceeded(
            f"Your {plan.name} plan includes up to {plan.max_locations} location(s). Upgrade to add more.",
            details={"limit": plan.max_locations, "current": count},
        )


async def enforce_team_limit(db: AsyncSession, org_id: uuid.UUID, pending_invites: int = 0) -> None:
    plan = await effective_plan(db, org_id)
    if plan is None:
        raise PlanLimitExceeded("Your subscription is inactive.")
    count = await db.scalar(select(func.count()).select_from(OrganizationMember).where(OrganizationMember.organization_id == org_id))
    if (count or 0) + pending_invites >= plan.max_team_members:
        raise PlanLimitExceeded(
            f"Your {plan.name} plan includes up to {plan.max_team_members} team members.",
            details={"limit": plan.max_team_members, "current": count},
        )


async def memberships_for(db: AsyncSession, user: User) -> list[dict]:
    rows = (
        await db.execute(
            select(OrganizationMember, Organization)
            .join(Organization, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user.id, Organization.deleted_at.is_(None))
            .order_by(Organization.created_at)
        )
    ).all()
    out = []
    for member, org in rows:
        sub, plan = await get_subscription_with_plan(db, org.id)
        loc_ids = None
        if member.restrict_to_locations:
            loc_ids = list((await db.scalars(select(LocationMember.location_id).where(LocationMember.member_id == member.id))).all())
        out.append(
            {
                "organization": {
                    "id": org.id,
                    "name": org.name,
                    "slug": org.slug,
                    "industry": org.industry,
                    "logo_url": org.logo_url,
                    "status": org.status,
                    "is_demo": org.is_demo,
                    "onboarding_completed": org.onboarding_completed_at is not None,
                    "plan_code": plan.code if plan else None,
                    "subscription_status": sub.status if sub else None,
                },
                "role": member.role,
                "permissions": sorted(p.value for p in ROLE_PERMISSIONS.get(member.role, frozenset())),
                "location_ids": loc_ids,
            }
        )
    return out
