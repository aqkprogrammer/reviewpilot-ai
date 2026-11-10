from __future__ import annotations

import uuid

import jwt
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.crypto import decrypt, decrypt_json, encrypt, encrypt_json, mask
from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.errors import AppError, IntegrationNotConfigured, NotFound
from app.core.permissions import Perm
from app.core.security import now, read_state, sign_state
from app.models import CampaignTemplate, GoogleAccount, GoogleConnection, IntegrationCredential, Location
from app.models.enums import IntegrationStatus
from app.providers import google_business as gbp
from app.providers.email import get_email_provider
from app.providers.messaging import WhatsAppCloudAdapter
from app.services import audit
from app.services.auth import pkce_pair
from app.services.campaigns import channel_status
from app.services.google_sync import discover
from app.services.jobs import enqueue
from app.services.locations import get_location

router = APIRouter(prefix="/integrations", tags=["integrations"])
Manage = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))


@router.get("")
async def overview(ctx: Org, db: DB):
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    creds = {c.provider: c for c in (await db.scalars(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id))).all()}
    wa = creds.get("whatsapp")
    return {
        "demo_mode": settings.demo_mode,
        "google": {
            "status": conn.status if conn else (IntegrationStatus.NOT_CONNECTED if settings.google_configured else "not_configured"),
            "platform_configured": settings.google_configured,
            "email": conn.google_email if conn else None,
            "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
            "last_error": conn.last_error if conn else None,
        },
        "whatsapp": {
            "status": wa.status if wa else IntegrationStatus.NOT_CONNECTED,
            "phone_number_id": wa.config.get("phone_number_id") if wa else None,
            "display": wa.config.get("display") if wa else None,
            "platform_configured": settings.whatsapp_platform_configured,
            "delivery": await channel_status(db, ctx.org_id, "whatsapp"),
        },
        "email": {"status": IntegrationStatus.CONNECTED if settings.resend_configured else "not_configured", "provider": "resend", "delivery": await channel_status(db, ctx.org_id, "email"), "sender": (creds.get("email").config if creds.get("email") else {})},
        "sms": {"status": IntegrationStatus.CONNECTED if settings.twilio_account_sid else "not_configured", "provider": "twilio", "delivery": await channel_status(db, ctx.org_id, "sms")},
        "openai": {"status": IntegrationStatus.CONNECTED if settings.openai_configured else "not_configured", "model": settings.openai_model if settings.openai_configured else None},
    }


# ------------------------------------------------------------------ Google Business Profile

@router.get("/google")
async def google_status(ctx: Org, db: DB):
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    accounts = (await db.scalars(select(GoogleAccount).where(GoogleAccount.organization_id == ctx.org_id))).all()
    locations = (await db.scalars(select(Location).where(Location.organization_id == ctx.org_id, Location.deleted_at.is_(None)))).all()
    return {
        "platform_configured": settings.google_configured,
        "status": conn.status if conn else IntegrationStatus.NOT_CONNECTED,
        "email": conn.google_email if conn else None,
        "scopes": conn.scopes if conn else None,
        "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
        "last_error": conn.last_error if conn else None,
        "quota_used_today": conn.quota_used_today if conn else 0,
        "accounts": [{"id": str(a.id), "account_name": a.account_name, "display_name": a.display_name, "type": a.account_type, "locations": a.discovered_locations} for a in accounts],
        "locations": [{"id": str(l.id), "name": l.name, "google_location_name": l.google_location_name, "google_account_id": str(l.google_account_id) if l.google_account_id else None, "google_review_url": l.google_review_url} for l in locations],
    }


@router.post("/google/connect")
async def google_connect(ctx: OrgContext = Manage):
    if not settings.google_configured:
        raise IntegrationNotConfigured(
            "Google OAuth credentials are not configured on this server. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (see docs/GOOGLE_INTEGRATION.md). Meanwhile, add your Google review link manually on each location.",
        )
    verifier, challenge = pkce_pair()
    state = sign_state({"org": str(ctx.org_id), "user": str(ctx.user.id), "verifier": verifier}, 900)
    return {"url": gbp.authorize_url(state, challenge)}


@router.get("/google/callback", include_in_schema=False)
async def google_callback(db: DB, request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    dest = f"{settings.frontend_url}/app/integrations"
    if error or not code or not state:
        return RedirectResponse(f"{dest}?google=cancelled", 302)
    try:
        st = read_state(state)
    except jwt.InvalidTokenError:
        return RedirectResponse(f"{dest}?google=state_invalid", 302)
    # The callback is only accepted for the user + org that initiated it (state is signed server-side).
    from app.core.deps import get_optional_user

    user = await get_optional_user(request, db)
    if user is None or str(user.id) != st.get("user"):
        return RedirectResponse(f"{dest}?google=session_mismatch", 302)
    org_id = uuid.UUID(st["org"])
    try:
        tokens = await gbp.exchange_code(code, st["verifier"])
    except gbp.GoogleAPIError:
        return RedirectResponse(f"{dest}?google=exchange_failed", 302)
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == org_id))
    if conn is None:
        conn = GoogleConnection(organization_id=org_id)
        db.add(conn)
    conn.connected_by_id = user.id
    conn.access_token_enc = encrypt(tokens["access_token"])
    if tokens.get("refresh_token"):
        conn.refresh_token_enc = encrypt(tokens["refresh_token"])
    conn.token_expires_at = gbp.expiry(tokens)
    conn.scopes = tokens.get("scope")
    conn.status = IntegrationStatus.PENDING
    conn.last_error = None
    try:
        info = await gbp.GBPClient(tokens["access_token"]).userinfo()
        conn.google_email = info.get("email")
    except gbp.GoogleAPIError:
        pass
    await db.flush()
    await audit.record(db, "integration.google_connected", actor=user, organization_id=org_id, request=request)
    await db.commit()
    try:
        await discover(db, conn)
        result = "connected"
    except gbp.GoogleAPIError as exc:
        conn.status = IntegrationStatus.PENDING if exc.status == 403 else IntegrationStatus.ERROR
        conn.last_error = str(exc)
        await db.commit()
        result = "pending_access" if exc.status == 403 else "discovery_failed"
    return RedirectResponse(f"{dest}?google={result}", 302)


@router.post("/google/discover")
async def google_discover(db: DB, ctx: OrgContext = Manage):
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    if conn is None:
        raise AppError("Connect Google first.", code="google_not_connected", status_code=409)
    try:
        n = await discover(db, conn)
    except gbp.GoogleAPIError as exc:
        conn.last_error = str(exc)
        conn.status = IntegrationStatus.PENDING if exc.status == 403 else IntegrationStatus.TOKEN_EXPIRED if exc.reauth else IntegrationStatus.ERROR
        await db.commit()
        raise AppError(str(exc), code="google_api_error", status_code=502)
    return {"accounts": n}


class LinkIn(BaseModel):
    location_id: uuid.UUID
    account_id: uuid.UUID
    google_location_name: str = Field(pattern=r"^locations/\d+$")


@router.post("/google/link")
async def link_location(data: LinkIn, request: Request, db: DB, ctx: OrgContext = Manage):
    loc = await get_location(db, ctx, data.location_id)
    account = await db.get(GoogleAccount, data.account_id)
    if account is None or account.organization_id != ctx.org_id:
        raise NotFound("Google account not found")
    match = next((l for l in account.discovered_locations if l["name"] == data.google_location_name), None)
    if match is None:
        raise AppError("That Google location was not found in this account.", code="invalid_google_location")
    loc.google_account_id, loc.google_location_name = account.id, data.google_location_name
    if match.get("place_id"):
        loc.google_place_id = match["place_id"]
    if match.get("review_url") and not loc.google_review_url:
        loc.google_review_url = match["review_url"]
    await audit.record(db, "integration.google_location_linked", actor=ctx.user, organization_id=ctx.org_id, target_type="location", target_id=loc.id, request=request)
    await db.commit()
    return {"ok": True}


@router.post("/google/unlink/{location_id}")
async def unlink_location(location_id: uuid.UUID, db: DB, ctx: OrgContext = Manage):
    loc = await get_location(db, ctx, location_id)
    loc.google_account_id = loc.google_location_name = None
    await db.commit()
    return {"ok": True}


@router.post("/google/sync")
async def google_sync(db: DB, ctx: OrgContext = Manage):
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    if conn is None or conn.status != IntegrationStatus.CONNECTED:
        raise AppError("Google Business Profile is not connected.", code="google_not_connected", status_code=409)
    job = await enqueue("sync_google_reviews", organization_id=ctx.org_id, connection_id=str(conn.id))
    return {"job_id": str(job)}


@router.delete("/google", status_code=204)
async def google_disconnect(request: Request, db: DB, ctx: OrgContext = Manage):
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    if conn is None:
        return
    token = decrypt(conn.refresh_token_enc) or decrypt(conn.access_token_enc)
    if token and settings.google_configured:
        try:
            await gbp.revoke(token)
        except Exception:  # noqa: BLE001
            pass
    for loc in (await db.scalars(select(Location).where(Location.organization_id == ctx.org_id))).all():
        loc.google_account_id = None
        loc.google_location_name = None
    await db.delete(conn)
    await audit.record(db, "integration.google_disconnected", actor=ctx.user, organization_id=ctx.org_id, request=request)
    await db.commit()


# ------------------------------------------------------------------ WhatsApp Cloud API

class WhatsAppIn(BaseModel):
    phone_number_id: str = Field(pattern=r"^\d{6,30}$")
    business_account_id: str = Field(pattern=r"^\d{6,30}$")
    access_token: str = Field(min_length=20, max_length=1000)


@router.get("/whatsapp")
async def whatsapp_status(ctx: Org, db: DB):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "whatsapp"))
    templates = (await db.scalars(select(CampaignTemplate).where(CampaignTemplate.organization_id == ctx.org_id, CampaignTemplate.channel == "whatsapp", CampaignTemplate.deleted_at.is_(None)))).all()
    secrets_ = decrypt_json(cred.secrets_enc) if cred else {}
    return {
        "status": cred.status if cred else IntegrationStatus.NOT_CONNECTED,
        "phone_number_id": cred.config.get("phone_number_id") if cred else None,
        "business_account_id": cred.config.get("business_account_id") if cred else None,
        "display": cred.config.get("display") if cred else None,
        "access_token_masked": mask(secrets_.get("access_token")),
        "last_verified_at": cred.last_verified_at.isoformat() if cred and cred.last_verified_at else None,
        "last_error": cred.last_error if cred else None,
        "webhook_url": f"{settings.backend_url}/api/v1/webhooks/whatsapp",
        "templates": [{"id": str(t.id), "name": t.name, "provider_template_name": t.provider_template_name, "status": t.provider_status, "language": t.language} for t in templates],
        "remote_templates": (cred.config.get("remote_templates") if cred else None) or [],
        "demo_mode": settings.demo_mode,
    }


@router.put("/whatsapp")
async def whatsapp_connect(data: WhatsAppIn, request: Request, db: DB, ctx: OrgContext = Manage):
    adapter = WhatsAppCloudAdapter(data.access_token, data.phone_number_id)
    ok, info = await adapter.verify()
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "whatsapp"))
    if cred is None:
        cred = IntegrationCredential(organization_id=ctx.org_id, provider="whatsapp")
        db.add(cred)
    cred.config = {"phone_number_id": data.phone_number_id, "business_account_id": data.business_account_id, "display": info if ok else None}
    cred.secrets_enc = encrypt_json({"access_token": data.access_token})
    cred.status = IntegrationStatus.CONNECTED if ok else IntegrationStatus.ERROR
    cred.last_error = None if ok else info
    cred.last_verified_at = now() if ok else None
    await audit.record(db, "integration.whatsapp_saved", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"verified": ok})
    await db.commit()
    if not ok:
        raise AppError(f"Saved, but Meta rejected the credentials: {info}", code="whatsapp_verification_failed", status_code=400)
    return await whatsapp_status(ctx, db)


@router.post("/whatsapp/templates/sync")
async def whatsapp_templates_sync(db: DB, ctx: OrgContext = Manage):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "whatsapp"))
    if cred is None or cred.status != IntegrationStatus.CONNECTED:
        raise AppError("Connect WhatsApp first.", code="whatsapp_not_connected", status_code=409)
    adapter = WhatsAppCloudAdapter(decrypt_json(cred.secrets_enc).get("access_token", ""), cred.config["phone_number_id"])
    try:
        remote = await adapter.list_templates(cred.config["business_account_id"])
    except Exception as exc:  # noqa: BLE001
        raise AppError(f"Could not fetch templates from Meta: {exc}", code="whatsapp_api_error", status_code=502)
    statuses = {t["name"]: t.get("status", "UNKNOWN").lower() for t in remote}
    for tpl in (await db.scalars(select(CampaignTemplate).where(CampaignTemplate.organization_id == ctx.org_id, CampaignTemplate.channel == "whatsapp"))).all():
        if tpl.provider_template_name in statuses:
            tpl.provider_status = statuses[tpl.provider_template_name]
    cred.config = {**cred.config, "remote_templates": [{"name": t["name"], "status": t.get("status"), "language": t.get("language"), "category": t.get("category")} for t in remote]}
    await db.commit()
    return {"templates": len(remote)}


@router.delete("/whatsapp", status_code=204)
async def whatsapp_disconnect(request: Request, db: DB, ctx: OrgContext = Manage):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "whatsapp"))
    if cred:
        await db.delete(cred)
        await audit.record(db, "integration.whatsapp_disconnected", actor=ctx.user, organization_id=ctx.org_id, request=request)
        await db.commit()


# ------------------------------------------------------------------ Email (Resend)

class EmailSenderIn(BaseModel):
    from_name: str = Field(min_length=2, max_length=80)
    reply_to: EmailStr | None = None


@router.get("/email")
async def email_status(ctx: Org, db: DB):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "email"))
    return {"provider": "resend", "configured": settings.resend_configured, "from_address": settings.email_from, "sender": cred.config if cred else {"from_name": ctx.organization.name}, "delivery": await channel_status(db, ctx.org_id, "email")}


@router.put("/email")
async def email_settings(data: EmailSenderIn, db: DB, ctx: OrgContext = Manage):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == ctx.org_id, IntegrationCredential.provider == "email"))
    if cred is None:
        cred = IntegrationCredential(organization_id=ctx.org_id, provider="email", status=IntegrationStatus.CONNECTED)
        db.add(cred)
    cred.config = data.model_dump(mode="json")
    await db.commit()
    return await email_status(ctx, db)


class TestEmailIn(BaseModel):
    to: EmailStr


@router.post("/email/test")
async def email_test(data: TestEmailIn, db: DB, ctx: OrgContext = Manage):
    from app.services import email_templates

    html, text = email_templates.notification("ReviewPilot test email", f"This is a test email for {ctx.organization.name}. If you received it, email delivery works.", None)
    result = await get_email_provider().send(to=data.to, subject="ReviewPilot test email", html=html, text=text)
    if not result.ok:
        raise AppError(f"Email failed: {result.error}", code="email_failed", status_code=502)
    return {"ok": True, "provider": result.provider, "simulated": result.provider != "resend"}
