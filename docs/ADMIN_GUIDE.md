# Super Admin guide

The Super Admin console (`/admin`, served on `admin.reviewpilot.ai`) is a separate, always-dark
interface for platform operators. Its API is `/api/v1/admin/*` (see [API.md](API.md)).

## Access model
- Requires `users.platform_role = platform_super_admin`. The admin router enforces this with a
  router-level dependency; business users receive `403`, anonymous users `401`.
- There is **no** public registration or API to grant the role. Bootstrap from the server:

```bash
export SUPER_ADMIN_EMAIL=ops@yourcompany.com
export SUPER_ADMIN_BOOTSTRAP_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(24))")
cd apps/api
uv run python -m app.cli create-super-admin --email "$SUPER_ADMIN_EMAIL" --name "Ops Lead" --secret "$SUPER_ADMIN_BOOTSTRAP_SECRET"
```

  The command validates the secret (constant-time), requires the email to match
  `SUPER_ADMIN_EMAIL`, prompts for a strong password (or `--password`), promotes/creates the user
  and writes `admin.super_admin_bootstrapped` to the audit log. Rotate the secret afterwards.
- Super Admins are **not** members of customer organizations and cannot call business APIs for
  them (verified by tests). There is no impersonation feature.

## Sections
| Section | What you can do |
| --- | --- |
| Overview | Users, organizations, active/trial/paid counts, MRR/ARR, reviews synced, campaigns sent, AI requests, failed jobs; growth & revenue charts |
| Organizations | Search/filter, details (members, locations, subscription, usage, audit history), suspend/reactivate (reason required) |
| Users | Search, profile + memberships, disable/reactivate, revoke all sessions |
| Subscriptions | Status filters, trials, grace periods; actions `extend_trial`, `set_grace_period`, `clear_grace_period`, `change_plan` (reason required) |
| Payments | Payment history and failures (mock payments flagged) |
| Plans | Edit prices, limits, features and entitlements — the marketing site and checkout read these |
| Revenue analytics | MRR, ARR, revenue by plan, failed payments, churn, trial conversion, LTV estimate |
| Integrations | Platform credential status and per-org integration health |
| AI usage | Requests, tokens, estimated cost, by organization and model, failures |
| Campaign monitoring | Cross-tenant delivery/failure metrics (no message content) |
| Support tickets | Queue, priority, assignment, replies, internal notes, resolve |
| Announcements | Draft/publish to all users, selected organizations or plan tiers |
| Audit logs | Append-only trail, filter by action/actor |
| System health | API, database, Redis, worker heartbeat, queue backlog, integration errors, recent exceptions |
| Feature flags | Toggle, rollout %, org/plan allow-lists |
| Settings | Platform settings (support email, GST rate, default AI model…) |

## Customer data & least privilege
Admin views show organization metadata, counts and billing — **not** review text, customer
contact details or messages. A customer can grant time-boxed access when opening a support ticket
(`grant_data_access_days`, max 14). Only while that grant is active can an admin open
`GET /admin/support/tickets/{id}/org-snapshot`; every access (and every denied attempt) is
audited (`admin.org_snapshot_accessed` / `admin.org_snapshot_denied`).

## Auditing
Every mutating admin action records actor, action, target, IP, user agent and a metadata
`reason`/before-after diff. `audit_logs` is append-only at the database level (trigger blocks
UPDATE/DELETE). Destructive actions require confirmation in the UI and a written reason in the API.

## Secrets
Admin endpoints never return password hashes, OAuth tokens, provider secrets or card data;
integration credentials are shown as configured/not configured or masked.
