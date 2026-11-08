"""Fixed-window rate limiting (Redis-backed with in-memory fallback)."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request

from app.core.errors import RateLimited
from app.core.redis import get_redis

_memory: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))


async def hit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Increment a counter; return (allowed, current_count)."""
    redis = await get_redis()
    bucket = f"rl:{key}:{int(time.time() // window_seconds)}"
    if redis is not None:
        count = await redis.incr(bucket)
        if count == 1:
            await redis.expire(bucket, window_seconds)
        return count <= limit, count
    count, expires = _memory[bucket]
    now = time.time()
    if now > expires:
        count, expires = 0, now + window_seconds
    count += 1
    _memory[bucket] = (count, expires)
    return count <= limit, count


async def peek(key: str, window_seconds: int) -> int:
    redis = await get_redis()
    bucket = f"rl:{key}:{int(time.time() // window_seconds)}"
    if redis is not None:
        return int(await redis.get(bucket) or 0)
    return _memory.get(bucket, (0, 0.0))[0]


async def reset(key: str, window_seconds: int) -> None:
    redis = await get_redis()
    bucket = f"rl:{key}:{int(time.time() // window_seconds)}"
    if redis is not None:
        await redis.delete(bucket)
    else:
        _memory.pop(bucket, None)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limiter(name: str, limit: int, window_seconds: int = 60):
    """FastAPI dependency factory: limit by client IP."""

    async def _dep(request: Request) -> None:
        allowed, _ = await hit(f"{name}:{client_ip(request)}", limit, window_seconds)
        if not allowed:
            raise RateLimited("Too many requests. Please slow down and try again shortly.")

    return _dep


def clear_memory() -> None:
    _memory.clear()
