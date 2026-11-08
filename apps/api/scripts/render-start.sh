#!/usr/bin/env sh
# Render start command for the API service.
# Runs migrations and reference seeds on every boot (both idempotent), optionally
# seeds demo data, optionally runs the ARQ worker in the same instance (free-tier
# friendly), then serves the API.
set -e
alembic upgrade head
python -m app.cli seed
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  python -m app.cli seed-demo
fi
if [ "${RUN_WORKER_IN_PROCESS:-false}" = "true" ]; then
  arq app.worker.settings.WorkerSettings &
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
