# API

Base path: `/api/v1`. Interactive docs: **`/api/v1/docs`** (Swagger) and `/api/v1/redoc`;
schema at `/api/v1/openapi.json`. In the browser, call the API through the web origin
(`/api/v1/*` is proxied by Next.js).

## Conventions

**Authentication.** Session cookies set by `/auth/login`, `/auth/signup` or Google sign-in:
`rp_access` (JWT, 15 min, HttpOnly), `rp_refresh` (opaque, HttpOnly, path `/api/v1/auth`),
`rp_csrf` (readable). Non-browser clients may send `Authorization: Bearer <access token>`.

**CSRF.** Cookie-authenticated `POST/PUT/PATCH/DELETE` must send `X-CSRF-Token` equal to the
`rp_csrf` cookie (double submit). Bearer requests are exempt.

**Organization context.** Organization-scoped endpoints require `X-Organization-Id`. The server
verifies membership (`403 not_a_member`), suspension (`403 org_suspended`), role permission
(`403 permission_denied`) and location scope (`403 location_forbidden`). Ids belonging to another
tenant return `404`.

**Pagination.** `?page=1&page_size=20` (max 100). Response:
`{"items": [...], "total": 123, "page": 1, "page_size": 20, "pages": 7}`.

**Errors.** Always:

```json
{"error": {"code": "plan_limit_exceeded", "message": "Your Starter plan includes up to 1 location(s)…", "details": {"limit": 1}, "request_id": "a1b2c3"}}
```

Common codes: `validation_error` (422, `details` = `[{field, message}]`), `not_authenticated` /
`token_expired` / `session_invalid` (401), `csrf_failed` / `forbidden` / `permission_denied` (403),
`not_found` (404), `conflict` (409), `plan_limit_exceeded` (402), `rate_limited` / `login_locked`
(429), `integration_not_configured` (503), `internal_error` (500).

**Rate limits.** Per-IP fixed windows on auth, public and webhook-adjacent endpoints; per-org
limit of 30 AI requests/min plus the plan's monthly AI quota.

## Endpoints

Permission shown where it is narrower than "any member".

### Auth `/auth`
| Method & path | Notes |
| --- | --- |
| `GET /providers` | `{google, google_mock, demo_mode}` |
| `POST /signup` | Creates user + organization (owner) + 14-day Growth trial; sends verification email |
| `POST /login` | `{email, password, remember_me}`; lockout after 5 failures / 15 min |
| `POST /refresh` | Rotates refresh token (CSRF required) |
| `POST /logout` | Revokes the session |
| `GET /me`, `PATCH /me` | Profile + memberships with permissions |
| `POST /verify-email`, `POST /resend-verification` | |
| `POST /forgot-password`, `POST /reset-password` | Reset revokes all sessions |
| `POST /change-password` | Revokes other sessions |
| `GET /sessions`, `DELETE /sessions/{id}` | Device/session management |
| `GET /google/start?next=`, `GET /google/callback` | Google sign-in (PKCE, signed state) |

### Organizations, onboarding, locations, team
| Method & path | Permission |
| --- | --- |
| `GET /organizations/current` | |
| `POST /organizations` | First org for org-less users; more require Agency plan |
| `PATCH /organizations/current` | `settings.manage` (`auto_publish_replies` needs owner) |
| `POST /organizations/current/logo` | `settings.manage`; PNG/JPEG/WebP ≤ 2 MB, re-encoded |
| `DELETE /organizations/current` | owner |
| `GET/PUT /onboarding`, `POST /onboarding/complete` | `settings.manage` |
| `GET/POST /locations`, `GET/PATCH/DELETE /locations/{id}` | writes need `locations.manage`; plan limit enforced |
| `GET /team/members`, `PATCH/DELETE /team/members/{id}` | writes need `team.manage` |
| `GET/POST /team/invitations`, `POST …/{id}/resend`, `DELETE …/{id}` | `team.manage` |
| `GET /team/invitations/preview/{token}`, `POST /team/invitations/accept` | invitee (email must match) |

### Reviews & feedback
| Method & path | Permission |
| --- | --- |
| `GET /reviews` | `reviews.read`; filters `rating` (repeatable), `location_id`, `status`, `source`, `sentiment`, `date_from`, `date_to`, `q`, `sort` |
| `GET /reviews/stats`, `GET /reviews/{id}`, `GET /reviews/{id}/replies` | `reviews.read` |
| `POST /reviews/{id}/suggest` | `reviews.reply` + AI entitlement; `{tone, language: en|hi|hinglish}` |
| `PUT /reviews/{id}/reply` | Save/replace draft |
| `POST /reviews/{id}/reply/publish` | Explicit human approval; Google reviews publish via worker |
| `POST /reviews/{id}/handled`, `/reopen`, `/flag` | `reviews.reply` |
| `GET /feedback`, `PATCH /feedback/{id}` | private feedback inbox |

### Customers
`GET/POST /customers`, `GET /customers/tags`, `GET /customers/export` (CSV),
`POST /customers/import` (multipart CSV; `consent_confirmed` must be explicit),
`GET/PATCH/DELETE /customers/{id}` (delete = erasure), `POST /customers/{id}/consent`,
`POST /customers/{id}/opt-out`, `GET /customers/{id}/data-export` (DSAR JSON).

### Campaigns & review requests (`campaigns.manage` for writes)
`GET/POST /campaigns/templates`, `PATCH/DELETE /campaigns/templates/{id}`,
`POST /campaigns/preview`, `GET /campaigns/channels` (live / simulated / unavailable per channel),
`GET/POST /campaigns`, `GET/PATCH /campaigns/{id}`, `POST /campaigns/{id}/launch|pause|resume|duplicate|archive`,
`GET /campaigns/{id}/requests`, `GET /campaigns/{id}/timeline`,
`GET/POST /review-requests`, `GET /review-requests/summary`, `GET /review-requests/{id}/deliveries`.

Templates and message bodies must contain `{{link}}` and are rejected if they incentivise or
ask only for positive reviews. Placeholders: `{{name}}`, `{{business}}`, `{{location}}`, `{{link}}`.

### QR codes
`GET/POST /qr-codes`, `GET/PATCH/DELETE /qr-codes/{id}`, `POST/DELETE /qr-codes/{id}/logo`,
`GET /qr-codes/{id}/download?format=png|svg|pdf`, `GET /qr-codes/{id}/preview.svg`,
`GET /qr-codes/{id}/scans?days=30`. Public: `GET /qr-codes/scan/{code}` (also served as `/q/{code}`)
records the scan and 302-redirects to `/r/{slug}?qr={code}`.

### Analytics (`analytics.read`, except overview)
`GET /analytics/overview` (dashboard), `GET /analytics/detailed`, `GET /analytics/export.csv`,
`GET /analytics/report.pdf`. Query: `period=7d|30d|90d|365d|custom`, `date_from`, `date_to`,
`location_id`, `campaign_id`, `channel`. Every response includes `definitions` and `is_demo`.

### AI (`ai.use`)
`GET /ai/status`, `POST /ai/reply`, `POST /ai/sentiment`, `POST /ai/summary`, `POST /ai/templates`,
`GET /ai/insights`, `POST /ai/insights/refresh`, `POST /ai/insights/{id}/dismiss`,
`GET /ai/history`, `GET /ai/usage`. Responses carry `provider` (`openai` or `heuristic`).

### Integrations (`integrations.manage` for writes)
`GET /integrations` (status overview);
Google: `GET /integrations/google`, `POST …/connect` (returns OAuth URL or 503 setup state),
`GET …/callback`, `POST …/discover`, `POST …/link`, `POST …/unlink/{location_id}`, `POST …/sync`,
`DELETE /integrations/google`;
WhatsApp: `GET/PUT/DELETE /integrations/whatsapp`, `POST /integrations/whatsapp/templates/sync`;
Email: `GET/PUT /integrations/email`, `POST /integrations/email/test`.

### Subscriptions (`billing.manage` for writes)
`GET /subscriptions/plans` (public), `GET /subscriptions/current`, `POST /subscriptions/checkout`,
`POST /subscriptions/cancel`, `GET /subscriptions/payments`, `GET /subscriptions/invoices/{id}.pdf`,
`POST /subscriptions/mock-checkout/complete` (demo mode only).

### Notifications, announcements, support
`GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`,
`POST /notifications/read-all`, `GET/PUT /notifications/preferences`, `GET /announcements/active`,
`GET/POST /support/tickets`, `GET /support/tickets/{id}`, `POST /support/tickets/{id}/messages`.

### Webhooks (signature-verified)
`POST /webhooks/razorpay`, `POST /webhooks/stripe`, `GET|POST /webhooks/whatsapp`,
`POST /webhooks/resend`. See [PAYMENTS.md](PAYMENTS.md) and
[WHATSAPP_INTEGRATION.md](WHATSAPP_INTEGRATION.md).

### Public (no auth)
`GET /public/locations/{slug}?t=`, `POST /public/locations/{slug}/feedback`,
`POST /public/locations/{slug}/google-click`, `POST /public/unsubscribe`, `POST /public/contact`.

### Super Admin `/admin` (platform_super_admin only — router-level dependency)
`GET /overview`, `GET /search`; organizations (`GET`, `GET /{id}`, `POST /{id}/suspend|reactivate`);
users (`GET`, `GET /{id}`, `POST /{id}/disable|reactivate|revoke-sessions`);
`GET /subscriptions`, `POST /subscriptions/{id}/action` (`extend_trial|set_grace_period|clear_grace_period|change_plan`);
`GET /payments`; plans (`GET`, `POST`, `PATCH /{id}`); `GET /revenue`; `GET /integrations`;
`GET /ai-usage`; `GET /campaigns`; support tickets (`GET`, `GET/PATCH /{id}`, `POST /{id}/messages`,
`GET /{id}/org-snapshot`); announcements (`GET`, `POST`, `PUT/DELETE /{id}`, `POST /{id}/publish`);
`GET /audit-logs`; `GET /system-health`; feature flags (`GET`, `POST`, `PATCH /{id}`);
settings (`GET`, `PUT /{key}`). Mutating actions require a `reason` and are audited.

### Development only
`GET /dev/outbox` — last 50 emails sent by the dev email provider (404 outside development/test).
