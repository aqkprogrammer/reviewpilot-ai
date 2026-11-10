"""Optional Sentry error monitoring.

Self-hosted capture already happens via `error_events` (Super Admin → System health); Sentry is an
opt-in extra. Nothing is initialised unless `SENTRY_DSN` is set. Values are read from the process
environment (falling back to the same `.env` files pydantic-settings uses) so this module has no
coupling to `app.core.config`.

Env:
- SENTRY_DSN                  — enables Sentry when non-empty
- SENTRY_ENVIRONMENT          — defaults to ENVIRONMENT (or "development")
- SENTRY_RELEASE              — defaults to RELEASE / RENDER_GIT_COMMIT / GIT_SHA when present
- SENTRY_TRACES_SAMPLE_RATE   — float 0..1, default 0 (errors only, no performance tracing)
"""

from __future__ import annotations

import logging
import os
from functools import cache
from pathlib import Path

log = logging.getLogger("reviewpilot")
_initialised = False
_API_DIR = Path(__file__).resolve().parents[2]


@cache
def _env_files() -> dict[str, str]:
    """Same `.env` files pydantic-settings reads (it does not export them to os.environ)."""
    try:
        from dotenv import dotenv_values
    except ImportError:  # pragma: no cover
        return {}
    merged: dict[str, str] = {}
    for path in (_API_DIR.parents[1] / ".env", _API_DIR / ".env"):
        if path.is_file():
            merged.update({k.upper(): v for k, v in dotenv_values(path).items() if v is not None})
    return merged


def _env(name: str, default: str = "") -> str:
    """Process environment wins; fall back to the `.env` files."""
    value = os.environ.get(name)
    if value is None:
        value = _env_files().get(name)
    return (value or default).strip()


def _float_env(name: str, default: float) -> float:
    try:
        return min(max(float(_env(name) or default), 0.0), 1.0)
    except ValueError:
        return default


def init_monitoring() -> bool:
    """Initialise Sentry once if SENTRY_DSN is configured. Returns True when Sentry is active."""
    global _initialised
    if _initialised:
        return True
    dsn = _env("SENTRY_DSN")
    if not dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover - dependency is declared, but stay safe
        log.warning("SENTRY_DSN is set but sentry-sdk is not installed; skipping Sentry")
        return False
    release = _env("SENTRY_RELEASE") or _env("RELEASE") or _env("RENDER_GIT_COMMIT") or _env("GIT_SHA")
    sentry_sdk.init(
        dsn=dsn,
        environment=_env("SENTRY_ENVIRONMENT") or _env("ENVIRONMENT", "development"),
        release=release or None,
        traces_sample_rate=_float_env("SENTRY_TRACES_SAMPLE_RATE", 0.0),
        send_default_pii=False,
    )
    _initialised = True
    log.info("Sentry monitoring enabled")
    return True


init_monitoring()
