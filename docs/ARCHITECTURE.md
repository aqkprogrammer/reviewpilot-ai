# Architecture

ReviewPilot AI is a **modular monolith**: one FastAPI service, one ARQ worker sharing the same
Python package, one Next.js app, PostgreSQL and Redis. No microservices.

## Request flow

1. The browser only talks to the web origin. `apps/web/next.config.ts` rewrites
   `/api/v1/*` and `/q/:code` to FastAPI (`BACKEND_URL`). Auth cookies therefore stay
   first-party on every topology (Vercel + Railway, Docker, local).
2. `apps/web/src/proxy.ts` (Next.js 16 `proxy`, formerly middleware) maps hosts to surfaces —
   `app.*` → `/app`, `admin.*` → `/admin` — and redirects signed-out visitors away from
   protected shells. It is a UX convenience only; **every API request is authorized server-side.**
3. FastAPI middleware assigns a request id, sets security headers and `Cache-Control: no-store`
   on API responses. Errors use one envelope (see [API.md](API.md)).

## Backend layout (`apps/api/app`)

| Package | Responsibility |
| --- | --- |
| `core/` | config + production validator, async engine/session, security (argon2id, JWT, signed state), Fernet crypto, RBAC permissions, auth/tenant dependencies, rate limiting, error envelope, Redis client |
| `models/` | SQLAlchemy 2 typed models (42 tables), enums mirrored in `packages/shared-types` |
| `schemas/` | Pydantic v2 request/response models |
| `services/` | Business logic: auth, organizations/entitlements, locations, campaigns engine, consent ledger, AI, analytics, Google sync, billing state machine, notifications, audit, jobs, QR rendering, email templates, system health |
| `providers/` | External adapters: Google Business Profile, WhatsApp Cloud API, Twilio, mock messaging, Resend/dev email, OpenAI/heuristic AI, Razorpay/Stripe/mock payments, S3/local storage |
| `api/v1/` | Thin routers (validation, dependencies, response shaping) |
| `worker/` | ARQ task functions + `WorkerSettings` (cron schedule, retries, heartbeat) |
| `seed.py`, `cli.py` | Reference/demo seeds, Super Admin bootstrap |

Route handlers stay thin; anything reusable (e.g. `campaigns.send_review_request`,
`billing.apply_event`, `google_sync.sync_connection`) lives in `services/` and is called by both
the API and the worker.

## Multi-tenancy

- Every tenant-owned table carries `organization_id`.
- `core/deps.get_org_context` reads `X-Organization-Id`, verifies membership, rejects suspended
  organizations and loads the member's location allow-list (`location_members`) when
  `restrict_to_locations` is set. Super Admins are **not** implicit members of any organization.
- Services filter by `ctx.org_id` and `scoped_location_filter(...)`. Objects fetched by id are
  checked against the context and return **404** for other tenants (no existence leak).
- Plan limits (locations, team size, AI quota, WhatsApp entitlement) are enforced in
  `services/organizations.py` and `services/ai.py`, never only in the UI.

## RBAC

`core/permissions.py` maps org roles (owner, admin, manager, staff, analyst) to permissions
(`reviews.reply`, `campaigns.manage`, `billing.manage`, …). Routes depend on
`require_perm(Perm.X)`. `ASSIGNABLE_ROLES` prevents privilege escalation (admins can't create
owners/admins). The platform role (`platform_super_admin`) is separate and only settable via the
CLI bootstrap — no API accepts a role from the client.

## Background processing

`services/jobs.enqueue()` writes a `background_jobs` row then enqueues to ARQ. The worker wraps
each task with `run_tracked` to record status/attempts/errors. Without Redis in development the
API runs jobs in-process (`INLINE_JOBS_FALLBACK=true`); production config refuses this.

| Task | Trigger |
| --- | --- |
| `process_campaign` | Launch / resume |
| `start_scheduled_campaign` | Deferred launch |
| `send_review_request` | One-off request |
| `send_due_reminders` | Cron, every 15 min |
| `sync_google_reviews` / `sync_all_google` | Manual sync / cron every 2 h |
| `publish_review_reply` | Owner publishes a reply to a Google review |
| `generate_ai_insights` | Manual refresh |
| `subscription_maintenance` | Cron daily — expires trials & lapsed grace periods |

## Frontend (`apps/web`)

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 with tokens from
  `packages/ui/src/tokens.css` (`:root` / `.dark` for marketing + app, `.admin-theme` for the
  navy Super Admin console).
- Hand-built shadcn-style primitives on Radix (`src/components/ui`), Lucide icons, Recharts,
  Framer Motion, TanStack Query, React Hook Form + Zod, sonner toasts.
- `src/lib/api.ts`: same-origin fetch wrapper (CSRF header, org header, single-flight refresh).
- `src/lib/session.tsx`: `useMe`, `OrgProvider`, `useOrg`, `useCan` for navigation affordances.

## Demo mode vs production

`DEMO_MODE=true` enables simulated messaging (`MockAdapter`), the signed mock payment provider,
and the dev email outbox. Demo organizations/reviews/deliveries are flagged in the data and
labelled in the UI and exports. The production validator (`Settings._validate_production`)
refuses `DEMO_MODE`, `OAUTH_MOCK_ENABLED`, inline jobs, insecure cookies, default secrets and a
localhost database.
