from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    analytics,
    auth,
    campaigns,
    customers,
    dev,
    integrations,
    locations,
    notifications,
    onboarding,
    organizations,
    public,
    qr_codes,
    reviews,
    subscriptions,
    team,
    webhooks,
)

api_router = APIRouter()
for module in (admin, auth, organizations, onboarding, locations, team, reviews, customers, campaigns, qr_codes, analytics, ai, integrations, subscriptions, notifications, webhooks, dev):
    api_router.include_router(module.router)
api_router.include_router(public.router)
api_router.include_router(public.inbox)
