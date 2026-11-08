"""Symmetric encryption for integration credentials at rest (Fernet / AES-128-CBC + HMAC)."""

from __future__ import annotations

import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet = Fernet(settings.encryption_key.encode())


def encrypt(value: str | None) -> str | None:
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return None


def encrypt_json(data: dict[str, Any]) -> str:
    return _fernet.encrypt(json.dumps(data).encode()).decode()


def decrypt_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        return json.loads(_fernet.decrypt(value.encode()))
    except (InvalidToken, ValueError):
        return {}


def mask(value: str | None, keep: int = 4) -> str | None:
    if not value:
        return None
    return ("•" * 8) + value[-keep:]
