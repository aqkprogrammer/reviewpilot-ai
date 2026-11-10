"""Background job dispatch.

Jobs are recorded in `background_jobs` and enqueued to ARQ (Redis). In development,
when Redis is unreachable and INLINE_JOBS_FALLBACK=true, they run in-process so the
product is demonstrable without extra infrastructure. Production refuses that fallback.
"""

from __future__ import annotations

import asyncio
import logging
import traceback
import uuid
from datetime import UTC, datetime
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.redis import get_redis
from app.models import BackgroundJob
from app.models.enums import JobStatus

log = logging.getLogger("reviewpilot.jobs")
_pool: ArqRedis | None = None
_inline_tasks: set[asyncio.Task] = set()


async def _get_pool() -> ArqRedis | None:
    global _pool
    if await get_redis() is None:
        return None
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool


async def enqueue(name: str, *, organization_id: uuid.UUID | None = None, defer_seconds: int | None = None, **kwargs: Any) -> uuid.UUID:
    async with SessionLocal() as db:
        job = BackgroundJob(name=name, organization_id=organization_id, args=_jsonable(kwargs))
        db.add(job)
        await db.commit()
        job_id = job.id

    pool = await _get_pool()
    if pool is not None:
        await pool.enqueue_job(name, str(job_id), _defer_by=defer_seconds, **kwargs)
        return job_id

    if not settings.inline_jobs_fallback:
        raise RuntimeError("Redis unavailable and inline job fallback disabled")
    async with SessionLocal() as db:
        job = await db.get(BackgroundJob, job_id)
        if job:
            job.runner = "inline"
            await db.commit()

    async def _run() -> None:
        if defer_seconds:
            await asyncio.sleep(min(defer_seconds, 5))
        from app.worker.settings import TASKS

        await run_tracked(TASKS[name], {"inline": True}, str(job_id), **kwargs)

    task = asyncio.create_task(_run())
    _inline_tasks.add(task)
    task.add_done_callback(_inline_tasks.discard)
    return job_id


async def run_tracked(fn, ctx: dict, job_id: str | None, **kwargs: Any) -> Any:
    """Execute a task function while recording status in background_jobs."""
    jid = uuid.UUID(job_id) if job_id else None
    if jid:
        async with SessionLocal() as db:
            job = await db.get(BackgroundJob, jid)
            if job:
                job.status = JobStatus.RUNNING
                job.started_at = datetime.now(UTC)
                job.attempts += 1
                await db.commit()
    try:
        result = await fn(ctx, **kwargs)
        status, error = JobStatus.SUCCEEDED, None
    except Exception as exc:  # noqa: BLE001
        log.exception("Job %s failed", getattr(fn, "__name__", fn))
        result, status, error = None, JobStatus.FAILED, f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=3)}"
        await _finish_async(jid, status, result, error)
        if not ctx.get("inline"):
            raise  # let ARQ apply its retry policy
        return None
    await _finish_async(jid, status, result, error)
    return result


async def _finish_async(jid: uuid.UUID | None, status: str, result: Any, error: str | None) -> None:
    if not jid:
        return
    async with SessionLocal() as db:
        job = await db.get(BackgroundJob, jid)
        if job:
            job.status = status
            job.finished_at = datetime.now(UTC)
            job.error = error
            job.result = _jsonable(result) if isinstance(result, dict) else {"value": str(result)} if result is not None else {}
            await db.commit()


def _jsonable(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _jsonable(v) for k, v in data.items()}
    if isinstance(data, list | tuple):
        return [_jsonable(v) for v in data]
    if isinstance(data, uuid.UUID | datetime):
        return str(data)
    return data


async def drain_inline_tasks(timeout: float = 10) -> None:
    """Test helper: wait for in-process jobs to finish."""
    if _inline_tasks:
        await asyncio.wait(list(_inline_tasks), timeout=timeout)
