"""Server-side RBAC. Mirrors packages/shared-types ROLE_PERMISSIONS (the server is the source of truth)."""

from __future__ import annotations

from enum import StrEnum

from app.models.enums import OrgRole


class Perm(StrEnum):
    ORG_MANAGE = "org.manage"
    BILLING_MANAGE = "billing.manage"
    TEAM_MANAGE = "team.manage"
    LOCATIONS_MANAGE = "locations.manage"
    REVIEWS_READ = "reviews.read"
    REVIEWS_REPLY = "reviews.reply"
    CAMPAIGNS_MANAGE = "campaigns.manage"
    CUSTOMERS_READ = "customers.read"
    CUSTOMERS_MANAGE = "customers.manage"
    ANALYTICS_READ = "analytics.read"
    INTEGRATIONS_MANAGE = "integrations.manage"
    AI_USE = "ai.use"
    SETTINGS_MANAGE = "settings.manage"


ROLE_PERMISSIONS: dict[str, frozenset[Perm]] = {
    OrgRole.OWNER: frozenset(Perm),
    OrgRole.ADMIN: frozenset(
        {
            Perm.LOCATIONS_MANAGE, Perm.REVIEWS_READ, Perm.REVIEWS_REPLY, Perm.CAMPAIGNS_MANAGE,
            Perm.CUSTOMERS_READ, Perm.CUSTOMERS_MANAGE, Perm.ANALYTICS_READ, Perm.INTEGRATIONS_MANAGE,
            Perm.AI_USE, Perm.SETTINGS_MANAGE, Perm.TEAM_MANAGE,
        }
    ),
    OrgRole.MANAGER: frozenset(
        {
            Perm.REVIEWS_READ, Perm.REVIEWS_REPLY, Perm.CAMPAIGNS_MANAGE, Perm.CUSTOMERS_READ,
            Perm.CUSTOMERS_MANAGE, Perm.ANALYTICS_READ, Perm.AI_USE,
        }
    ),
    OrgRole.STAFF: frozenset({Perm.REVIEWS_READ, Perm.CUSTOMERS_READ, Perm.CUSTOMERS_MANAGE, Perm.AI_USE}),
    OrgRole.ANALYST: frozenset({Perm.REVIEWS_READ, Perm.ANALYTICS_READ}),
}

# Roles an actor may assign. Only owners can create owners/admins.
ASSIGNABLE_ROLES: dict[str, set[str]] = {
    OrgRole.OWNER: {r.value for r in OrgRole},
    OrgRole.ADMIN: {OrgRole.MANAGER, OrgRole.STAFF, OrgRole.ANALYST},
}

# Managers and staff are location-scoped by default when restrict_to_locations is set.
LOCATION_SCOPED_ROLES = {OrgRole.MANAGER, OrgRole.STAFF, OrgRole.ANALYST}


def has_permission(role: str, perm: Perm) -> bool:
    return perm in ROLE_PERMISSIONS.get(role, frozenset())
