# Google Business Profile integration

ReviewPilot uses only **official** Google APIs (`app/providers/google_business.py`). It never
scrapes Google Maps or Business Profile pages.

| API | Used for |
| --- | --- |
| My Business Account Management API v1 (`mybusinessaccountmanagement.googleapis.com`) | List accounts |
| My Business Business Information API v1 (`mybusinessbusinessinformation.googleapis.com`) | List locations (`readMask=name,title,storefrontAddress,metadata,phoneNumbers`) |
| Google My Business API v4 (`mybusiness.googleapis.com/v4/accounts/*/locations/*/reviews`) | List reviews (paginated), `PUT …/reviews/*/reply` |

Scope: `https://www.googleapis.com/auth/business.manage` (+ `openid email` to show which Google
account is connected).

## 1. Google Cloud project
1. Create a project in Google Cloud Console.
2. Enable: **My Business Account Management API**, **My Business Business Information API**,
   and **Google My Business API**.
3. **Apply for Business Profile API access** (Google's "GBP API contact form" / access request).
   New projects have zero quota until Google approves the project. Until approval, OAuth succeeds
   but API calls return 403 — ReviewPilot shows the connection as **Pending authorization**.

## 2. OAuth consent & client
1. OAuth consent screen: add the `business.manage` scope. Publishing an app with this sensitive
   scope requires Google verification; in testing mode add test users.
2. Use the same Web OAuth client as Google Sign-In (or a separate one). Add the redirect URI
   `https://reviewpilot.ai/api/v1/integrations/google/callback`
   (local: `http://localhost:3000/api/v1/integrations/google/callback`).
3. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optionally `GOOGLE_GBP_REDIRECT_URI`.

## 3. Connecting (Integrations page)
1. `POST /integrations/google/connect` returns the consent URL (offline access, `prompt=consent`,
   PKCE, state signed with the org + user). Without credentials it returns
   `503 integration_not_configured` and the UI shows a setup state.
2. Callback verifies the state belongs to the signed-in user, exchanges the code, stores the
   access/refresh tokens **encrypted** (Fernet) and runs discovery.
3. Link each ReviewPilot location to a discovered Google location (`POST /integrations/google/link`).
   The location's Place ID / review URL are filled from Google metadata when available.
4. Sync: on demand (`POST /integrations/google/sync`) and every 2 hours (worker cron). Reviews are
   upserted by Google review name; new pending reviews notify the team.

## Statuses
| Status | Meaning |
| --- | --- |
| `not_connected` | No grant |
| `pending_authorization` | Authorized, but Google denied API access (project not yet approved) |
| `connected` | Discovery/sync succeeding |
| `token_expired` | Refresh token revoked/invalid — owner must reconnect (team is notified) |
| `error` | Repeated API failures; see `last_error` |

The UI never shows "connected" unless the API has actually succeeded.

## Reliability
- Access tokens refreshed automatically; `invalid_grant` → `token_expired`.
- Retries with exponential backoff on 429/5xx; per-connection daily budget
  (`DAILY_QUOTA = 5000`) to protect the project quota.
- Reply publishing happens in the worker; failures are stored on the reply and shown in the
  review drawer. Replies are only published after a human clicks **Publish**.
- Disconnect revokes the token at Google and unlinks locations.

## Manual fallback (while access is pending)
Each location accepts a manual `google_review_url` (validated to Google domains: `g.page/r/…`,
`search.google.com/local/writereview?placeid=…`, `maps.app.goo.gl/…`). QR codes, campaigns and
the public feedback page work fully with the manual link. Find it in Business Profile →
"Ask for reviews".

## Policy
Every customer is offered the Google review link — the feedback page never hides it based on
rating (no review gating), and templates rejecting incentives are enforced server-side.
