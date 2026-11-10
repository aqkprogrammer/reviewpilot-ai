"""Background tasks for the automations feature.

TASKS: task name -> async fn(ctx, **kwargs); registered with ARQ by app.worker.settings.
CRONS: list of (task_name, arq cron kwargs), e.g. ("send_weekly_digests", {"weekday": {0}, "hour": {3}, "minute": {30}}).
Times are UTC (IST = UTC+5:30).
"""

from __future__ import annotations

import logging
import uuid

from app.core.db import SessionLocal
from app.services import automations

log = logging.getLogger("reviewpilot.worker.automations")


async def process_visit_event(ctx, visit_id: str) -> dict:
    """Send the review request for one due visit (enqueued inline when a rule's delay is 0)."""
    async with SessionLocal() as db:
        return await automations.process_visit(db, uuid.UUID(visit_id))


async def process_due_visits(ctx) -> dict:
    """Every 5 minutes: send every scheduled visit whose time has come (all tenants)."""
    async with SessionLocal() as db:
        recovered = await automations.recover_stale(db)
        ids = await automations.due_visit_ids(db)
    results: dict[str, int] = {}
    for vid in ids:
        try:
            async with SessionLocal() as db:
                status = (await automations.process_visit(db, vid))["status"]
        except Exception:  # noqa: BLE001 — one visit's failure must not stop the batch
            log.exception("Automation visit %s failed", vid)
            status = "failed"
        results[status] = results.get(status, 0) + 1
    return {"due": len(ids), "recovered": recovered, **results}


TASKS: dict = {"process_visit_event": process_visit_event, "process_due_visits": process_due_visits}
CRONS: list = [("process_due_visits", {"minute": set(range(0, 60, 5))})]
