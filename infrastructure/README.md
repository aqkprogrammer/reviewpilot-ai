# Infrastructure

| File | Target |
| --- | --- |
| `../docker-compose.yml` | Local full stack (Postgres 17, Redis 7, migrate+seed, API, worker, web) |
| `railway.api.toml` | Railway API service (Dockerfile build, `alembic upgrade head` pre-deploy, `/healthz` check) |
| `railway.worker.toml` | Railway worker service (ARQ) |
| `../apps/web/vercel.json` | Vercel project settings for the Next.js app |

See `docs/DEPLOYMENT.md` for the full procedure and checklist.
