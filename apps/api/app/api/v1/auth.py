from __future__ import annotations

import html
import uuid
from urllib.parse import quote

import jwt
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import DB, REFRESH_COOKIE, CurrentUser, enforce_csrf
from app.core.errors import AppError, Unauthorized
from app.core.ratelimit import limiter
from app.core.security import hash_password, read_state, sign_state, verify_password
from app.models import AuthSession
from app.schemas.auth import (
    ChangePasswordIn,
    EmailIn,
    LoginIn,
    MeOut,
    ProfileUpdate,
    ProvidersOut,
    ResetPasswordIn,
    SessionOut,
    SignupIn,
    TokenIn,
    UserOut,
)
from app.schemas.common import Message
from app.services import account as account_svc
from app.services import audit
from app.services import auth as svc
from app.services.data_export import personal_export
from app.services.organizations import memberships_for

router = APIRouter(prefix="/auth", tags=["auth"])
OAUTH_COOKIE = "rp_oauth"


def user_out(user) -> UserOut:
    out = UserOut.model_validate(user)
    out.has_password = user.password_hash is not None
    return out


async def build_me(db, user) -> MeOut:
    return MeOut(user=user_out(user), memberships=await memberships_for(db, user), demo_mode=settings.demo_mode)


def _safe_next(value: str | None, default: str = "/app") -> str:
    if value and value.startswith("/") and not value.startswith("//"):
        return value
    return default


@router.get("/providers", response_model=ProvidersOut)
async def providers():
    return ProvidersOut(google=settings.google_configured or svc.google_mock_active(), google_mock=svc.google_mock_active() and not settings.google_configured, demo_mode=settings.demo_mode)


@router.post("/signup", response_model=MeOut, status_code=201, dependencies=[Depends(limiter("signup", 10, 3600))])
async def signup(data: SignupIn, request: Request, response: Response, db: DB):
    user = await svc.register(db, data, request)
    issued = await svc.issue_session(db, user, request, remember_me=True)
    await db.commit()
    svc.set_auth_cookies(response, issued)
    return await build_me(db, user)


@router.post("/login", response_model=MeOut, dependencies=[Depends(limiter("login", 30, 60))])
async def login(data: LoginIn, request: Request, response: Response, db: DB):
    user = await svc.authenticate(db, data.email, data.password, request)
    issued = await svc.issue_session(db, user, request, remember_me=data.remember_me)
    await db.commit()
    svc.set_auth_cookies(response, issued)
    return await build_me(db, user)


@router.post("/refresh", response_model=Message, dependencies=[Depends(limiter("refresh", 60, 60))])
async def refresh(request: Request, response: Response, db: DB):
    enforce_csrf(request)
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise Unauthorized("No session", code="session_invalid")
    try:
        _, issued = await svc.rotate_session(db, token, request)
    except Unauthorized:
        svc.clear_auth_cookies(response)
        raise
    await db.commit()
    svc.set_auth_cookies(response, issued)
    return Message(message="refreshed")


@router.post("/logout", response_model=Message)
async def logout(request: Request, response: Response, db: DB):
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        from app.core.security import hash_token

        session = await db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if session:
            await svc.revoke_session(db, session.id)
            await audit.record(db, "auth.logout", target_type="user", target_id=session.user_id, request=request)
            await db.commit()
    svc.clear_auth_cookies(response)
    return Message(message="Signed out")


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser, db: DB):
    return await build_me(db, user)


@router.patch("/me", response_model=UserOut)
async def update_profile(data: ProfileUpdate, user: CurrentUser, db: DB, request: Request):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await audit.record(db, "user.profile_updated", actor=user, target_type="user", target_id=user.id, request=request)
    await db.commit()
    return user_out(user)


class DeleteAccountIn(BaseModel):
    confirm: str
    password: str | None = None


@router.get("/me/deletion-check")
async def deletion_check(user: CurrentUser, db: DB):
    """What deleting this account would do (shown before the user confirms)."""
    blocking, solo = await account_svc.deletion_blockers(db, user)
    return {"blocked_by": blocking, "organizations_scheduled": [o.name for o in solo], "requires_password": user.password_hash is not None}


@router.delete("/me", response_model=Message, dependencies=[Depends(limiter("delete-account", 5, 3600))])
async def delete_my_account(data: DeleteAccountIn, request: Request, response: Response, user: CurrentUser, db: DB):
    if data.confirm != "DELETE":
        raise AppError('Type DELETE to confirm.', code="confirmation_required")
    if user.password_hash is not None and not verify_password(data.password or "", user.password_hash):
        raise AppError("Password is incorrect.", code="invalid_password")
    await account_svc.delete_account(db, user, request)
    svc.clear_auth_cookies(response)
    return Message(message="Your account has been deleted.")


@router.get("/me/export", dependencies=[Depends(limiter("me-export", 5, 3600))])
async def export_my_data(request: Request, user: CurrentUser, db: DB):
    import json

    payload = await personal_export(db, user)
    await audit.record(db, "user.data_exported", actor=user, target_type="user", target_id=user.id, request=request)
    await db.commit()
    return Response(json.dumps(payload, indent=2, ensure_ascii=False, default=str), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="reviewpilot-my-data.json"'})


@router.post("/verify-email", response_model=Message, dependencies=[Depends(limiter("verify", 20, 60))])
async def verify_email(data: TokenIn, db: DB, request: Request):
    user = await svc.consume_token(db, data.token, "verify_email")
    from app.core.security import now

    user.email_verified_at = user.email_verified_at or now()
    await audit.record(db, "auth.email_verified", actor=user, target_type="user", target_id=user.id, request=request)
    await db.commit()
    return Message(message="Email verified")


@router.post("/resend-verification", response_model=Message, dependencies=[Depends(limiter("resend", 5, 600))])
async def resend_verification(user: CurrentUser, db: DB):
    if user.email_verified:
        return Message(message="Email already verified")
    await svc.send_verification_email(db, user)
    await db.commit()
    return Message(message="Verification email sent")


@router.post("/forgot-password", response_model=Message, dependencies=[Depends(limiter("forgot", 5, 600))])
async def forgot_password(data: EmailIn, db: DB, request: Request):
    await svc.send_password_reset(db, data.email, request)
    await db.commit()
    return Message(message="If an account exists for that email, a reset link is on its way.")


@router.post("/reset-password", response_model=Message, dependencies=[Depends(limiter("reset", 10, 600))])
async def reset_password(data: ResetPasswordIn, db: DB, request: Request, response: Response):
    user = await svc.consume_token(db, data.token, "reset_password")
    user.password_hash = hash_password(data.password)
    await svc.revoke_all_sessions(db, user.id, "password_reset")
    await audit.record(db, "auth.password_reset", actor=user, target_type="user", target_id=user.id, request=request)
    await db.commit()
    svc.clear_auth_cookies(response)
    return Message(message="Password updated. Sign in with your new password.")


@router.post("/change-password", response_model=Message)
async def change_password(data: ChangePasswordIn, user: CurrentUser, db: DB, request: Request):
    if user.password_hash is not None and not verify_password(data.current_password or "", user.password_hash):
        raise AppError("Current password is incorrect.", code="invalid_password", status_code=400)
    user.password_hash = hash_password(data.new_password)
    await svc.revoke_all_sessions(db, user.id, "password_changed", except_id=getattr(request.state, "session_id", None))
    await audit.record(db, "auth.password_changed", actor=user, target_type="user", target_id=user.id, request=request)
    await db.commit()
    return Message(message="Password changed. Other sessions were signed out.")


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(user: CurrentUser, db: DB, request: Request):
    from app.core.security import now

    rows = (
        await db.scalars(
            select(AuthSession)
            .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None), AuthSession.expires_at > now())
            .order_by(AuthSession.last_used_at.desc().nullslast())
        )
    ).all()
    current = getattr(request.state, "session_id", None)
    return [SessionOut.model_validate(s).model_copy(update={"current": s.id == current}) for s in rows]


@router.delete("/sessions/{session_id}", response_model=Message)
async def revoke_session(session_id: uuid.UUID, user: CurrentUser, db: DB, request: Request):
    session = await db.get(AuthSession, session_id)
    if session is None or session.user_id != user.id:
        raise AppError("Session not found", code="not_found", status_code=404)
    await svc.revoke_session(db, session_id, "user_revoked")
    await audit.record(db, "auth.session_revoked", actor=user, target_type="session", target_id=session_id, request=request)
    await db.commit()
    return Message(message="Session revoked")


# ---------------------------------------------------------------- Google sign-in

@router.get("/google/start", dependencies=[Depends(limiter("google-start", 30, 60))])
async def google_start(next: str | None = None):
    if not (settings.google_configured or svc.google_mock_active()):
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_not_configured", status_code=302)
    verifier, challenge = svc.pkce_pair()
    state = sign_state({"nonce": svc.generate_token(16), "next": _safe_next(next, "")}, ttl_seconds=600)
    response = RedirectResponse(svc.google_authorize_url(state, challenge), status_code=302)
    response.set_cookie(
        OAUTH_COOKIE, sign_state({"state": state, "verifier": verifier}, 600), httponly=True,
        secure=settings.cookie_secure, samesite="lax", path="/api/v1/auth/google", max_age=600,
    )
    return response


@router.get("/google/callback")
async def google_callback(request: Request, db: DB, code: str | None = None, state: str | None = None, error: str | None = None):
    fail = lambda reason: RedirectResponse(f"{settings.frontend_url}/login?error={quote(reason)}", status_code=302)  # noqa: E731
    if error or not code or not state:
        return fail("google_cancelled")
    try:
        cookie = read_state(request.cookies.get(OAUTH_COOKIE, ""))
        state_data = read_state(state)
    except jwt.InvalidTokenError:
        return fail("oauth_state_invalid")
    if cookie.get("state") != state:
        return fail("oauth_state_invalid")
    try:
        info = await svc.google_exchange(code, cookie["verifier"])
        user, created = await svc.google_sign_in(db, info, request)
    except AppError as exc:
        return fail(exc.code)
    issued = await svc.issue_session(db, user, request, remember_me=True)
    await db.commit()
    memberships = await memberships_for(db, user)
    if user.is_super_admin and not memberships:
        dest = "/admin"
    elif not memberships or not any(m["organization"]["onboarding_completed"] for m in memberships):
        dest = "/onboarding"
    else:
        dest = state_data.get("next") or "/app"
    response = RedirectResponse(f"{settings.frontend_url}{dest}", status_code=302)
    svc.set_auth_cookies(response, issued)
    response.delete_cookie(OAUTH_COOKIE, path="/api/v1/auth/google")
    return response


@router.get("/google/mock", response_class=HTMLResponse, include_in_schema=False)
async def google_mock_consent(state: str):
    """Development/E2E-only stand-in for Google's consent screen. Disabled in production."""
    if not svc.google_mock_active():
        raise AppError("Not found", code="not_found", status_code=404)
    s = html.escape(state)
    return HTMLResponse(f"""<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><title>Mock Google Sign-In</title>
<style>body{{font-family:system-ui;background:#f1f3f4;display:grid;place-items:center;min-height:100vh;margin:0}}form{{background:#fff;padding:32px;border-radius:16px;width:340px;box-shadow:0 2px 12px #0001}}
input{{width:100%;box-sizing:border-box;padding:10px;margin:6px 0 14px;border:1px solid #ccc;border-radius:8px}}button{{width:100%;padding:11px;border:0;border-radius:8px;background:#1a73e8;color:#fff;font-weight:600}}
.b{{font-size:12px;background:#fef7e0;color:#8a6d00;padding:8px 10px;border-radius:8px;margin-bottom:16px}}</style></head>
<body><form onsubmit="event.preventDefault();var e=this.email.value,n=this.name.value;var c='mock:'+btoa(JSON.stringify({{email:e,name:n}})).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');location.href='/api/v1/auth/google/callback?code='+encodeURIComponent(c)+'&state={s}'">
<div class=b>Development mock — not real Google. Disabled in production.</div><h2 style="margin:0 0 16px">Choose an account</h2>
<label>Email<input name=email type=email required value="google.user@example.com"></label><label>Name<input name=name value="Google Test User"></label><button>Continue</button></form></body></html>""")
