"""Post-visit automations: API keys, ingestion, rules, scheduling, processing, Shopify, RBAC, tenancy."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.api.v1 import automations as automations_api
from app.core.db import SessionLocal
from app.models import AuditLog, CustomerConsent, MessageDelivery, Notification, ReviewRequest
from app.models.growth import ApiKey, VisitEvent
from app.providers import messaging
from app.services import automations as svc
from app.services.jobs import drain_inline_tasks
from app.worker.tasks_automations import CRONS, TASKS
from tests.conftest import add_member, create_location, new_client, set_plan, signup

BODY = "Hi {{name}}, thanks for visiting {{business}} today. Tell us how it went: {{link}}"
CONSENT_TEXT = "I agree to receive a one-time feedback message about this visit."


def _now_iso(minutes: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(minutes=minutes)).isoformat()


async def _rule(owner, **kw) -> dict:
    payload = {"name": "After visit", "channel": "email", "message_body": BODY, "delay_minutes": 0, "cooldown_days": 30, **kw}
    res = await owner.post("/automations/rules", payload)
    assert res.status_code == 201, res.text
    return res.json()


async def _key(owner, name: str = "POS") -> str:
    res = await owner.post("/automations/api-keys", {"name": name})
    assert res.status_code == 201, res.text
    return res.json()["secret"]


async def _ingest(secret: str, body: dict, header: str = "bearer"):
    client = new_client()  # no cookies: ingestion must never rely on a session
    headers = {"Authorization": f"Bearer {secret}"} if header == "bearer" else {"X-API-Key": secret}
    return await client.post("/api/v1/automations/ingest/visits", json=body, headers=headers)


def _visit(loc: dict, ext: str | None = None, *, email: str | None = None, phone: str | None = None, consent: dict | None = None, **kw) -> dict:
    body = {
        "location_id": loc["id"], "external_id": ext or uuid.uuid4().hex, "occurred_at": _now_iso(),
        "customer": {"name": "Riya Kapoor", **({"email": email} if email else {}), **({"phone": phone} if phone else {})}, **kw,
    }
    if email is None and phone is None:
        body["customer"]["email"] = f"riya-{uuid.uuid4().hex[:6]}@example.com"
    if consent is not None:
        body["consent"] = consent
    return body


async def _force_due(visit_id: str) -> None:
    async with SessionLocal() as db:
        await db.execute(update(VisitEvent).where(VisitEvent.id == uuid.UUID(visit_id)).values(scheduled_for=datetime.now(UTC) - timedelta(minutes=1)))
        await db.commit()


async def _visit_row(visit_id: str) -> VisitEvent:
    async with SessionLocal() as db:
        return await db.get(VisitEvent, uuid.UUID(visit_id))


# ------------------------------------------------------------------ API keys


async def test_api_key_lifecycle_and_auth_failures():
    owner = await signup()
    loc = await create_location(owner)
    res = await owner.post("/automations/api-keys", {"name": "Front desk POS"})
    assert res.status_code == 201
    created = res.json()
    secret = created["secret"]
    assert secret.startswith("rp_live_") and len(secret) == 48
    assert created["key"]["prefix"] == secret[8:16] and len(created["key"]["prefix"]) == 8
    assert created["key"]["scopes"] == ["visits:write"]

    listed = (await owner.get("/automations/api-keys")).json()
    assert len(listed) == 1 and "secret" not in listed[0] and "key_hash" not in listed[0]
    async with SessionLocal() as db:
        stored = await db.scalar(select(ApiKey).where(ApiKey.id == uuid.UUID(created["key"]["id"])))
        assert stored.key_hash == hashlib.sha256(secret.encode()).hexdigest() and secret not in stored.key_hash

    # Both header styles authenticate; last_used_at is tracked.
    assert (await _ingest(secret, _visit(loc))).status_code == 201
    assert (await _ingest(secret, _visit(loc), header="x-api-key")).status_code == 201
    assert (await owner.get("/automations/api-keys")).json()[0]["last_used_at"] is not None

    # Failures
    anon = new_client()
    r = await anon.post("/api/v1/automations/ingest/visits", json=_visit(loc))
    assert r.status_code == 401 and r.json()["error"]["code"] == "api_key_required"
    r = await _ingest("rp_live_" + "x" * 40, _visit(loc))
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_api_key"
    r = await _ingest("not-a-key", _visit(loc))
    assert r.status_code == 401
    # A logged-in session is NOT an API key.
    r = await owner.c.post("/api/v1/automations/ingest/visits", json=_visit(loc), headers=owner.headers())
    assert r.status_code == 401 and r.json()["error"]["code"] == "api_key_required"

    # Revoke → rejected.
    assert (await owner.delete(f"/automations/api-keys/{created['key']['id']}")).status_code == 204
    r = await _ingest(secret, _visit(loc))
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_api_key"
    assert (await owner.get("/automations/api-keys")).json()[0]["revoked_at"] is not None

    async with SessionLocal() as db:
        actions = set((await db.scalars(select(AuditLog.action).where(AuditLog.organization_id == uuid.UUID(owner.org_id)))).all())
    assert {"api_key.created", "api_key.revoked", "visit.recorded"} <= actions


async def test_ingest_rate_limited_per_key(monkeypatch):
    owner = await signup()
    loc = await create_location(owner)
    secret = await _key(owner)
    other = await _key(owner, "Zapier")
    monkeypatch.setattr(automations_api, "INGEST_PER_KEY_PER_MIN", 2)
    assert (await _ingest(secret, _visit(loc))).status_code == 201
    assert (await _ingest(secret, _visit(loc))).status_code == 201
    r = await _ingest(secret, _visit(loc))
    assert r.status_code == 429
    assert (await _ingest(other, _visit(loc))).status_code == 201  # limit is per key


# ------------------------------------------------------------------ ingestion


async def test_ingestion_is_idempotent_by_external_id():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, delay_minutes=120)
    secret = await _key(owner)
    body = _visit(loc, "order-1001", email="dup@example.com", consent={"email": True, "source": "pos_checkout", "text": CONSENT_TEXT})
    first = await _ingest(secret, body)
    assert first.status_code == 201 and first.json()["duplicate"] is False
    second = await _ingest(secret, body)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"] and second.json()["duplicate"] is True
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count()).select_from(VisitEvent).where(VisitEvent.organization_id == uuid.UUID(owner.org_id)))
        consents = await db.scalar(select(func.count()).select_from(CustomerConsent).where(CustomerConsent.organization_id == uuid.UUID(owner.org_id)))
    assert n == 1 and consents == 1  # the replay did not record consent twice
    # Same customer matched by phone/email on later visits (no duplicate customer).
    again = await _ingest(secret, _visit(loc, "order-1002", email="DUP@example.com"))
    assert again.json()["customer_id"] == first.json()["customer_id"]


async def test_consent_recorded_only_when_explicit():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, channel="auto", delay_minutes=60)
    secret = await _key(owner)

    # No consent block → customer stored, no consent, visit skipped.
    r = (await _ingest(secret, _visit(loc, phone="+919812345601", email="noconsent@example.com"))).json()
    assert r["status"] == "skipped" and r["skip_reason"] == "no_consent"
    cust = (await owner.get(f"/customers/{r['customer_id']}")).json()
    assert cust["consents"] == {} and cust["source"] == "api"

    # Explicit false is not a grant (and records nothing).
    r = (await _ingest(secret, _visit(loc, phone="+919812345602", consent={"email": False, "whatsapp": False, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert r["skip_reason"] == "no_consent"
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(CustomerConsent).where(CustomerConsent.customer_id == uuid.UUID(r["customer_id"]))) == 0

    # Consent without evidence text is rejected.
    bad = await _ingest(secret, _visit(loc, consent={"whatsapp": True, "source": "pos"}))
    assert bad.status_code == 422

    # Explicit WhatsApp consent → recorded with evidence incl. the key prefix; only that channel.
    prefix = (await owner.get("/automations/api-keys")).json()[0]["prefix"]
    r = (await _ingest(secret, _visit(loc, phone="+919812345603", email="wa@example.com", consent={"whatsapp": True, "source": "booking_form", "text": CONSENT_TEXT}))).json()
    assert r["status"] == "scheduled"
    async with SessionLocal() as db:
        rows = (await db.scalars(select(CustomerConsent).where(CustomerConsent.customer_id == uuid.UUID(r["customer_id"])))).all()
    assert [(c.channel, c.status) for c in rows] == [("whatsapp", "granted")]
    assert rows[0].evidence["api_key_prefix"] == prefix and rows[0].evidence["text"] == CONSENT_TEXT
    assert rows[0].source == "api:booking_form"


async def test_validation_errors():
    owner = await signup()
    loc = await create_location(owner)
    secret = await _key(owner)
    no_contact = _visit(loc)
    no_contact["customer"] = {"name": "Nobody"}
    assert (await _ingest(secret, no_contact)).status_code == 422
    no_loc = _visit(loc)
    del no_loc["location_id"]
    assert (await _ingest(secret, no_loc)).status_code == 422
    future = _visit(loc, occurred_at=_now_iso(60 * 48))
    assert (await _ingest(secret, future)).status_code == 422
    by_slug = _visit(loc)
    del by_slug["location_id"]
    by_slug["location_slug"] = loc["slug"]
    r = await _ingest(secret, by_slug)
    assert r.status_code == 201 and r.json()["skip_reason"] == "no_matching_rule"
    # A visit from weeks ago is recorded but not messaged.
    await _rule(owner)
    old = await _ingest(secret, _visit(loc, occurred_at=(datetime.now(UTC) - timedelta(days=30)).isoformat()))
    assert old.json()["status"] == "skipped" and old.json()["skip_reason"] == "visit_too_old"


# ------------------------------------------------------------------ rules


async def test_rule_matching_location_beats_org_wide():
    owner = await signup()
    loc_a = await create_location(owner, "Bandra")
    loc_b = await create_location(owner, "Andheri")
    org_wide = await _rule(owner, name="All locations", delay_minutes=180)
    specific = await _rule(owner, name="Bandra only", location_id=loc_a["id"], delay_minutes=30)
    secret = await _key(owner)
    consent = {"email": True, "source": "pos", "text": CONSENT_TEXT}
    a = (await _ingest(secret, _visit(loc_a, consent=consent))).json()
    b = (await _ingest(secret, _visit(loc_b, consent=consent))).json()
    assert a["rule_id"] == specific["id"] and b["rule_id"] == org_wide["id"]
    # Disabled rules don't match.
    assert (await owner.patch(f"/automations/rules/{specific['id']}", {"enabled": False})).json()["enabled"] is False
    a2 = (await _ingest(secret, _visit(loc_a, consent=consent))).json()
    assert a2["rule_id"] == org_wide["id"]
    rules = (await owner.get("/automations/rules")).json()
    assert rules[0]["id"] == specific["id"] and rules[0]["location_name"] == "Bandra"
    assert next(r for r in rules if r["id"] == org_wide["id"])["stats"]["visits_7d"] == 2


async def test_rule_validation_and_plan():
    owner = await signup()
    loc = await create_location(owner)
    assert (await owner.post("/automations/rules", {"name": "No link", "channel": "email", "message_body": "Please review us soon!"})).status_code == 422
    assert (await owner.post("/automations/rules", {"name": "Gating", "channel": "email", "message_body": "Leave us a 5-star review: {{link}}"})).status_code == 422
    assert (await owner.post("/automations/rules", {"name": "Incentive", "channel": "email", "message_body": "Get a free gift for feedback {{link}}"})).status_code == 422
    assert (await owner.post("/automations/rules", {"name": "No message", "channel": "email"})).status_code == 422
    assert (await owner.post("/automations/rules", {"name": "Too slow", "channel": "email", "message_body": BODY, "delay_minutes": 10081})).status_code == 422
    assert (await owner.post("/automations/rules", {"name": "Bad hours", "channel": "email", "message_body": BODY, "quiet_hours": {"start": 25, "end": 9}})).status_code == 422
    ok = await _rule(owner, location_id=loc["id"], quiet_hours={"start": 21, "end": 9}, delay_minutes=10080)
    assert ok["quiet_hours"] == {"start": 21, "end": 9}
    upd = (await owner.patch(f"/automations/rules/{ok['id']}", {"quiet_hours": None, "delay_minutes": 0})).json()
    assert upd["quiet_hours"] == {} and upd["delay_minutes"] == 0 and upd["message_body"] == BODY
    # Template from the system library works; channel must match.
    templates = (await owner.get("/campaigns/templates")).json()
    wa_tpl = next(t for t in templates if t["channel"] == "whatsapp")
    assert (await owner.post("/automations/rules", {"name": "Tpl", "channel": "email", "template_id": wa_tpl["id"]})).status_code == 400
    assert (await owner.post("/automations/rules", {"name": "Tpl", "channel": "whatsapp", "template_id": wa_tpl["id"]})).status_code == 201

    await set_plan(owner.org_id, "starter")
    r = await owner.post("/automations/rules", {"name": "WA", "channel": "whatsapp", "message_body": BODY})
    assert r.status_code == 402 and r.json()["error"]["details"]["entitlement"] == "whatsapp_campaigns"
    assert (await owner.post("/automations/rules", {"name": "Auto", "channel": "auto", "message_body": BODY})).status_code == 201
    assert (await owner.delete(f"/automations/rules/{ok['id']}")).status_code == 204
    assert (await owner.patch(f"/automations/rules/{ok['id']}", {"enabled": False})).status_code == 404


# ------------------------------------------------------------------ scheduling math


IST = "Asia/Kolkata"


def _ist(y, mo, d, h, mi=0) -> datetime:
    from zoneinfo import ZoneInfo

    return datetime(y, mo, d, h, mi, tzinfo=ZoneInfo(IST)).astimezone(UTC)


def test_quiet_hours_and_delay_math():
    quiet = {"start": 21, "end": 9}
    at = _ist(2026, 11, 10, 8)
    # 10:00 visit + 2h → 12:00, outside quiet hours.
    assert svc.compute_schedule(_ist(2026, 11, 10, 10), 120, quiet, IST, at=at) == _ist(2026, 11, 10, 12)
    # 20:30 + 2h → 22:30 is quiet → next day 09:00 local.
    assert svc.compute_schedule(_ist(2026, 11, 10, 20, 30), 120, quiet, IST, at=at) == _ist(2026, 11, 11, 9)
    # 01:15 + 30m → 01:45 quiet → same day 09:00.
    assert svc.compute_schedule(_ist(2026, 11, 10, 1, 15), 30, quiet, IST, at=_ist(2026, 11, 10, 0)) == _ist(2026, 11, 10, 9)
    # Exactly at the end hour is allowed; exactly at the start hour is quiet.
    assert svc.apply_quiet_hours(_ist(2026, 11, 10, 9), quiet, IST) == _ist(2026, 11, 10, 9)
    assert svc.apply_quiet_hours(_ist(2026, 11, 10, 21), quiet, IST) == _ist(2026, 11, 11, 9)
    # Same-day window (13–15) and disabled windows.
    assert svc.apply_quiet_hours(_ist(2026, 11, 10, 14, 10), {"start": 13, "end": 15}, IST) == _ist(2026, 11, 10, 15)
    assert svc.apply_quiet_hours(_ist(2026, 11, 10, 23), {"start": 9, "end": 9}, IST) == _ist(2026, 11, 10, 23)
    assert svc.apply_quiet_hours(_ist(2026, 11, 10, 23), {}, IST) == _ist(2026, 11, 10, 23)
    # Quiet hours are evaluated in the location's timezone, not UTC.
    london_evening = datetime(2026, 11, 10, 22, 0, tzinfo=UTC)  # 22:00 London = 03:30 IST next day
    assert svc.apply_quiet_hours(london_evening, quiet, "Europe/London") == datetime(2026, 11, 11, 9, 0, tzinfo=UTC)
    assert svc.apply_quiet_hours(london_evening, quiet, IST) == _ist(2026, 11, 11, 9)
    # Old visits are scheduled "now", never in the past.
    assert svc.compute_schedule(_ist(2026, 11, 1, 10), 120, None, IST, at=at) == at
    assert CRONS == [("process_due_visits", {"minute": set(range(0, 60, 5))})]


async def test_delay_is_applied_at_ingestion():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, delay_minutes=120)
    secret = await _key(owner)
    r = (await _ingest(secret, _visit(loc, consent={"email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert r["status"] == "scheduled"
    eta = datetime.fromisoformat(r["scheduled_for"])
    assert timedelta(minutes=119) < eta - datetime.now(UTC) < timedelta(minutes=121)
    # Not due yet → the cron leaves it alone.
    await TASKS["process_due_visits"]({})
    assert (await _visit_row(r["id"])).status == "scheduled"


# ------------------------------------------------------------------ processing


async def test_processing_sends_in_demo_mode(monkeypatch):
    sent: list[dict] = []
    original = messaging.MockAdapter.send

    async def capture(self, *, to, body, template=None):
        sent.append({"to": to, "body": body, "template": template})
        return await original(self, to=to, body=body, template=template)

    monkeypatch.setattr(messaging.MockAdapter, "send", capture)
    owner = await signup(business="Chai Point")
    loc = await create_location(owner, google_review_url="https://search.google.com/local/writereview?placeid=test")
    rule = await _rule(owner, channel="auto", message_body="Namaste {{name}}! How was {{location}}? {{link}}")
    secret = await _key(owner)
    # WhatsApp + email consent → auto prefers WhatsApp.
    r = (await _ingest(secret, _visit(loc, phone="+919811100011", email="both@example.com", consent={"whatsapp": True, "email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert r["status"] == "scheduled"
    await drain_inline_tasks()
    row = await _visit_row(r["id"])
    assert row.status == "sent" and row.review_request_id is not None
    async with SessionLocal() as db:
        req = await db.get(ReviewRequest, row.review_request_id)
        delivery = await db.scalar(select(MessageDelivery).where(MessageDelivery.review_request_id == req.id))
    assert req.campaign_id is None and req.channel == "whatsapp" and req.status == "delivered"
    assert delivery.provider == "mock"  # demo mode is simulated, never a fake real provider
    assert sent and sent[-1]["body"].startswith("Namaste Riya! How was Main Branch?") and f"?t={req.tracking_token}" in sent[-1]["body"]

    activity = (await owner.get("/automations/visits")).json()
    assert activity["total"] == 1 and activity["items"][0]["status"] == "sent" and activity["items"][0]["rule_name"] == rule["name"]
    assert activity["items"][0]["channel"] == "whatsapp" and activity["items"][0]["request_status"] == "delivered"
    # The customer clicks through to Google → summary attributes it.
    page = new_client()
    assert (await page.post(f"/api/v1/public/locations/{loc['slug']}/google-click", json={"t": req.tracking_token})).status_code == 200
    summary = (await owner.get("/automations/summary")).json()
    assert summary["received"] == 1 and summary["sent"] == 1 and summary["scheduled"] == 0
    assert summary["google_clicks"] == 1 and summary["rules_enabled"] == 1 and summary["api_keys_active"] == 1


async def test_failures_notify_once_per_rule_per_day():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, channel="whatsapp", delay_minutes=0)
    secret = await _key(owner)
    consent = {"whatsapp": True, "source": "pos", "text": CONSENT_TEXT}
    # The demo adapter simulates an undeliverable number for phones ending in 0000.
    a = (await _ingest(secret, _visit(loc, phone="+919800000000", consent=consent))).json()
    b = (await _ingest(secret, _visit(loc, phone="+919811110000", consent=consent))).json()
    await drain_inline_tasks()
    assert (await _visit_row(a["id"])).status == "failed" and (await _visit_row(b["id"])).status == "failed"
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count()).select_from(Notification).where(Notification.organization_id == uuid.UUID(owner.org_id), Notification.type == "automation.failed"))
    assert n == 1
    failed = (await owner.get("/automations/visits", params={"status": "failed"})).json()
    assert failed["total"] == 2 and "0000" in (failed["items"][0]["skip_reason"] or "")


async def test_cooldown_skip_at_ingestion_and_send_time():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, delay_minutes=0, cooldown_days=30)
    secret = await _key(owner)
    consent = {"email": True, "source": "pos", "text": CONSENT_TEXT}
    first = (await _ingest(secret, _visit(loc, email="cool@example.com", consent=consent))).json()
    await drain_inline_tasks()
    assert (await _visit_row(first["id"])).status == "sent"
    second = (await _ingest(secret, _visit(loc, email="cool@example.com"))).json()
    assert second["status"] == "skipped" and second["skip_reason"] == "cooldown"

    # Two visits scheduled before either was sent: the second is skipped at send time.
    owner2 = await signup()
    loc2 = await create_location(owner2)
    await _rule(owner2, delay_minutes=60, cooldown_days=7)
    key2 = await _key(owner2)
    v1 = (await _ingest(key2, _visit(loc2, email="twice@example.com", consent=consent))).json()
    v2 = (await _ingest(key2, _visit(loc2, email="twice@example.com"))).json()
    assert v1["status"] == v2["status"] == "scheduled"
    await _force_due(v1["id"])
    await _force_due(v2["id"])
    await TASKS["process_due_visits"]({})
    statuses = sorted([((await _visit_row(v["id"])).status, (await _visit_row(v["id"])).skip_reason) for v in (v1, v2)], key=lambda s: s[0])
    assert statuses == [("sent", None), ("skipped", "cooldown")]


async def test_opt_out_skip_at_send_time():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, delay_minutes=90)
    secret = await _key(owner)
    v = (await _ingest(secret, _visit(loc, email="optout@example.com", consent={"email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert v["status"] == "scheduled"
    assert (await owner.post(f"/customers/{v['customer_id']}/opt-out")).status_code == 200
    await _force_due(v["id"])
    await TASKS["process_due_visits"]({})
    row = await _visit_row(v["id"])
    assert row.status == "skipped" and row.skip_reason == "opted_out" and row.review_request_id is None
    # New visits for an opted-out customer are skipped immediately.
    again = (await _ingest(secret, _visit(loc, email="optout@example.com", consent={"email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert again["skip_reason"] == "opted_out"
    summary = (await owner.get("/automations/summary")).json()
    assert {"reason": "opted_out", "count": 2} in [{"reason": x["reason"], "count": x["count"]} for x in summary["skipped_by_reason"]]


async def test_disabled_rule_and_unavailable_channel_skip(monkeypatch):
    owner = await signup()
    loc = await create_location(owner)
    rule = await _rule(owner, delay_minutes=30)
    secret = await _key(owner)
    v = (await _ingest(secret, _visit(loc, consent={"email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    await owner.patch(f"/automations/rules/{rule['id']}", {"enabled": False})
    await _force_due(v["id"])
    await TASKS["process_due_visits"]({})
    assert (await _visit_row(v["id"])).skip_reason == "rule_disabled"

    # Outside demo mode with no provider configured, the channel is unavailable → skipped (not faked).
    await owner.patch(f"/automations/rules/{rule['id']}", {"enabled": True})
    from app.core.config import settings

    monkeypatch.setattr(settings, "demo_mode", False)
    v2 = (await _ingest(secret, _visit(loc, consent={"email": True, "source": "pos", "text": CONSENT_TEXT}))).json()
    assert v2["status"] == "skipped" and v2["skip_reason"] == "channel_unavailable"


async def test_staff_records_visit_manually():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, delay_minutes=0)
    staff = await add_member(owner, "staff")
    r = await staff.post("/automations/visits", {"location_id": loc["id"], "customer": {"name": "Walk In", "email": "walkin@example.com"}, "consent": {"email": True, "note": "Asked at the counter"}})
    assert r.status_code == 201, r.text
    await drain_inline_tasks()
    assert (await _visit_row(r.json()["id"])).status == "sent"
    async with SessionLocal() as db:
        c = await db.scalar(select(CustomerConsent).where(CustomerConsent.customer_id == uuid.UUID(r.json()["customer_id"])))
    assert c.source == "in_person" and c.recorded_by_id is not None and c.evidence["note"] == "Asked at the counter"
    # Existing customer + receipt id dedupe.
    body = {"location_id": loc["id"], "customer_id": r.json()["customer_id"], "external_id": "R-77"}
    assert (await staff.post("/automations/visits", body)).status_code == 201
    dup = await staff.post("/automations/visits", body)
    assert dup.status_code == 200 and dup.json()["duplicate"] is True
    assert (await staff.post("/automations/visits", {"location_id": loc["id"]})).status_code == 422


# ------------------------------------------------------------------ Shopify


def _sign(secret: str, raw: bytes) -> str:
    return base64.b64encode(hmac.new(secret.encode(), raw, hashlib.sha256).digest()).decode()


async def _shopify_post(slug: str, order: dict, secret: str | None, topic: str = "orders/paid", signature: str | None = None):
    raw = json.dumps(order).encode()
    headers = {"Content-Type": "application/json", "X-Shopify-Topic": topic, "X-Shopify-Shop-Domain": "chai-point.myshopify.com", "X-Shopify-Webhook-Id": uuid.uuid4().hex}
    headers["X-Shopify-Hmac-Sha256"] = signature if signature is not None else _sign(secret or "", raw)
    return await new_client().post(f"/api/v1/automations/webhooks/shopify/{slug}", content=raw, headers=headers)


async def test_shopify_webhook_hmac_and_consent():
    owner = await signup()
    loc = await create_location(owner)
    await _rule(owner, channel="auto", delay_minutes=0)
    secret = "shpss_" + "a1" * 16
    slug = owner.me["memberships"][0]["organization"]["slug"]

    status = (await owner.get("/automations/shopify")).json()
    assert status["configured"] is False and status["status"] == "not_connected"
    assert (await owner.put("/automations/shopify", {"location_id": loc["id"]})).status_code == 422  # secret required first time
    saved = (await owner.put("/automations/shopify", {"webhook_secret": secret, "location_id": loc["id"], "shop_domain": "chai-point.myshopify.com"})).json()
    assert saved["configured"] is True and saved["status"] == "pending_authorization"  # never "connected" before a signed webhook
    assert saved["secret_hint"].endswith(secret[-4:]) and secret not in json.dumps(saved)
    assert saved["webhook_url"].endswith(f"/api/v1/automations/webhooks/shopify/{slug}")

    consented = {
        "id": 5501, "name": "#1001", "email": "shopper@example.com", "processed_at": _now_iso(-5), "customer_locale": "en",
        "customer": {"first_name": "Meera", "last_name": "Iyer", "email": "shopper@example.com",
                     "email_marketing_consent": {"state": "subscribed", "opt_in_level": "single_opt_in", "consent_updated_at": _now_iso(-10)},
                     "sms_marketing_consent": None},
    }
    # Invalid / missing signatures and unknown shops are rejected.
    assert (await _shopify_post(slug, consented, "wrong-secret")).status_code == 401
    assert (await _shopify_post(slug, consented, None, signature="")).status_code == 401
    assert (await _shopify_post("no-such-org", consented, secret)).status_code == 401

    ok = await _shopify_post(slug, consented, secret)
    assert ok.status_code == 200 and ok.json()["status"] == "scheduled", ok.text
    await drain_inline_tasks()
    assert (await _visit_row(ok.json()["visit_id"])).status == "sent"
    assert (await owner.get("/automations/shopify")).json()["status"] == "connected"
    # orders/fulfilled for the same order is the same visit.
    dup = await _shopify_post(slug, consented, secret, topic="orders/fulfilled")
    assert dup.json()["duplicate"] is True and dup.json()["visit_id"] == ok.json()["visit_id"]
    # Unsupported topics are acknowledged but ignored.
    assert (await _shopify_post(slug, {"id": 1}, secret, topic="products/update")).json()["ignored"] == "topic"

    # No explicit consent on the order → customer stored, visit skipped.
    plain = {"id": 5502, "email": "plain@example.com", "phone": "+919822233344", "buyer_accepts_marketing": True, "customer": {"first_name": "Arjun", "email_marketing_consent": {"state": "not_subscribed"}}}
    r = await _shopify_post(slug, plain, secret)
    assert r.json()["status"] == "skipped" and r.json()["skip_reason"] == "no_consent"
    visits = (await owner.get("/automations/visits", params={"source": "shopify"})).json()
    plain_visit = next(v for v in visits["items"] if v["external_id"] == "5502")
    assert plain_visit["customer_name"] == "Arjun" and plain_visit["customer_contact"] == "+919822233344"
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count()).select_from(CustomerConsent).where(CustomerConsent.customer_id == uuid.UUID(plain_visit["customer_id"])))
        ev = await db.scalar(select(CustomerConsent).where(CustomerConsent.source == "shopify", CustomerConsent.organization_id == uuid.UUID(owner.org_id)))
    assert n == 0
    assert ev.channel == "email" and ev.evidence["email_marketing_consent"]["state"] == "subscribed" and ev.evidence["order_id"] == "5501"

    assert (await owner.delete("/automations/shopify")).status_code == 204
    assert (await _shopify_post(slug, consented, secret)).status_code == 401


# ------------------------------------------------------------------ RBAC & tenancy


async def test_rbac_staff_and_manager():
    owner = await signup()
    loc = await create_location(owner)
    rule = await _rule(owner)
    staff = await add_member(owner, "staff")
    manager = await add_member(owner, "manager")
    for path in ("/automations/rules", "/automations/api-keys", "/automations/shopify"):
        assert (await staff.get(path)).status_code == 403
    assert (await staff.post("/automations/rules", {"name": "Cross tenant", "channel": "email", "message_body": BODY})).status_code == 403
    assert (await staff.patch(f"/automations/rules/{rule['id']}", {"enabled": False})).status_code == 403
    assert (await staff.post("/automations/api-keys", {"name": "sneaky"})).status_code == 403
    assert (await staff.get("/automations/visits")).status_code == 200  # can see the log, can record visits
    # Managers run campaigns/rules but can't mint integration keys or touch Shopify.
    assert (await manager.post("/automations/rules", {"name": "Manager rule", "channel": "email", "message_body": BODY, "location_id": loc["id"]})).status_code == 201
    assert (await manager.post("/automations/api-keys", {"name": "nope"})).status_code == 403
    assert (await manager.put("/automations/shopify", {"webhook_secret": "x" * 20, "location_id": loc["id"]})).status_code == 403
    analyst = await add_member(owner, "analyst")
    assert (await analyst.get("/automations/visits")).status_code == 403


async def test_tenant_isolation():
    a = await signup(business="Org A")
    b = await signup(business="Org B")
    loc_a = await create_location(a)
    loc_b = await create_location(b)
    await _rule(a)
    rule_b = await _rule(b)
    key_a = await _key(a)
    key_b_id = (await b.post("/automations/api-keys", {"name": "Org B key"})).json()["key"]["id"]

    r = await _ingest(key_a, _visit(loc_b))
    assert r.status_code == 404 and r.json()["error"]["code"] == "location_not_found"
    by_slug = _visit(loc_b)
    del by_slug["location_id"]
    by_slug["location_slug"] = loc_b["slug"]
    assert (await _ingest(key_a, by_slug)).status_code == 404
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(VisitEvent).where(VisitEvent.organization_id == uuid.UUID(b.org_id))) == 0

    assert (await a.patch(f"/automations/rules/{rule_b['id']}", {"enabled": False})).status_code == 404
    assert (await a.delete(f"/automations/rules/{rule_b['id']}")).status_code == 404
    assert (await a.delete(f"/automations/api-keys/{key_b_id}")).status_code == 404
    assert rule_b["id"] not in [x["id"] for x in (await a.get("/automations/rules")).json()]
    assert (await a.post("/automations/rules", {"name": "Cross tenant", "channel": "email", "message_body": BODY, "location_id": loc_b["id"]})).status_code == 404
    assert (await a.post("/automations/visits", {"location_id": loc_b["id"], "customer": {"email": "x@example.com"}})).status_code == 404
    ok = await _ingest(key_a, _visit(loc_a))
    assert ok.status_code == 201
    assert (await b.get("/automations/visits")).json()["total"] == 0


@pytest.mark.parametrize("raw", ["", "Bearer ", "Basic abc"])
async def test_ingest_requires_key_header(raw):
    client = new_client()
    res = await client.post("/api/v1/automations/ingest/visits", json={}, headers={"Authorization": raw} if raw else {})
    assert res.status_code == 401
