"""Shared Redis client with graceful degradation in development."""

from __future__ import annotations

import logging

from redis.asyncio import Redis

from app.core.config import settings

log = logging.getLogger("reviewpilot")
_client: Redis | None = None
_available: bool | None = None


async def get_redis() -> Redis | None:
    """Return a connected Redis client, or None when unavailable (dev fallback)."""
    global _client, _available
    if _available is False:
        return None
    if _client is None:
        _client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
    if _available is None:
        try:
            await _client.ping()
            _available = True
        except Exception:
            log.warning("Redis unavailable at %s — using in-process fallbacks", settings.redis_url)
            _available = False
            return None
    return _client


def reset_redis_state() -> None:
    global _client, _available
    _client, _available = None, None
