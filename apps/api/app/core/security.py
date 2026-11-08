"""Password hashing, JWT access tokens, opaque refresh tokens and signed state."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher()  # argon2id with library-recommended parameters
JWT_ALG = "HS256"
ISSUER = "reviewpilot-api"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        # Constant-ish time: still burn a hash verification for unknown users.
        _hasher.hash(password)
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def now() -> datetime:
    return datetime.now(UTC)


def create_access_token(user_id: uuid.UUID, session_id: uuid.UUID, platform_role: str) -> str:
    issued = now()
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        # Role is a hint for the client only; every request re-reads the user row.
        "prl": platform_role,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_ttl_minutes),
        "iss": ISSUER,
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALG)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALG], issuer=ISSUER, options={"require": ["exp", "sub"]})


def sign_state(data: dict[str, Any], ttl_seconds: int = 600) -> str:
    payload = {**data, "exp": now() + timedelta(seconds=ttl_seconds), "typ": "state"}
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALG)


def read_state(token: str) -> dict[str, Any]:
    data = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALG])
    if data.get("typ") != "state":
        raise jwt.InvalidTokenError("wrong token type")
    return data


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def hmac_sha256_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
