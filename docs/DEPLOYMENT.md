# Deployment

Reference topology: **Vercel** (web) + **Railway** (API, worker, PostgreSQL, Redis) + S3-compatible
storage (AWS S3 / Cloudflare R2). Any Docker host works with the provided images.

## Domains
| Host | Service |
| --- | --- |
| `reviewpilot.ai`, `www.` | Vercel (marketing, auth, `/r/*`, `/q/*`) |
| `app.reviewpilot.ai` | Same Vercel project — `proxy.ts` rewrites to `/app/*` |
| `admin.reviewpilot.ai` | Same Vercel project — rewrites to `/admin/*` |
| `api.reviewpilot.ai` | Railway API (webhooks may target it directly) |

Browsers call the API through the web origin (`/api/v1/*` rewrite → `BACKEND_URL`), so set
`COOKIE_DOMAIN=.reviewpilot.ai` to share the session across the three subdomains, and
`FRONTEND_URL=https://reviewpilot.ai` (used for OAuth redirect URIs, tracked links, emails).

## PostgreSQL & Redis (Railway)
Add the PostgreSQL and Redis plugins. Use the asyncpg URL form:
`DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:PORT/DB`. Enable automated backups.

## API service (Railway)
- Root directory `apps/api`, config `infrastructure/railway.api.toml` (Dockerfile build,
  pre-deploy `alembic upgrade head && python -m app.cli seed`, health check `/healthz`, 2 replicas).
- Env: everything in `.env.example` with production values. Required:
  `ENVIRONMENT=production`, `DEMO_MODE=false`, `OAUTH_MOCK_ENABLED=false`, `COOKIE_SECURE=true`,
  `INLINE_JOBS_FALLBACK=false`, unique `SECRET_KEY`/`JWT_SECRET` (≥32 chars), `ENCRYPTION_KEY`
  (Fernet), `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`.
- The **production config validator** (`Settings._validate_production`) refuses to start if any of
  these are unsafe — fix the reported list rather than bypassing it.
- Set `RESEND_API_KEY` (production refuses to send email without it) and the provider keys you use.

## Worker service (Railway)
Repository root, config `infrastructure/railway.worker.toml`
(`apps/worker/Dockerfile`, `arq app.worker.settings.WorkerSettings`). Same env as the API.
Run exactly one replica unless you've reviewed cron duplication (ARQ cron jobs use unique job ids).
System Health shows the worker heartbeat (`reviewpilot:worker:heartbeat`).

## Web (Vercel)
- Root directory `apps/web` (`vercel.json` installs from the monorepo root), framework Next.js.
- Env: `BACKEND_URL=https://api.reviewpilot.ai`, `NEXT_PUBLIC_SITE_URL=https://reviewpilot.ai`.
- Add the three domains to the project.

## Storage
Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `AWS_REGION`
(and `S3_ENDPOINT_URL` for R2/MinIO). Objects are public-read via bucket policy for logos only;
uploads are re-encoded PNGs.

## Migrations
Run automatically in the API pre-deploy step. Manually:
`railway run --service api alembic upgrade head`. Migrations are forward-only in production;
test `alembic downgrade -1` locally before shipping destructive changes.

## First Super Admin
```bash
railway run --service api python -m app.cli create-super-admin \
  --email "$SUPER_ADMIN_EMAIL" --name "Ops Lead" --secret "$SUPER_ADMIN_BOOTSTRAP_SECRET"
```
Then rotate/remove `SUPER_ADMIN_BOOTSTRAP_SECRET`.

## Provider callbacks to register
| Provider | URL |
| --- | --- |
| Google Sign-In | `https://reviewpilot.ai/api/v1/auth/google/callback` |
| Google Business Profile | `https://reviewpilot.ai/api/v1/integrations/google/callback` |
| Razorpay webhook | `https://api.reviewpilot.ai/api/v1/webhooks/razorpay` |
| Stripe webhook | `https://api.reviewpilot.ai/api/v1/webhooks/stripe` |
| WhatsApp webhook | `https://api.reviewpilot.ai/api/v1/webhooks/whatsapp` |
| Resend webhook | `https://api.reviewpilot.ai/api/v1/webhooks/resend` |

## Deployment checklist
- [ ] Production secrets generated and stored in the platform secret manager (never in git)
- [ ] `ENCRYPTION_KEY` backed up securely (losing it invalidates stored integration tokens)
- [ ] `ENVIRONMENT=production`, `DEMO_MODE=false`, `OAUTH_MOCK_ENABLED=false`, `COOKIE_SECURE=true`, `INLINE_JOBS_FALLBACK=false`
- [ ] `COOKIE_DOMAIN`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS` match the real domains
- [ ] Database backups + point-in-time recovery enabled; Redis persistence enabled
- [ ] `alembic upgrade head` succeeded; reference data seeded (`app.cli seed`); **no** `seed-demo`
- [ ] Super Admin bootstrapped; bootstrap secret rotated
- [ ] Resend domain verified (SPF, DKIM, DMARC) and `EMAIL_FROM` uses it
- [ ] Google OAuth consent screen verified; Business Profile API access approved
- [ ] WhatsApp templates approved; webhook verified with `WHATSAPP_VERIFY_TOKEN` + `WHATSAPP_APP_SECRET`
- [ ] Razorpay/Stripe live keys + webhook secrets set; test a real ₹1 transaction and refund
- [ ] OpenAI key set with spend limits; plan AI quotas reviewed in Admin → Plans
- [ ] S3 bucket configured; `LOCAL_STORAGE_DIR` not used in production
- [ ] Worker running; System Health shows database/Redis/worker OK
- [ ] Legal pages reviewed by counsel (Privacy, Terms; DPDP Act 2023 / GDPR)
- [ ] Error monitoring/log drains configured; uptime check on `/healthz`

## Render (Blueprint)

`render.yaml` at the repo root provisions everything on Render: `reviewpilot-db` (PostgreSQL 17),
`reviewpilot-redis` (Key Value), `reviewpilot-api` (Python; `scripts/render-start.sh` runs
`alembic upgrade head`, reference seeds, optional demo seed, and — on the free plan — the ARQ worker
in-process) and `reviewpilot-web` (Node; `next start`). Managed `postgres://` URLs are normalised to
`postgresql+asyncpg://` automatically.

After the first deploy set `FRONTEND_URL`, `CORS_ORIGINS`, `BACKEND_URL` on the API and
`BACKEND_URL`, `NEXT_PUBLIC_SITE_URL` on the web service, then redeploy (the web rewrites read
`BACKEND_URL` at build time). `ENVIRONMENT=demo` requires generated secrets, a Fernet
`ENCRYPTION_KEY` and `COOKIE_SECURE=true`; demo account passwords are generated
(`SEED_PASSWORD_*` in the API service environment).
