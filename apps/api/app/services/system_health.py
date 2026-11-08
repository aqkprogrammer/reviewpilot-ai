"""Exception capture + infrastructure health probes for Super Admin → System Health."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import timedelta

from fastapi import Request
from sqlalchemy import func, select, text

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.redis import get_redis
from app.core.security import now
from app.models import BackgroundJob, ErrorEvent, GoogleConnection, IntegrationCredential
from app.models.enums import IntegrationStatus, JobStatus

log = logging.getLogger("reviewpilot")
_pending: set[asyncio.Task] = set()


def record_exception(request: Request | None, exc: BaseException, source: str = "api") -> None:
    async def _save() -> None:
        try:
            async with SessionLocal() as db:
                db.add(
                    ErrorEvent(
                        source=source,
                        path=str(request.url.path) if request else None,
                        error_type=type(exc).__name__,
                        message=str(exc)[:2000],
                        request_id=getattr(request.state, "request_id", None) if request else None,
                        organization_id=getattr(request.state, "org_id", None) if request else None,
                    )
                )
                await db.commit()
        except Exception:  # noqa: BLE001
            log.exception("Failed to persist error event")

    try:
        task = asyncio.get_running_loop().create_task(_save())
        _pending.add(task)
        task.add_done_callback(_pending.discard)
    except RuntimeError:
        pass


async def health_snapshot() -> dict:
    out: dict = {"api": {"status": "ok", "environment": settings.environment, "demo_mode": settings.demo_mode}}
    t0 = time.perf_counter()
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
            out["database"] = {"status": "ok", "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}
            day_ago = now() - timedelta(days=1)
            out["jobs"] = {
                "queued": await db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status == JobStatus.QUEUED)),
                "running": await db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status == JobStatus.RUNNING)),
                "failed_24h": await db.scalar(
                    select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status == JobStatus.FAILED, BackgroundJob.created_at > day_ago)
                ),
                "succeeded_24h": await db.scalar(
                    select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status == JobStatus.SUCCEEDED, BackgroundJob.created_at > day_ago)
                ),
            }
            out["integration_errors"] = {
                "google": await db.scalar(
                    select(func.count()).select_from(GoogleConnection).where(
                        GoogleConnection.status.in_([IntegrationStatus.ERROR, IntegrationStatus.TOKEN_EXPIRED])
                    )
                ),
                "messaging": await db.scalar(
                    select(func.count()).select_from(IntegrationCredential).where(IntegrationCredential.status == IntegrationStatus.ERROR)
                ),
            }
            errors = (await db.scalars(select(ErrorEvent).order_by(ErrorEvent.created_at.desc()).limit(20))).all()
            out["recent_exceptions"] = [
                {"id": str(e.id), "created_at": e.created_at.isoformat(), "source": e.source, "path": e.path, "error_type": e.error_type, "message": e.message[:300]}
                for e in errors
            ]
    except Exception as exc:  # noqa: BLE001
        out["database"] = {"status": "down", "error": str(exc)[:200]}

    redis = await get_redis()
    if redis is None:
        out["redis"] = {"status": "unavailable", "note": "Jobs run inline (development fallback)" if settings.inline_jobs_fallback else "Jobs cannot be queued"}
        out["worker"] = {"status": "inline" if settings.inline_jobs_fallback else "down"}
        out["queue_backlog"] = 0
    else:
        t1 = time.perf_counter()
        try:
            await redis.ping()
            out["redis"] = {"status": "ok", "latency_ms": round((time.perf_counter() - t1) * 1000, 1)}
            out["queue_backlog"] = await redis.zcard("arq:queue")
            heartbeat = await redis.get("reviewpilot:worker:heartbeat")
            out["worker"] = {"status": "ok" if heartbeat else "no_heartbeat", "last_heartbeat": heartbeat}
        except Exception as exc:  # noqa: BLE001
            out["redis"] = {"status": "down", "error": str(exc)[:200]}
            out["worker"] = {"status": "unknown"}
    out["integrations_configured"] = {
        "google_oauth": settings.google_configured,
        "openai": settings.openai_configured,
        "resend": settings.resend_configured,
        "whatsapp_platform": settings.whatsapp_platform_configured,
        "stripe": settings.stripe_configured,
        "razorpay": settings.razorpay_configured,
        "s3": settings.s3_configured,
    }
    return out
