# Development

## Toolchain
Node 22+, pnpm 10+ (workspace: `apps/web`, `packages/*`), Python 3.12+ with uv (`apps/api`),
PostgreSQL 15+ and Redis 7 (optional locally).

## First-time setup
```bash
cp .env.example .env
# Postgres role + databases (Homebrew/Postgres.app example)
psql -d postgres -c "CREATE ROLE reviewpilot LOGIN PASSWORD 'reviewpilot' CREATEDB"
psql -d postgres -c "CREATE DATABASE reviewpilot OWNER reviewpilot"
psql -d postgres -c "CREATE DATABASE reviewpilot_test OWNER reviewpilot"
make install        # pnpm install && (cd apps/api && uv sync)
make migrate
make seed-demo
```
Or `docker compose up --build` for everything (Postgres, Redis, migrate+seed, API, worker, web).

## Daily loop
| Task | Command |
| --- | --- |
| API (reload) | `make api` → http://localhost:8000/api/v1/docs |
| Web | `make web` → http://localhost:3000 |
| Worker | `make worker` (needs Redis; without Redis jobs run in-process) |
| New migration | `make migration m="add foo"` then review the generated file |
| Reset DB | `dropdb reviewpilot && createdb -O reviewpilot reviewpilot && make migrate seed-demo` |
| Dev emails | `curl localhost:8000/api/v1/dev/outbox` (verification, reset, invitation links) |
| Mock Google sign-in | set `OAUTH_MOCK_ENABLED=true`, click "Continue with Google" |
| Simulated payments | `DEMO_MODE=true` → checkout opens the simulated payment page |

## Tests
- **Backend:** `make test-api`. `tests/conftest.py` sets env vars before importing the app, drops
  and recreates the `public` schema of `reviewpilot_test`, runs Alembic, seeds plans/templates and
  points Redis at an unused port so jobs run inline (`drain_inline_tasks()`). Helpers: `signup`,
  `login`, `add_member` (invitation flow), `create_location`, `create_review`, `set_plan`,
  `outbox_token`. Override the DB with `TEST_DATABASE_URL`.
- **Frontend:** `make test-web` (Vitest + Testing Library, jsdom).
- **E2E:** start API (`DEMO_MODE=true OAUTH_MOCK_ENABLED=true`) and web, seed demo data, then
  `make e2e`. Install browsers once with `pnpm --filter @reviewpilot/web exec playwright install chromium`.

## Conventions
- **Backend:** routers are thin; logic lives in `services/`; external calls only in `providers/`.
  Always scope queries by `ctx.org_id` (+ `scoped_location_filter`) and return 404 for foreign ids.
  Use `require_perm(Perm.X)`; add new permissions to both `core/permissions.py` and
  `packages/shared-types`. Record sensitive actions with `services.audit.record`. Raise `AppError`
  subclasses for expected failures. Long or external work goes through `services.jobs.enqueue`.
- **Integrations:** never report success without a real provider response. Demo behaviour must be
  gated on `settings.demo_mode` and stored with `provider="mock"` / `is_demo`.
- **Frontend:** use `lib/api.ts` (never raw `fetch` to the backend), TanStack Query for server
  state, React Hook Form + Zod for forms, tokens/utilities instead of hard-coded colours, Lucide
  icons only, and every view handles loading / empty / error states.
- **Compliance:** no review gating, no incentives, consent before messaging, AI drafts require
  human approval.
