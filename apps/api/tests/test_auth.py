from __future__ import annotations

import base64
import json
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.config import settings
from tests.conftest import PASSWORD, Api, login, new_client, outbox_token, signup, unique_email


async def test_signup_creates_org_with_trial():
    api = await signup(business="Chai Point Cafe")
    m = api.me["memberships"]
    assert len(m) == 1
    assert m[0]["role"] == "owner"
    assert m[0]["organization"]["name"] == "Chai Point Cafe"
    assert m[0]["organization"]["plan_code"] == "growth"
    assert m[0]["organization"]["subscription_status"] == "trialing"
    assert api.me["user"]["email_verified"] is False
    assert api.c.cookies.get("rp_access") and api.c.cookies.get("rp_csrf")


async def test_signup_duplicate_email_rejected():
    api = await signup()
    res = await new_client().post(
        "/api/v1/auth/signup",
        json={"full_name": "X Y", "email": api.email, "password": PASSWORD, "business_name": "Dup", "industry": "retail", "country": "IN", "accept_terms": True},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "email_taken"


async def test_signup_requires_terms_and_strong_password():
    res = await new_client().post(
        "/api/v1/auth/signup",
        json={"full_name": "X Y", "email": unique_email(), "password": "short", "business_name": "Biz", "accept_terms": False},
    )
    assert res.status_code == 422
    fields = {d["field"] for d in res.json()["error"]["details"]}
    assert {"password", "accept_terms"} <= fields


async def test_login_and_me():
    api = await signup()
    fresh = await login(api.email)
    res = await fresh.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["user"]["email"] == api.email


async def test_wrong_password():
    api = await signup()
    res = await new_client().post("/api/v1/auth/login", json={"email": api.email, "password": "WrongPass123"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_credentials"


async def test_lockout_after_failed_attempts():
    api = await signup()
    client = new_client()
    for _ in range(settings.login_max_attempts):
        res = await client.post("/api/v1/auth/login", json={"email": api.email, "password": "WrongPass123"})
        assert res.status_code == 401
    res = await client.post("/api/v1/auth/login", json={"email": api.email, "password": PASSWORD})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "login_locked"


async def test_refresh_rotation_and_reuse_detection():
    api = await signup()
    old_refresh = api.c.cookies.get("rp_refresh")
    csrf = api.c.cookies.get("rp_csrf")
    res = await api.c.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 200, res.text
    new_refresh = api.c.cookies.get("rp_refresh")
    assert new_refresh and new_refresh != old_refresh

    # Replaying the rotated-out token is treated as theft: the whole family is revoked.
    attacker = new_client()
    res = await attacker.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf, "Cookie": f"rp_refresh={old_refresh}; rp_csrf={csrf}"})
    assert res.status_code == 401
    victim = new_client()
    new_csrf = api.c.cookies.get("rp_csrf")
    res = await victim.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": new_csrf, "Cookie": f"rp_refresh={new_refresh}; rp_csrf={new_csrf}"})
    assert res.status_code == 401


async def test_refresh_requires_csrf():
    api = await signup()
    res = await api.c.post("/api/v1/auth/refresh")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "csrf_failed"


async def test_logout_revokes_session():
    api = await signup()
    access = api.c.cookies.get("rp_access")
    res = await api.post("/auth/logout")
    assert res.status_code == 200
    res = await new_client().get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert res.status_code == 401


async def test_verify_email_via_outbox_token():
    api = await signup()
    token = outbox_token(api.email, "verify-email")
    res = await new_client().post("/api/v1/auth/verify-email", json={"token": token})
    assert res.status_code == 200
    me = (await api.get("/auth/me")).json()
    assert me["user"]["email_verified"] is True
    # single use
    res = await new_client().post("/api/v1/auth/verify-email", json={"token": token})
    assert res.status_code == 400


async def test_forgot_and_reset_password():
    api = await signup()
    res = await new_client().post("/api/v1/auth/forgot-password", json={"email": api.email})
    assert res.status_code == 200
    # unknown emails get the same response (no account enumeration)
    res2 = await new_client().post("/api/v1/auth/forgot-password", json={"email": unique_email()})
    assert res2.json() == res.json()
    token = outbox_token(api.email, "reset-password")
    res = await new_client().post("/api/v1/auth/reset-password", json={"token": token, "password": "BrandNew123"})
    assert res.status_code == 200
    bad = await new_client().post("/api/v1/auth/login", json={"email": api.email, "password": PASSWORD})
    assert bad.status_code == 401
    await login(api.email, "BrandNew123")
    # existing sessions were revoked
    assert (await api.get("/auth/me")).status_code == 401


async def test_change_password():
    api = await signup()
    res = await api.post("/auth/change-password", {"current_password": "nope12345", "new_password": "Another123"})
    assert res.status_code == 400
    res = await api.post("/auth/change-password", {"current_password": PASSWORD, "new_password": "Another123"})
    assert res.status_code == 200
    await login(api.email, "Another123")


def _mock_code(email: str, name: str = "Google Person") -> str:
    raw = base64.urlsafe_b64encode(json.dumps({"email": email, "name": name}).encode()).decode().rstrip("=")
    return f"mock:{raw}"


async def _google_flow(client: httpx.AsyncClient, email: str) -> httpx.Response:
    start = await client.get("/api/v1/auth/google/start", params={"next": "/app"})
    assert start.status_code == 302, start.text
    loc = start.headers["location"]
    assert "/api/v1/auth/google/mock" in loc
    state = parse_qs(urlparse(loc).query)["state"][0]
    return await client.get("/api/v1/auth/google/callback", params={"code": _mock_code(email), "state": state})


async def test_google_not_configured_redirects_with_error():
    res = await new_client().get("/api/v1/auth/google/start")
    assert res.status_code == 302
    assert "error=google_not_configured" in res.headers["location"]


async def test_google_mock_oauth_creates_account(monkeypatch):
    monkeypatch.setattr(settings, "oauth_mock_enabled", True)
    client = new_client()
    email = unique_email("google")
    res = await _google_flow(client, email)
    assert res.status_code == 302
    assert res.headers["location"].endswith("/onboarding")  # new account without an organization
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["user"]["email"] == email
    assert me["user"]["email_verified"] is True
    assert me["memberships"] == []


async def test_google_mock_oauth_rejects_bad_state(monkeypatch):
    monkeypatch.setattr(settings, "oauth_mock_enabled", True)
    client = new_client()
    await client.get("/api/v1/auth/google/start")
    res = await client.get("/api/v1/auth/google/callback", params={"code": _mock_code("x@example.com"), "state": "forged"})
    assert res.status_code == 302
    assert "error=oauth_state_invalid" in res.headers["location"]


async def test_google_links_existing_account_by_verified_email(monkeypatch):
    monkeypatch.setattr(settings, "oauth_mock_enabled", True)
    api = await signup()
    original_id = api.me["user"]["id"]
    client = new_client()
    res = await _google_flow(client, api.email)
    assert res.status_code == 302
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["user"]["id"] == original_id
    assert me["user"]["email_verified"] is True
    assert len(me["memberships"]) == 1
    # Second sign-in resolves via the stored identity.
    again = await _google_flow(new_client(), api.email)
    assert again.status_code == 302 and "error" not in again.headers["location"]


async def test_mock_consent_page_disabled_by_default():
    res = await new_client().get("/api/v1/auth/google/mock", params={"state": "x"})
    assert res.status_code == 404


async def test_session_list_and_revoke():
    api = await signup()
    other = await login(api.email)
    sessions = (await api.get("/auth/sessions")).json()
    assert len(sessions) == 2
    other_id = next(s["id"] for s in sessions if not s["current"])
    assert (await api.delete(f"/auth/sessions/{other_id}")).status_code == 200
    assert (await other.get("/auth/me")).status_code == 401


async def test_unauthenticated_requests_rejected():
    res = await new_client().get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"
    assert isinstance(Api, type)
