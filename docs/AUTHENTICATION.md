# Authentication & authorization

## Credentials
- Passwords: argon2id (`argon2-cffi` defaults), transparently re-hashed when parameters change.
  Minimum 8 characters with letters and digits.
- Unknown emails still incur a hash computation (timing parity). `forgot-password` responds
  identically whether or not the account exists.
- Login lockout: `LOGIN_MAX_ATTEMPTS` (5) failures per email within `LOGIN_LOCKOUT_MINUTES` (15)
  → `429 login_locked`. Plus per-IP limits on login/signup/reset endpoints.
- Every sign-in, failure, lockout, password change/reset, Google link and session revocation is
  written to `audit_logs`.

## Sessions & cookies
| Cookie | Content | Flags |
| --- | --- | --- |
| `rp_access` | HS256 JWT (`sub`, `sid`, 15 min) | HttpOnly, SameSite=Lax, path `/`, Secure in prod |
| `rp_refresh` | 48-byte random token (stored as SHA-256 in `auth_sessions`) | HttpOnly, SameSite=Lax, path `/api/v1/auth` |
| `rp_csrf` | Random token | readable by JS, SameSite=Lax |

- Each request re-loads the user and session row: disabled users and revoked sessions are cut
  off immediately even with an unexpired JWT. The JWT's role claim is never trusted.
- **Refresh rotation:** `POST /auth/refresh` replaces the token hash and remembers the previous
  hash. Presenting an already-rotated token (reuse) revokes the whole session family
  (`auth.refresh_reuse_detected` audit event).
- "Remember me" off → 1-day session cookie; on → 30 days sliding.
- The web client refreshes once on `token_expired`/`not_authenticated` (single-flight) and retries.

## CSRF
Double-submit: for cookie-authenticated unsafe methods the `X-CSRF-Token` header must equal the
`rp_csrf` cookie (constant-time compare). Combined with SameSite=Lax and JSON-only bodies.

## Email verification & password reset
Single-use tokens hashed in `auth_tokens` (verify: 24 h, reset: 60 min). Issuing a new token
invalidates older ones. In development, read emails at `GET /api/v1/dev/outbox`.

## Google Sign-In (OAuth 2.0 + PKCE)
1. Google Cloud Console → APIs & Services → OAuth consent screen (External; scopes
   `openid email profile`; add test users while unpublished).
2. Credentials → OAuth client ID → Web application. Authorized redirect URI:
   `https://reviewpilot.ai/api/v1/auth/google/callback` (local: `http://localhost:3000/api/v1/auth/google/callback`).
   It points at the **web origin** because `/api/v1` is proxied — cookies stay first-party.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and `GOOGLE_REDIRECT_URI` if it differs from
   `{FRONTEND_URL}/api/v1/auth/google/callback`).

Flow: `/auth/google/start` creates an S256 PKCE pair and a signed state (10 min) stored in the
`rp_oauth` cookie → Google → `/auth/google/callback` checks the state against the cookie,
exchanges the code with the verifier, reads OpenID userinfo and:
- known Google subject → signs in;
- otherwise, if Google reports `email_verified`, links to the existing account with that email
  (and marks it verified) or creates a new user;
- unverified Google emails are refused.
New users without an organization are sent to `/onboarding`.

### Mock provider (local & E2E only)
`OAUTH_MOCK_ENABLED=true` (refused in production) replaces Google's consent screen with
`/api/v1/auth/google/mock`, a clearly labelled form that issues `mock:` codes. State and PKCE
handling are unchanged. Used by Playwright and pytest.

## Authorization
- Organization roles → permissions in `app/core/permissions.py` (mirrored in
  `packages/shared-types`). Routes declare `require_perm(...)`.
- Location scoping for members with `restrict_to_locations`.
- Super Admin: `platform_super_admin` platform role, created only through the CLI bootstrap
  (see [ADMIN_GUIDE.md](ADMIN_GUIDE.md)). The admin router has a router-level
  `require_super_admin` dependency. Super Admins are not members of customer organizations.
