"""Background tasks for the digest feature.

TASKS: task name -> async fn(ctx, **kwargs); registered with ARQ by app.worker.settings.
CRONS: list of (task_name, arq cron kwargs). Times are UTC (IST = UTC+5:30).

`send_weekly_digests` runs every Monday 03:30 UTC (09:00 IST) and is idempotent per
organization per ISO week, so a repeated run (or `enqueue("send_weekly_digests")` through
the inline dev fallback) never double-sends.
"""

from __future__ import annotations

import uuid
from datetime import date

from app.core.db import SessionLocal
from app.services import digest


async def send_weekly_digests(ctx, week_end: str | None = None) -> dict:
    async with SessionLocal() as db:
        return await digest.send_weekly_digests(db, date.fromisoformat(week_end) if week_end else None)


async def send_org_digest(ctx, organization_id: str, week_end: str | None = None) -> dict:
    async with SessionLocal() as db:
        return await digest.send_org_digest(db, uuid.UUID(organization_id), date.fromisoformat(week_end) if week_end else None)


TASKS: dict = {"send_weekly_digests": send_weekly_digests, "send_org_digest": send_org_digest}
CRONS: list = [("send_weekly_digests", {"weekday": {0}, "hour": {3}, "minute": {30}})]
