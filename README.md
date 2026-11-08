# ReviewPilot AI

**Turn Customer Experiences Into Business Growth.**

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![FastAPI](https://img.shields.io/badge/FastAPI-0.16x-009688?logo=fastapi&logoColor=white) ![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-ARQ-DC382D?logo=redis&logoColor=white) ![Tests](https://img.shields.io/badge/tests-83%20api%20·%2015%20unit%20·%2017%20e2e-success)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/aqkprogrammer/reviewpilot-ai)

ReviewPilot AI is a multi-tenant reputation-management SaaS for local businesses (restaurants,
clinics, salons, hotels, agencies…), India-first. It collects genuine customer feedback over
**WhatsApp, QR, email and SMS**, syncs Google reviews through the official Business Profile API,
drafts owner replies with AI (English, Hindi, Hinglish), and turns review text into
customer-feedback intelligence.

Three surfaces ship from one Next.js app, each with server-enforced authorization:

| Surface | Production host | Path in dev | Who |
| --- | --- | --- | --- |
| Marketing site + auth | `reviewpilot.ai` | `/`, `/pricing`, `/login`… | Everyone |
| Business application | `app.reviewpilot.ai` | `/app/*`, `/onboarding` | Org owners, admins, managers, staff, analysts |
| Super Admin console | `admin.reviewpilot.ai` | `/admin/*` | `platform_super_admin` only |

Public customer pages: `/r/{location-slug}` (feedback page) and `/q/{code}` (QR scan redirect).

## Product principles (enforced in code)

- **No review gating.** Every visitor sees the same “Leave a public review on Google” option,
  regardless of rating or private feedback (`app/api/v1/public.py`, covered by tests).
- **No incentives.** Message templates mentioning gifts/coupons/“5-star” are rejected.
- **Consent first.** Review requests are only sent with a recorded consent for that channel;
  opt-outs (link, `STOP` reply, dashboard) are honoured everywhere.
- **AI never auto-publishes.** Suggestions are drafts until a human publishes them.
- **No fake integrations.** Missing credentials show setup states. Demo mode is explicit:
  seeded rows carry `is_demo` / `source="demo"` / `provider="mock"` and the UI labels them.

## Architecture

> The diagrams below are [Mermaid](https://mermaid.js.org/) — GitHub renders them interactively (use the
> pan / zoom controls on each diagram). Expand the ▸ sections for each workflow.

```mermaid
flowchart LR
    subgraph Clients
        B["Business users<br/>owner · admin · manager · staff · analyst"]
        C["Customers<br/>QR scan · WhatsApp · email link"]
        SA["Platform Super Admin"]
    end

    subgraph Web["Next.js 16 — apps/web (single origin)"]
        MK["Marketing site<br/>/ · /pricing · /solutions"]
        AU["Auth + onboarding<br/>/login · /signup · /onboarding"]
        APP["Business app<br/>/app/*"]
        ADM["Super Admin console<br/>/admin/*"]
        FB["Public feedback page<br/>/r/[slug]"]
        PX{{"proxy.ts<br/>host → surface"}}
        RW{{"rewrites<br/>/api/v1/* · /q/*"}}
    end

    subgraph API["FastAPI modular monolith — apps/api"]
        R["api/v1 routers<br/>auth · orgs · reviews · campaigns · qr<br/>ai · analytics · billing · admin · webhooks"]
        D["deps: session · CSRF · X-Organization-Id<br/>RBAC · super-admin guard"]
        S["services<br/>(business logic)"]
        P["providers<br/>Google BP · WhatsApp · Resend · Twilio<br/>OpenAI · Razorpay · Stripe · S3"]
    end

    W["ARQ worker<br/>campaigns · reminders · Google sync<br/>reply publishing · AI insights · billing cron"]
    PG[("PostgreSQL<br/>42 tables · UUID PKs<br/>append-only audit log")]
    RD[("Redis<br/>job queue · rate limits")]
    EXT["External APIs<br/>Google · Meta · Resend · OpenAI<br/>Razorpay · Stripe"]

    B --> PX
    SA --> PX
    C --> FB
    PX --> MK & AU & APP & ADM
    APP & ADM & AU & FB --> RW
    RW -->|first-party cookies| R
    R --> D --> S --> PG
    S --> P --> EXT
    S -->|enqueue| RD --> W
    W --> PG
    W --> P
    EXT -. signed webhooks .-> R
```

### Multi-tenancy & authorization

```mermaid
flowchart TD
    REQ["HTTP request"] --> TOK{"Access token?<br/>cookie rp_access or Bearer"}
    TOK -- no --> E401["401 not_authenticated"]
    TOK -- expired --> E401b["401 token_expired → client calls /auth/refresh once"]
    TOK -- valid --> CSRF{"Cookie auth +<br/>unsafe method?"}
    CSRF -- "X-CSRF-Token ≠ rp_csrf" --> E403c["403 csrf_failed"]
    CSRF -- ok --> SES{"Session row active?<br/>user active?"}
    SES -- no --> E401c["401 / 403 account_disabled"]
    SES -- yes --> KIND{"Route type"}
    KIND -- "/admin/*" --> SAQ{"platform_role =<br/>platform_super_admin?"}
    SAQ -- no --> E403a["403 super_admin_required"]
    SAQ -- yes --> AUD["Handler + audit log"]
    KIND -- "org-scoped" --> MEM{"Member of<br/>X-Organization-Id?"}
    MEM -- no --> E403m["403 not_a_member"]
    MEM -- yes --> SUS{"Org suspended?"}
    SUS -- yes --> E403s["403 org_suspended"]
    SUS -- no --> PERM{"Role has permission?<br/>owner · admin · manager · staff · analyst"}
    PERM -- no --> E403p["403 permission_denied"]
    PERM -- yes --> LOC{"Location-restricted member?"}
    LOC -- "location not allowed" --> E403l["403 location_forbidden"]
    LOC -- ok --> Q["Query always filtered by organization_id<br/>(other tenants' ids → 404)"]
```

<details>
<summary><b>▸ Review collection workflow (QR · WhatsApp · email) — no review gating</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor Cust as Customer
    participant Q as /q/{code} (QR redirect)
    participant FP as /r/{slug} feedback page
    participant API as FastAPI
    participant DB as PostgreSQL
    participant G as Google review page

    alt Scans a table-card QR
        Cust->>Q: scan
        Q->>API: GET /qr-codes/scan/{code}
        API->>DB: insert qr_scan (hashed IP), scan_count++
        API-->>Cust: 302 → /r/{slug}?qr={code}
    else Opens a WhatsApp / email link
        Cust->>FP: /r/{slug}?t={tracking_token}
    end
    FP->>API: GET /public/locations/{slug}?t=…
    API->>DB: review_request.clicked_at = now, stop reminders
    API-->>FP: business info + EN/HI copy
    Note over FP: Both options are shown to EVERY visitor:<br/>"Review on Google" and "Send private feedback".<br/>Rating is optional and never decides what is shown.
    opt Leaves private feedback
        Cust->>FP: message (+ optional rating, contact, consent)
        FP->>API: POST /public/locations/{slug}/feedback
        API->>DB: feedback_submission, consent ledger, notify team
        API-->>FP: thanks — Google option still offered
    end
    opt Chooses Google
        Cust->>FP: "Leave a public review on Google"
        FP->>API: POST …/google-click
        API->>DB: google_clicked_at (measurable intent, not a confirmed review)
        API-->>FP: review URL
        FP->>G: open Google review form
    end
```
</details>

<details>
<summary><b>▸ Campaign engine (consent-checked delivery, reminders, webhooks)</b></summary>

```mermaid
flowchart TD
    W1["Wizard: name → location → channel → template → schedule → preview → launch"] --> L["POST /campaigns (launch)"]
    L --> ENT{"Plan entitlement +<br/>channel ready?"}
    ENT -- "no (e.g. WhatsApp on Starter)" --> X402["402 plan_limit_exceeded / 409 channel_not_configured"]
    ENT -- yes --> SCH{"Scheduled?"}
    SCH -- yes --> DEF["enqueue start_scheduled_campaign (deferred)"]
    SCH -- no --> PC["enqueue process_campaign"]
    DEF --> PC
    PC --> AUD["Resolve audience (customer ids / tags / all)"]
    AUD --> EACH{"For each customer"}
    EACH --> CONS{"Opted out? consent for channel?<br/>phone / email present?"}
    CONS -- no --> SKIP["review_request = skipped (reason recorded)"]
    CONS -- yes --> SEND["Render template {{name}} {{business}} {{link}}<br/>→ provider adapter"]
    SEND --> AD{"Adapter"}
    AD -->|WhatsApp Cloud API| WA["approved template message"]
    AD -->|Resend| EM["email + List-Unsubscribe"]
    AD -->|Twilio| SMS["SMS"]
    AD -->|DEMO_MODE only| MOCK["mock adapter (provider = mock, labelled simulated)"]
    WA & EM & SMS & MOCK --> MD["message_delivery row"]
    MD --> REM{"Reminders enabled<br/>and not clicked?"}
    REM -- yes --> CRON["cron send_due_reminders (every 15 min)"] --> SEND
    HOOK["Provider webhooks (signature verified)"] -.-> MD
    STOP["Customer replies STOP / unsubscribe link"] -.-> OPT["opted_out_at + consent revoked"]
```
</details>

<details>
<summary><b>▸ AI review reply workflow (human approval required)</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor U as Owner / manager
    participant UI as Review drawer
    participant API as FastAPI
    participant AI as OpenAI (or offline heuristic)
    participant GBP as Google Business Profile API
    U->>UI: open review, pick tone + language (EN / HI / Hinglish)
    UI->>API: POST /reviews/{id}/suggest
    API->>API: plan entitlement, monthly quota, 30 req/min limit
    API->>AI: prompt (no private data, no incentives, no arguing)
    AI-->>API: reply · explanation · sentiment · keywords · follow-up
    API-->>UI: draft (provider labelled)
    U->>UI: edit text
    UI->>API: PUT /reviews/{id}/reply (draft)
    U->>UI: Publish (explicit approval)
    UI->>API: POST /reviews/{id}/reply/publish
    alt Google review + connected
        API->>API: enqueue publish_review_reply
        API->>GBP: PUT {review}/reply
        GBP-->>API: ok → status published
    else Demo review
        API-->>UI: recorded locally, labelled "not sent to Google"
    end
```
</details>

<details>
<summary><b>▸ Authentication: login, refresh-token rotation and reuse detection</b></summary>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant API as FastAPI
    participant DB as auth_sessions
    B->>API: POST /auth/login (email, password, remember_me)
    API->>API: argon2id verify · lockout after 5 failures
    API->>DB: new session (refresh token stored as SHA-256)
    API-->>B: rp_access (15 min, HttpOnly) · rp_refresh (HttpOnly, path /api/v1/auth) · rp_csrf
    B->>API: any request (cookies + X-CSRF-Token)
    API-->>B: 401 token_expired
    B->>API: POST /auth/refresh
    API->>DB: rotate: previous_token_hash = old, token_hash = new
    API-->>B: new cookies
    Note over B,DB: If an already-rotated refresh token is replayed,<br/>the whole session family is revoked and audited.
    B->>API: GET /auth/google/start
    API-->>B: 302 Google (state + PKCE S256)
    B->>API: /auth/google/callback?code&state
    API->>API: verify signed state cookie, exchange code with verifier,<br/>link only if Google email_verified
    API-->>B: session cookies → /onboarding or /app
```
</details>

<details>
<summary><b>▸ Subscription state machine (changed only by verified webhooks)</b></summary>

```mermaid
stateDiagram-v2
    [*] --> trialing: signup (14-day trial)
    trialing --> active: subscription.activated / payment.succeeded
    trialing --> expired: trial ends (daily cron)
    trialing --> canceled: owner cancels trial
    active --> active: payment.succeeded (renewal → payment + GST invoice)
    active --> grace_period: payment.failed
    grace_period --> active: payment.succeeded
    grace_period --> expired: grace period ends (daily cron)
    active --> canceled: subscription.canceled
    expired --> active: new checkout paid
    canceled --> active: new checkout paid
    note right of active
        Razorpay: X-Razorpay-Signature HMAC
        Stripe: t + v1 HMAC, 5-min tolerance
        Duplicate event ids are ignored
    end note
```
</details>

<details>
<summary><b>▸ Core data model</b></summary>

```mermaid
erDiagram
    USERS ||--o{ ORGANIZATION_MEMBERS : "belongs to"
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
    ORGANIZATION_MEMBERS ||--o{ LOCATION_MEMBERS : "restricted to"
    ORGANIZATIONS ||--o{ LOCATIONS : has
    LOCATIONS ||--o{ LOCATION_MEMBERS : grants
    ORGANIZATIONS ||--|| SUBSCRIPTIONS : has
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : prices
    SUBSCRIPTIONS ||--o{ PAYMENTS : records
    PAYMENTS ||--o| INVOICES : generates
    LOCATIONS ||--o{ REVIEWS : receives
    REVIEWS ||--o{ REVIEW_REPLIES : "drafts / published"
    ORGANIZATIONS ||--o{ CUSTOMERS : owns
    CUSTOMERS ||--o{ CUSTOMER_CONSENTS : "consent ledger"
    LOCATIONS ||--o{ CAMPAIGNS : runs
    CAMPAIGNS ||--o{ REVIEW_REQUESTS : creates
    CUSTOMERS ||--o{ REVIEW_REQUESTS : receives
    REVIEW_REQUESTS ||--o{ MESSAGE_DELIVERIES : "delivery attempts"
    LOCATIONS ||--o{ QR_CODES : prints
    QR_CODES ||--o{ QR_SCANS : counts
    LOCATIONS ||--o{ FEEDBACK_SUBMISSIONS : collects
    ORGANIZATIONS ||--o| GOOGLE_CONNECTIONS : "encrypted OAuth tokens"
    ORGANIZATIONS ||--o{ AI_GENERATIONS : meters
    USERS ||--o{ AUDIT_LOGS : "append-only"
```

All 42 tables are documented in [docs/DATABASE.md](docs/DATABASE.md).
</details>

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository layout

```
reviewpilot-ai/
├── apps/
│   ├── web/            Next.js 16 app (marketing, business app, admin, public pages)
│   ├── api/            FastAPI + SQLAlchemy 2 async + Alembic; also contains worker code
│   └── worker/         Worker Dockerfile + README (runs apps/api/app/worker)
├── packages/
│   ├── shared-types/   Roles, permissions, enums shared with the API
│   └── ui/             Design tokens (tokens.css) + chart/motion tokens
├── infrastructure/     Railway service configs
├── render.yaml         Render Blueprint (web, API + worker, Postgres, Key Value)
├── docs/               Architecture, database, API, auth, integrations, deployment…
├── docker-compose.yml  Postgres, Redis, migrate+seed, API, worker, web
├── Makefile
└── .env.example
```

## Quick start (local)

Prerequisites: Node 22+, pnpm 10+, Python 3.12+ with [uv](https://docs.astral.sh/uv/),
PostgreSQL 15+ (17 recommended), Redis 7 (optional in development).

```bash
cp .env.example .env                       # dev defaults work out of the box
createuser -s reviewpilot 2>/dev/null; psql -d postgres -c "ALTER ROLE reviewpilot WITH LOGIN PASSWORD 'reviewpilot'"
createdb -O reviewpilot reviewpilot && createdb -O reviewpilot reviewpilot_test
make install                               # pnpm install + uv sync
make migrate                               # alembic upgrade head
make seed-demo                             # plans, templates + sample data (dev only)
make dev                                   # API :8000 + web :3000
make worker                                # optional; without Redis jobs run inline
```

Open http://localhost:3000. API docs: http://localhost:8000/api/v1/docs.

### With Docker

```bash
docker compose up --build
```

Runs Postgres, Redis, a one-shot `migrate` service (migrations + seeds), API, worker and web.

## Demo credentials (development only)

Created by `make seed-demo`. Passwords come from `SEED_PASSWORD_*` (defaults below). The seed
command refuses to run in production, and the production config validator refuses `DEMO_MODE`.

| Role | Email | Password |
| --- | --- | --- |
| Business owner (Spice Route Kitchen, 3 locations) | `owner@reviewpilot.dev` | `Owner@12345` |
| Organization admin | `admin@reviewpilot.dev` | `Admin@12345` |
| Staff | `staff@reviewpilot.dev` | `Staff@12345` |
| Platform Super Admin | `superadmin@reviewpilot.dev` | `SuperAdmin@12345` |

The demo seed also creates five other sample organizations (dental, salon, hotel, real estate,
coaching) in different subscription states for the admin console.

## Running each piece

| Piece | Command |
| --- | --- |
| API | `cd apps/api && uv run uvicorn app.main:app --reload --port 8000` |
| Web | `pnpm --filter @reviewpilot/web dev` |
| Worker | `cd apps/api && uv run arq app.worker.settings.WorkerSettings` |
| Migrations | `cd apps/api && uv run alembic upgrade head` |
| First Super Admin | `cd apps/api && uv run python -m app.cli create-super-admin --email you@company.com --name "You" --secret "$SUPER_ADMIN_BOOTSTRAP_SECRET"` |

## Tests

```bash
make test-api     # pytest against the reviewpilot_test database (rebuilt each run)
make test-web     # vitest unit/component tests
make e2e          # Playwright (needs API with OAUTH_MOCK_ENABLED=true + web running)
```

## Integrations that need credentials or provider approval

| Integration | Needed | Without it |
| --- | --- | --- |
| Google Sign-In | OAuth client (`GOOGLE_CLIENT_ID/SECRET`) | Button shows “not configured” |
| Google Business Profile | Same OAuth client **and** Google's Business Profile API access approval | Manual review-link per location |
| WhatsApp Cloud API | Meta app, WABA, phone number ID, token, **approved templates** | Simulated in demo mode, otherwise unavailable |
| Email | `RESEND_API_KEY` + verified domain | Dev outbox (`/api/v1/dev/outbox`) |
| SMS | Twilio (or a DLT-registered Indian provider) | Simulated / unavailable |
| OpenAI | `OPENAI_API_KEY` | Offline heuristic generator, labelled as such |
| Payments | Razorpay and/or Stripe keys + webhook secrets | Signed mock checkout in demo mode only |
| Storage | S3-compatible bucket | Local disk |

## Deploy to Render

`render.yaml` is a Render Blueprint that creates **PostgreSQL**, **Key Value (Redis)**, the **API**
(migrations + seeds on boot, ARQ worker embedded on the free plan) and the **web** app in Singapore.

1. Click **Deploy to Render** above (or *New → Blueprint* and pick this repo).
2. When prompted, set `ENCRYPTION_KEY` to a Fernet key
   (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
3. After the first deploy, set the public URLs and redeploy both services:
   - API: `FRONTEND_URL` and `CORS_ORIGINS` = web URL, `BACKEND_URL` = API URL
   - Web: `BACKEND_URL` = API URL (read at build time), `NEXT_PUBLIC_SITE_URL` = web URL

The blueprint runs with `ENVIRONMENT=demo`: seeded sample data, simulated messaging and payments,
offline AI — with generated secrets and secure cookies. The demo accounts use the passwords in the
table above (re-applied on every boot); they are public, so change `SEED_PASSWORD_*` if the instance
should not be openly accessible. For production set `ENVIRONMENT=production`, `DEMO_MODE=false`,
`SEED_DEMO_DATA=false`, add real integration keys, and move the worker to its own service.
Free-plan notes: services sleep when idle (and the embedded worker with them), free Postgres expires
after 30 days, and uploads are on ephemeral disk unless S3 is configured. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [API](docs/API.md) ·
[Authentication](docs/AUTHENTICATION.md) · [Google](docs/GOOGLE_INTEGRATION.md) ·
[WhatsApp](docs/WHATSAPP_INTEGRATION.md) · [Payments](docs/PAYMENTS.md) ·
[Deployment](docs/DEPLOYMENT.md) · [Admin guide](docs/ADMIN_GUIDE.md) ·
[Development](docs/DEVELOPMENT.md)
