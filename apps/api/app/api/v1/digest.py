"""Weekly AI intelligence digest: preview (JSON + email HTML), test send and opt-in settings."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.core import ratelimit
from app.core.deps import DB, OrgContext, require_perm
from app.core.errors import Forbidden, RateLimited
from app.core.permissions import Perm
from app.services import digest as svc
from app.services.locations import get_location

router = APIRouter(prefix="/digest", tags=["digest"])
Reader = Depends(require_perm(Perm.ANALYTICS_READ))

TEST_SEND_LIMIT, TEST_SEND_WINDOW = 3, 600


async def _build(db, ctx: OrgContext, week_end: date | None, location_id: uuid.UUID | None) -> dict:
    if location_id is not None:
        await get_location(db, ctx, location_id)  # 404 for other tenants, 403 outside the member's locations
    we = svc.clamp_week_end(ctx.organization, week_end)
    data = await svc.build(db, ctx.organization, we, location_id, location_ids=ctx.location_ids, user_id=ctx.user.id)
    await db.commit()  # persists AI metering when a narrative was generated
    return data


@router.get("/preview")
async def preview(db: DB, ctx: OrgContext = Reader, week_end: date | None = None, location_id: uuid.UUID | None = None):
    data = await _build(db, ctx, week_end, location_id)
    data["available_weeks"] = svc.available_weeks(ctx.organization)
    return data


@router.get("/preview.html", response_class=HTMLResponse)
async def preview_html(db: DB, ctx: OrgContext = Reader, week_end: date | None = None, location_id: uuid.UUID | None = None):
    data = await _build(db, ctx, week_end, location_id)
    _, html, _, _ = await svc.render_email(db, ctx.organization, data)
    # Rendered inside a sandboxed iframe; forbid scripts and framing by other origins.
    return HTMLResponse(html, headers={"Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'self'"})


class SendTestIn(BaseModel):
    week_end: date | None = None
    location_id: uuid.UUID | None = None


@router.post("/send-test")
async def send_test(db: DB, data: SendTestIn | None = None, ctx: OrgContext = Reader):
    allowed, _ = await ratelimit.hit(f"digest-test:{ctx.user.id}", TEST_SEND_LIMIT, TEST_SEND_WINDOW)
    if not allowed:
        raise RateLimited(f"You can send up to {TEST_SEND_LIMIT} test digests every {TEST_SEND_WINDOW // 60} minutes.")
    data = data or SendTestIn()
    d = await _build(db, ctx, data.week_end, data.location_id)
    ok = await svc.send_to_user(db, ctx.organization, d, ctx.user.email, test=True)
    return {"ok": ok, "sent_to": ctx.user.email, "week": d["week"]["key"]}


class SettingsIn(BaseModel):
    email_enabled: bool | None = None
    org_enabled: bool | None = None


async def _settings(db, ctx: OrgContext) -> dict:
    pref = await svc.user_preference(db, ctx.user, ctx.role)
    dg = svc.org_digest_settings(ctx.organization)
    return {
        **pref,
        "default_email_enabled": svc.default_email_for_role(ctx.role),
        "org_enabled": svc.org_enabled(ctx.organization),
        "can_manage_org": ctx.can(Perm.ORG_MANAGE),
        "schedule": "Mondays · 09:00 IST (03:30 UTC)",
        "last_sent_week": dg.get("last_sent_week"),
        "last_sent_at": dg.get("last_sent_at"),
        "email": ctx.user.email,
    }


@router.get("/settings")
async def get_settings(db: DB, ctx: OrgContext = Reader):
    return await _settings(db, ctx)


@router.put("/settings")
async def put_settings(data: SettingsIn, db: DB, ctx: OrgContext = Reader):
    if data.org_enabled is not None:
        if not ctx.can(Perm.ORG_MANAGE):
            raise Forbidden("Only the organization owner can turn the weekly digest on or off for everyone.", code="permission_denied")
        svc.set_org_enabled(ctx.organization, data.org_enabled)
    if data.email_enabled is not None:
        await svc.set_user_preference(db, ctx.user, email=data.email_enabled, role=ctx.role)
    await db.commit()
    return await _settings(db, ctx)
