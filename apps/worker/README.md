# ReviewPilot AI — Worker

The background worker runs [ARQ](https://arq-docs.helpmanual.io/) against Redis. To keep one
source of truth for models and services (modular monolith), the task code lives in the API
package:

| Path | Purpose |
| --- | --- |
| `apps/api/app/worker/tasks.py` | Task functions (campaign processing, sends, reminders, Google sync, reply publishing, AI insights, subscription maintenance) |
| `apps/api/app/worker/settings.py` | `WorkerSettings`: function registry, cron schedule, retries, heartbeat |
| `apps/api/app/services/jobs.py` | `enqueue()` used by the API; records every job in `background_jobs` |

## Run locally

```bash
cd apps/api
uv run arq app.worker.settings.WorkerSettings
```

Requires `REDIS_URL`. Without Redis in development, the API runs jobs in-process
(`INLINE_JOBS_FALLBACK=true`); production refuses that fallback.

## Cron schedule (UTC)

| Job | Schedule |
| --- | --- |
| `heartbeat` (writes `reviewpilot:worker:heartbeat`, read by System Health) | every minute |
| `send_due_reminders` | every 15 minutes |
| `sync_all_google` | every 2 hours at :05 |
| `subscription_maintenance` (expire trials / lapsed grace periods) | daily 01:30 |

## Docker

`apps/worker/Dockerfile` builds from the repository root:

```bash
docker build -f apps/worker/Dockerfile -t reviewpilot-worker .
```
