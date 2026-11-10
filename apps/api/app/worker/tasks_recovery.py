"""Background tasks for the recovery feature.

TASKS: task name -> async fn(ctx, **kwargs); registered with ARQ by app.worker.settings.
CRONS: list of (task_name, arq cron kwargs), e.g. ("send_weekly_digests", {"weekday": {0}, "hour": {3}, "minute": {30}}).
Times are UTC (IST = UTC+5:30).
"""

from __future__ import annotations

import uuid

from app.core.db import SessionLocal
from app.services import recovery


async def send_recovery_alert(ctx, case_id: str) -> dict:
    """In-app/email alert + optional WhatsApp owner alert for a newly opened case (once per case)."""
    async with SessionLocal() as db:
        return await recovery.send_alert(db, uuid.UUID(case_id))


async def check_recovery_sla(ctx) -> dict:
    """Every 10 minutes: mark overdue cases as breached (once) and re-dispatch any missed alerts."""
    async with SessionLocal() as db:
        result = await recovery.check_sla(db)
    async with SessionLocal() as db:
        missed = await recovery.unalerted_case_ids(db)
    for cid in missed:
        async with SessionLocal() as db:
            await recovery.send_alert(db, cid)
    return {**result, "late_alerts": len(missed)}


TASKS: dict = {f.__name__: f for f in (send_recovery_alert, check_recovery_sla)}
CRONS: list = [("check_recovery_sla", {"minute": set(range(0, 60, 10))})]
