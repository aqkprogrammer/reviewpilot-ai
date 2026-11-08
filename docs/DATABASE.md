# Database

PostgreSQL 15+ (17 recommended), SQLAlchemy 2 async (asyncpg), Alembic migrations in
`apps/api/alembic/versions`. All primary keys are UUID v4; most tables have `created_at` /
`updated_at` (timestamptz, server defaults). Constraint names follow a fixed naming convention
(`app/models/base.py`) so migrations are deterministic.

```bash
cd apps/api
uv run alembic upgrade head                               # apply
uv run alembic revision --autogenerate -m "describe"      # new migration
uv run python -m app.cli seed                             # reference data (all envs)
uv run python -m app.cli seed-demo                        # sample data (dev only)
```

## Conventions

- **Tenancy:** tenant tables carry `organization_id` (FK, `ON DELETE CASCADE`) and are always
  queried through the org context. Composite indexes start with `organization_id`.
- **Soft delete:** `deleted_at` on `users`, `organizations`, `locations`, `customers`,
  `campaigns`, `campaign_templates`, `qr_codes`. Queries filter `deleted_at IS NULL`. User email
  uniqueness is a partial unique index (`uq_users_email_active … WHERE deleted_at IS NULL`).
- **Customer erasure:** `DELETE /customers/{id}` scrubs PII immediately (name/email/phone/notes)
  and detaches it from feedback submissions; anonymous counts remain.
- **Encryption at rest:** Google OAuth tokens (`google_connections.*_enc`) and per-org provider
  secrets (`integration_credentials.secrets_enc`) are Fernet-encrypted with `ENCRYPTION_KEY`.
  API responses only ever expose masked values.
- **Hashing:** passwords (argon2id), refresh tokens, email/reset tokens and invitation tokens are
  stored as hashes only. QR scans keep a salted IP hash, never the IP.
- **Audit trail:** `audit_logs` is append-only. The initial migration installs the
  `audit_logs_no_update_delete` trigger which raises on `UPDATE`/`DELETE`.
- **Money:** integer minor units (paise) + ISO currency.
- **Source labelling:** `reviews.source` (`google` | `demo`), `organizations.is_demo`,
  `message_deliveries.provider` (`whatsapp_cloud` | `resend` | `twilio` | `mock`),
  `payments.provider` (`razorpay` | `stripe` | `mock`), `ai_generations.provider`
  (`openai` | `heuristic`).

## Tables

### Identity & access
| Table | Purpose | Notable constraints / indexes |
| --- | --- | --- |
| `users` | Accounts; `platform_role` (`user`/`platform_super_admin`), `status`, preferences | partial unique email, soft delete |
| `oauth_identities` | Google sign-in identities | unique (`provider`, `provider_subject`) |
| `auth_sessions` | Refresh-token families (hash, previous hash, expiry, revocation, device) | unique `token_hash`, index `previous_token_hash` |
| `auth_tokens` | Single-use verify-email / reset-password tokens (hashed) | unique `token_hash` |

### Organizations
| Table | Purpose | Notes |
| --- | --- | --- |
| `organizations` | Tenant; branding, onboarding state (`onboarding_step`, `onboarding_data`), `status`, `is_demo`, `auto_publish_replies` (owner-only) | unique `slug`, index `status` |
| `organization_members` | User ↔ org with role, `restrict_to_locations` | unique (`organization_id`, `user_id`) |
| `invitations` | Hashed token, role, location ids, expiry | index (`organization_id`, `email`) |
| `locations` | Business locations; public `slug` for `/r/{slug}`; manual `google_review_url`; Google `google_location_name` | unique `slug`, index `google_location_name` |
| `location_members` | Location allow-list per member | unique (`location_id`, `member_id`) |

### Integrations
| Table | Purpose |
| --- | --- |
| `google_connections` | One per org: encrypted tokens, status, scopes, last sync/error, daily quota counter |
| `google_accounts` | Discovered Business Profile accounts + their locations (JSON) |
| `integration_credentials` | Per-org WhatsApp / email / SMS config (+ encrypted secrets); unique (`organization_id`, `provider`) |

### Reviews & feedback
| Table | Purpose | Indexes |
| --- | --- | --- |
| `reviews` | Google-synced or demo reviews; rating, text, sentiment, topics (text[]), response status, platform reply, history (JSON) | unique (`location_id`, `source`, `external_id`); (`organization_id`, `review_created_at`), (`organization_id`, `rating`), (`organization_id`, `response_status`), (`location_id`, `review_created_at`) |
| `review_replies` | Drafts and published replies; tone, language, AI generation link, publish status/errors | `review_id` |
| `feedback_submissions` | Private feedback from `/r/{slug}` (never published to Google) | (`organization_id`, `created_at`) |

### Customers & campaigns
| Table | Purpose | Indexes |
| --- | --- | --- |
| `customers` | Contacts (E.164 phone), tags (text[]), notes, `opted_out_at` | (`organization_id`, `created_at`/`email`/`phone`) |
| `customer_consents` | Consent ledger per channel & type (`transactional`/`marketing`), evidence; latest row wins | (`customer_id`, `channel`, `consent_type`) |
| `campaign_templates` | System (org NULL) and org templates; WhatsApp template name + approval status | |
| `campaigns` | Channel, status, audience, schedule, reminder rules | (`organization_id`, `status`) |
| `review_requests` | One per customer per campaign/one-off: tracking token, sent/delivered/clicked/Google-clicked timestamps, reminders | unique `tracking_token`; (`organization_id`, `created_at`), (`organization_id`, `status`), `next_reminder_at` |
| `message_deliveries` | Each provider send attempt + webhook status events | `provider_message_id` |
| `qr_codes` | Short code, colours, template, card copy, counters | unique `code` |
| `qr_scans` | Scan events (device, salted IP hash) | (`qr_code_id`, `scanned_at`), (`organization_id`, `scanned_at`) |

### AI
| Table | Purpose |
| --- | --- |
| `ai_generations` | Every AI call: kind, provider, model, prompt version, input/output, tokens, cost, latency, success |
| `ai_usage` | Monthly roll-up per org (requests, failures, tokens, cost, per-model) — unique (`organization_id`, `period`) |
| `ai_insights` | Insights derived from review text with evidence review ids |

### Billing
| Table | Purpose |
| --- | --- |
| `subscription_plans` | Configurable plans (prices in paise, limits, features, `entitlements` JSON, provider plan ids) |
| `subscriptions` | One per org: status (`trialing`/`active`/`past_due`/`grace_period`/`canceled`/`expired`/`incomplete`), interval, provider ids, periods, pending checkout |
| `payments` | Provider payments; unique (`provider`, `provider_payment_id`); card/bank data redacted from `raw` |
| `invoices` | Numbered invoices with GST split and line items |

### Platform
| Table | Purpose |
| --- | --- |
| `notifications`, `notification_preferences` | In-app notifications; per-type in-app/email preferences |
| `support_tickets`, `support_messages` | Tickets with optional time-boxed `data_access_granted_until`; internal notes |
| `announcements` | Audience: all / organizations / plans; scheduling |
| `contact_messages` | Marketing contact form |
| `audit_logs` | Append-only trail (actor, action, target, IP, UA, metadata); identity `seq` |
| `system_settings`, `feature_flags` | Admin-managed configuration |
| `webhook_events` | Verified inbound webhooks; unique (`provider`, `event_id`) for idempotency |
| `background_jobs` | Job status, attempts, errors, runner (`arq`/`inline`) |
| `error_events` | Recent unhandled exceptions for System Health |
