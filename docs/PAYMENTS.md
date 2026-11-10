# Payments & subscriptions

Providers live in `app/providers/payments/__init__.py`; the state machine in
`app/services/billing.py`. **Providers only create checkouts and verify webhooks; subscription
state changes exclusively through `billing.apply_event` with a signature-verified event.**

## Plans
Seeded by `python -m app.cli seed` and editable by Super Admins (`/admin/plans`):

| Plan | Monthly | Yearly | Locations | Team | AI req/mo | Key entitlements |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | ₹999 | ₹9,990 | 1 | 3 | 0 | QR, email campaigns |
| Growth | ₹1,999 | ₹19,990 | 3 | 10 | 1,000 | + WhatsApp campaigns, AI replies, advanced analytics |
| Agency | ₹4,999 | ₹49,990 | 10 | 50 | 5,000 | + multi-organization (10), white-label |
| Enterprise | custom | custom | 500 | 1,000 | 100,000 | contact sales |

Prices are GST-inclusive (18% split shown on invoices). New organizations start a 14-day
Growth trial (`TRIAL_DAYS`).

## Razorpay (India, default)
1. Dashboard → Settings → API Keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Webhooks → URL `https://api.reviewpilot.ai/api/v1/webhooks/razorpay`, secret →
   `RAZORPAY_WEBHOOK_SECRET`. Events: `subscription.activated`, `subscription.charged`,
   `subscription.pending`, `subscription.halted`, `subscription.cancelled`,
   `subscription.completed`, `payment.failed`.
3. Razorpay plans are created on first checkout per plan/interval and their ids stored in
   `subscription_plans.provider_refs`. Checkout returns the subscription `short_url`.
4. Signature: HMAC-SHA256 of the raw body with the webhook secret (`X-Razorpay-Signature`);
   idempotency key `X-Razorpay-Event-Id`.

## Stripe (international)
1. `STRIPE_SECRET_KEY`; webhook endpoint `https://api.reviewpilot.ai/api/v1/webhooks/stripe`
   with events `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`,
   `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`;
   signing secret → `STRIPE_WEBHOOK_SECRET`.
2. Checkout Sessions use inline `price_data` (no pre-created prices needed); metadata carries
   `organization_id`, `plan_code`, `interval`.
3. Signature: `Stripe-Signature: t=…,v1=…` — HMAC-SHA256 of `"{t}.{body}"`, 5-minute tolerance.

Choose the default with `DEFAULT_PAYMENT_PROVIDER=razorpay|stripe`; `POST /subscriptions/checkout`
also accepts `provider`.

## State machine
| Event | Effect |
| --- | --- |
| `subscription.activated` | plan/interval set, `active`, trial/grace cleared, period set |
| `payment.succeeded` | `payments` row + numbered `invoices` row, `active`, period updated, owners notified |
| `payment.failed` | failed payment recorded; `active`/`trialing`/`past_due` → `grace_period` for `GRACE_PERIOD_DAYS` (7); owners notified |
| `subscription.updated` | `cancel_at_period_end`, period end |
| `subscription.canceled` | `canceled` |
| daily `subscription_maintenance` | `trialing` past `trial_ends_at` → `expired`; `grace_period` past end → `expired` |

Entitlements apply for `trialing`, `active`, `past_due`, `grace_period`. Every webhook is stored
in `webhook_events` (unique per provider + event id) — duplicates are acknowledged and ignored.
Card/bank fields are redacted before storage.

Other rules: checkout never changes state by itself; downgrades are blocked while the
organization exceeds the target plan's location limit; cancelling a paid subscription calls the
provider (cancel at period end) and waits for its webhook; ending a free trial (no provider
subscription) is local. Only owners (`billing.manage`) can check out or cancel.

## Demo mode mock provider
With `DEMO_MODE=true` and no keys, checkout returns `/app/subscription/checkout?session=…` — a
clearly labelled simulated payment page. Its buttons call `POST /subscriptions/mock-checkout/complete`,
which builds an HMAC-signed mock event and pushes it through the **same** verification and state
machine. Mock payments are stored with `provider="mock"` and invoices are marked simulated. The
mock provider refuses to work outside demo mode.

## Plan changes

- **Upgrades** (and any change from a trial, expired or cancelled state) go through checkout and take
  effect when the provider's signed webhook confirms payment.
- **Downgrades on an active paid plan** are scheduled for the end of the current period
  (`POST /subscriptions/schedule-change`): Razorpay `PATCH /subscriptions/{id}` with
  `schedule_change_at=cycle_end`, Stripe price swap with `proration_behavior=none`. The organization must
  already fit the smaller plan's location and seat limits. The plan switches when the renewal webhook arrives
  (Razorpay renewals are matched by Razorpay plan id). `DELETE /subscriptions/schedule-change` reverts it.
- A declined plan-change checkout never affects the current subscription; only a failed renewal starts the
  grace period.

## GST invoices

Customers add their legal name, GSTIN (format + checksum validated; the state is derived from it) and billing
address under Subscription → GST billing details. Each invoice snapshots these details at issue time.
Tax is GST-inclusive at 18%: **CGST 9% + SGST 9%** when the buyer's state equals `COMPANY_STATE_CODE`,
otherwise **IGST 18%**. Set `COMPANY_GSTIN`, `COMPANY_LEGAL_NAME`, `COMPANY_ADDRESS`, `COMPANY_STATE_CODE`
and `INVOICE_SAC_CODE` (confirm with your tax adviser); until a supplier GSTIN is set, PDFs are titled
"Invoice" and state they are not GST tax invoices.
