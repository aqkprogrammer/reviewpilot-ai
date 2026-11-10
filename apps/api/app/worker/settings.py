"""ARQ worker entrypoint:  arq app.worker.settings.WorkerSettings"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from arq import cron
from arq.connections import RedisSettings
from arq.worker import func

from app.core.config import settings
from app.services.jobs import run_tracked
from app.worker.tasks import TASKS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _job(fn):
    # ARQ resolves jobs by name; set it explicitly so wrapped coroutines don't collide.
    async def job(ctx, job_id: str | None = None, **kwargs):
        return await run_tracked(fn, ctx, job_id, **kwargs)

    return func(job, name=fn.__name__)


def _cron_job(fn):
    async def job(ctx):
        return await run_tracked(fn, ctx, None)

    return job


async def heartbeat(ctx):
    await ctx["redis"].set("reviewpilot:worker:heartbeat", datetime.now(UTC).isoformat(), ex=180)


async def startup(ctx):
    await heartbeat(ctx)


class WorkerSettings:
    functions = [_job(f) for f in TASKS.values()]
    cron_jobs = [
        cron(heartbeat, name="heartbeat", second={0}),
        cron(_cron_job(TASKS["send_due_reminders"]), name="cron_send_due_reminders", minute={0, 15, 30, 45}),
        cron(_cron_job(TASKS["sync_all_google"]), name="cron_sync_all_google", minute={5}, hour=set(range(0, 24, 2))),
        cron(_cron_job(TASKS["subscription_maintenance"]), name="cron_subscription_maintenance", hour={1}, minute={30}),
        cron(_cron_job(TASKS["purge_deleted_organizations"]), name="cron_purge_deleted_organizations", hour={2}, minute={15}),
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    on_startup = startup
    max_jobs = 20
    job_timeout = 600
    max_tries = 3
    keep_result = 3600
