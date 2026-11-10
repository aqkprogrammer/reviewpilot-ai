"""Authentication domain logic: credentials, sessions (refresh rotation), tokens, Google sign-in."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ratelimit
from app.core.config import settings
from app.core.deps import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE
from app.core.errors import AppError, Conflict, RateLimited, Unauthorized
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    needs_rehash,
    now,
    verify_password,
)
from app.models import AuthSession, AuthToken, NotificationPreference, OAuthIdentity, User
from app.models.enums import UserStatus
from app.models.notification import NOTIFICATION_TYPES
from app.providers.email import get_email_provider
from app.services import audit, email_templates
from app.services.organizations import create_organization

log = logging.getLogger("reviewpilot.auth")

REFRESH_COOKIE_PATH = "/api/v1/auth"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None)))


# ---------------------------------------------------------------- sessions

@dataclass
class IssuedSession:
    access_token: str
    refresh_token: str
    csrf_token: str
    session: AuthSession


async def issue_session(db: AsyncSession, user: User, request: Request, *, remember_me: bool = True) -> IssuedSession:
    refresh = generate_token(48)
    ttl = timedelta(days=settings.refresh_token_ttl_days if remember_me else settings.refresh_token_ttl_days_short)
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=now() + ttl,
        remember_me=remember_me,
        last_used_at=now(),
        ip_address=ratelimit.client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:500],
    )
    db.add(session)
    await db.flush()
    user.last_login_at = now()
    return IssuedSession(create_access_token(user.id, session.id, user.platform_role), refresh, generate_token(24), session)


async def rotate_session(db: AsyncSession, refresh_token: str, request: Request) -> tuple[User, IssuedSession]:
    token_hash = hash_token(refresh_token)
    session = await db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
    if session is None:
        # Reuse detection: a previously-rotated token was presented → revoke the whole family.
        stale = await db.scalar(select(AuthSession).where(AuthSession.previous_token_hash == token_hash))
        if stale is not None and stale.revoked_at is None:
            stale.revoked_at = now()
            stale.revoked_reason = "refresh_token_reuse"
            await audit.record(db, "auth.refresh_reuse_detected", target_type="user", target_id=stale.user_id, request=request)
            await db.commit()
        raise Unauthorized("Session expired. Please sign in again.", code="session_invalid")
    if session.revoked_at is not None or session.expires_at < now():
        raise Unauthorized("Session expired. Please sign in again.", code="session_invalid")
    user = await db.get(User, session.user_id)
    if user is None or user.deleted_at is not None or user.status != UserStatus.ACTIVE:
        raise Unauthorized("Account unavailable", code="session_invalid")

    new_refresh = generate_token(48)
    session.previous_token_hash = session.token_hash
    session.token_hash = hash_token(new_refresh)
    session.last_used_at = now()
    if session.remember_me:
        session.expires_at = now() + timedelta(days=settings.refresh_token_ttl_days)
    issued = IssuedSession(create_access_token(user.id, session.id, user.platform_role), new_refresh, generate_token(24), session)
    return user, issued


async def revoke_session(db: AsyncSession, session_id: uuid.UUID, reason: str = "logout") -> None:
    await db.execute(
        update(AuthSession).where(AuthSession.id == session_id, AuthSession.revoked_at.is_(None)).values(revoked_at=now(), revoked_reason=reason)
    )


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID, reason: str, except_id: uuid.UUID | None = None) -> None:
    stmt = update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    if except_id:
        stmt = stmt.where(AuthSession.id != except_id)
    await db.execute(stmt.values(revoked_at=now(), revoked_reason=reason))


def set_auth_cookies(response: Response, issued: IssuedSession) -> None:
    secure = settings.cookie_secure
    domain = settings.cookie_domain
    persistent_age = int((issued.session.expires_at - now()).total_seconds()) if issued.session.remember_me else None
    response.set_cookie(
        ACCESS_COOKIE, issued.access_token, httponly=True, secure=secure, samesite="lax", path="/",
        max_age=settings.access_token_ttl_minutes * 60 + 60, domain=domain,
    )
    response.set_cookie(
        REFRESH_COOKIE, issued.refresh_token, httponly=True, secure=secure, samesite="lax",
        path=REFRESH_COOKIE_PATH, max_age=persistent_age, domain=domain,
    )
    # Readable by JS so the client can echo it in X-CSRF-Token (double-submit).
    response.set_cookie(CSRF_COOKIE, issued.csrf_token, httponly=False, secure=secure, samesite="lax", path="/", max_age=persistent_age, domain=domain)


def clear_auth_cookies(response: Response) -> None:
    domain = settings.cookie_domain
    response.delete_cookie(ACCESS_COOKIE, path="/", domain=domain)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, domain=domain)
    response.delete_cookie(CSRF_COOKIE, path="/", domain=domain)


# ---------------------------------------------------------------- registration / login

async def _default_notification_prefs(db: AsyncSession, user: User) -> None:
    for t in NOTIFICATION_TYPES:
        if t == "digest.weekly":
            continue  # role-based default (owner/admin on) until the user chooses; see services.digest
        db.add(NotificationPreference(user_id=user.id, type=t, in_app=True, email=t not in ("review.new",)))


async def register(db: AsyncSession, data, request: Request) -> User:
    email = normalize_email(data.email)
    if await get_user_by_email(db, email):
        raise Conflict("An account with this email already exists. Try signing in instead.", code="email_taken")
    user = User(email=email, full_name=data.full_name.strip(), phone=data.phone, password_hash=hash_password(data.password))
    db.add(user)
    await db.flush()
    await _default_notification_prefs(db, user)
    org = await create_organization(db, owner=user, name=data.business_name, industry=data.industry, country=data.country, phone=data.phone)
    await audit.record(db, "auth.signup", actor=user, organization_id=org.id, target_type="user", target_id=user.id, request=request)
    await send_verification_email(db, user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str, request: Request) -> User:
    email = normalize_email(email)
    window = settings.login_lockout_minutes * 60
    lock_key = f"login-fail:{email}"
    if await ratelimit.peek(lock_key, window) >= settings.login_max_attempts:
        await audit.record(db, "auth.login_locked", target_type="email", target_id=email, request=request)
        await db.commit()
        raise RateLimited(
            f"Too many failed attempts. Try again in {settings.login_lockout_minutes} minutes or reset your password.",
            code="login_locked",
        )
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        await ratelimit.hit(lock_key, settings.login_max_attempts, window)
        await audit.record(
            db, "auth.login_failed", actor=None, target_type="email", target_id=email, request=request,
            meta={"reason": "invalid_credentials" if user else "unknown_email"},
        )
        await db.commit()
        if user is not None and user.password_hash is None:
            raise Unauthorized("This account uses Google Sign-In. Continue with Google or reset your password.", code="use_google")
        raise Unauthorized("Incorrect email or password.", code="invalid_credentials")
    if user.status != UserStatus.ACTIVE:
        raise AppError("This account has been disabled. Contact support.", code="account_disabled", status_code=403)
    if needs_rehash(user.password_hash or ""):
        user.password_hash = hash_password(password)
    await ratelimit.reset(lock_key, window)
    await audit.record(db, "auth.login", actor=user, target_type="user", target_id=user.id, request=request)
    return user


# ---------------------------------------------------------------- one-time tokens

async def _create_token(db: AsyncSession, user: User, purpose: str, ttl: timedelta) -> str:
    await db.execute(
        update(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used_at.is_(None)).values(used_at=now())
    )
    raw = generate_token(32)
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw), expires_at=now() + ttl))
    return raw


async def consume_token(db: AsyncSession, raw: str, purpose: str) -> User:
    token = await db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose))
    if token is None or token.used_at is not None or token.expires_at < now():
        raise AppError("This link is invalid or has expired. Request a new one.", code="token_invalid")
    token.used_at = now()
    user = await db.get(User, token.user_id)
    if user is None or user.deleted_at is not None:
        raise AppError("Account not found", code="token_invalid")
    return user


async def send_verification_email(db: AsyncSession, user: User) -> None:
    raw = await _create_token(db, user, "verify_email", timedelta(hours=24))
    subject, html, text = email_templates.verify_email(user.full_name, raw)
    await get_email_provider().send(to=user.email, subject=subject, html=html, text=text)


async def send_password_reset(db: AsyncSession, email: str, request: Request) -> None:
    user = await get_user_by_email(db, email)
    if user is None or user.status != UserStatus.ACTIVE:
        return  # never reveal whether an account exists
    raw = await _create_token(db, user, "reset_password", timedelta(minutes=60))
    subject, html, text = email_templates.reset_password(user.full_name, raw)
    await get_email_provider().send(to=user.email, subject=subject, html=html, text=text)
    await audit.record(db, "auth.password_reset_requested", actor=user, target_type="user", target_id=user.id, request=request)


# ---------------------------------------------------------------- Google sign-in (OAuth 2.0 + PKCE)

def pkce_pair() -> tuple[str, str]:
    verifier = generate_token(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def google_mock_active() -> bool:
    return settings.oauth_mock_enabled and not settings.is_production


def google_authorize_url(state: str, challenge: str) -> str:
    if google_mock_active() and not settings.google_configured:
        return f"{settings.frontend_url}/api/v1/auth/google/mock?{urlencode({'state': state})}"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.sign_in_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def google_exchange(code: str, verifier: str) -> dict:
    """Exchange the authorization code and return verified OpenID userinfo."""
    if code.startswith("mock:"):
        if not google_mock_active():
            raise AppError("Mock OAuth is disabled", code="oauth_failed")
        info = json.loads(base64.urlsafe_b64decode(code[5:] + "==").decode())
        return {"sub": f"mock-{info['email']}", "email": info["email"], "email_verified": True, "name": info.get("name") or info["email"].split("@")[0], "picture": None}
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.sign_in_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": verifier,
            },
        )
        if token_res.status_code != 200:
            log.warning("Google token exchange failed: %s", token_res.text[:300])
            raise AppError("Google sign-in failed. Please try again.", code="oauth_failed")
        access_token = token_res.json().get("access_token")
        info_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if info_res.status_code != 200:
            raise AppError("Could not read your Google profile.", code="oauth_failed")
        return info_res.json()


async def google_sign_in(db: AsyncSession, info: dict, request: Request) -> tuple[User, bool]:
    """Return (user, created). Links to an existing account only when Google verified the email."""
    sub = str(info.get("sub") or "")
    email = normalize_email(info.get("email") or "")
    if not sub or not email:
        raise AppError("Google did not return an email address.", code="oauth_failed")
    identity = await db.scalar(select(OAuthIdentity).where(OAuthIdentity.provider == "google", OAuthIdentity.provider_subject == sub))
    if identity is not None:
        user = await db.get(User, identity.user_id)
        if user is None or user.deleted_at is not None:
            raise AppError("Account not found", code="oauth_failed")
        if user.status != UserStatus.ACTIVE:
            raise AppError("This account has been disabled.", code="account_disabled", status_code=403)
        await audit.record(db, "auth.login_google", actor=user, target_type="user", target_id=user.id, request=request)
        return user, False

    if not info.get("email_verified"):
        raise AppError("Your Google email address is not verified.", code="oauth_unverified_email")

    user = await get_user_by_email(db, email)
    created = False
    if user is None:
        user = User(email=email, full_name=info.get("name") or email.split("@")[0], avatar_url=info.get("picture"), email_verified_at=now())
        db.add(user)
        await db.flush()
        await _default_notification_prefs(db, user)
        created = True
        await audit.record(db, "auth.signup_google", actor=user, target_type="user", target_id=user.id, request=request)
    else:
        if user.status != UserStatus.ACTIVE:
            raise AppError("This account has been disabled.", code="account_disabled", status_code=403)
        if user.email_verified_at is None:
            user.email_verified_at = now()
        if not user.avatar_url and info.get("picture"):
            user.avatar_url = info.get("picture")
        await audit.record(db, "auth.google_linked", actor=user, target_type="user", target_id=user.id, request=request)
    db.add(OAuthIdentity(user_id=user.id, provider="google", provider_subject=sub, email=email))
    return user, created
