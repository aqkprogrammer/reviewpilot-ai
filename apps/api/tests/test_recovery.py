from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import GoogleAccount, GoogleConnection, Location, Notification, RecoveryCase, Review
from app.providers import google_business as gbp
from app.services import google_sync
from app.services import recovery as svc
from app.services.jobs import drain_inline_tasks
from tests.conftest import add_member, create_location, create_review, new_client, signup

FEEDBACK = {"privacy_accepted": True, "elapsed_ms": 6000, "language": "en"}


async def _drain() -> None:
    await svc.drain_pending_alerts()
    await drain_inline_tasks()


async def _feedback(slug: str, **body) -> None:
    res = await new_client().post(f"/api/v1/public/locations/{slug}/feedback", json={**FEEDBACK, **body})
    assert res.status_code == 201, res.text


async def _cases(org_id: str) -> list[RecoveryCase]:
    async with SessionLocal() as db:
        return list((await db.scalars(select(RecoveryCase).where(RecoveryCase.organization_id == uuid.UUID(org_id)).order_by(RecoveryCase.created_at))).all())


async def _case(case_id: str) -> RecoveryCase:
    async with SessionLocal() as db:
        return await db.get(RecoveryCase, uuid.UUID(case_id))


async def _notifications(user_id: str, type_: str) -> int:
    async with SessionLocal() as db:
        return await db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == uuid.UUID(user_id), Notification.type == type_)) or 0


def _events(case: RecoveryCase | dict) -> list[str]:
    tl = case["timeline"] if isinstance(case, dict) else case.timeline
    return [e["event"] for e in tl]


async def _manual_case(owner, loc_id: str, rating: int = 1, comment: str = "Food was cold and the staff were rude") -> dict:
    rid = await create_review(owner.org_id, loc_id, rating, comment)
    res = await owner.post("/recovery", {"review_id": rid})
    assert res.status_code == 201, res.text
    return res.json()


def _raw_review(rid: str, stars: str, comment: str, days_ago: float = 0.1) -> dict:
    t = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat().replace("+00:00", "Z")
    return {"name": f"accounts/1/locations/9/reviews/{rid}", "reviewer": {"displayName": "Vikram P."}, "starRating": stars, "comment": comment, "createTime": t, "updateTime": t}


# ------------------------------------------------------------------ auto-open


async def test_low_google_review_auto_opens_once(monkeypatch):
    owner = await signup()
    loc = await create_location(owner)
    async with SessionLocal() as db:
        conn = GoogleConnection(organization_id=uuid.UUID(owner.org_id), status="connected")
        db.add(conn)
        await db.flush()
        acct = GoogleAccount(organization_id=conn.organization_id, connection_id=conn.id, account_name="accounts/1")
        db.add(acct)
        await db.flush()
        location = await db.get(Location, uuid.UUID(loc["id"]))
        location.google_location_name, location.google_account_id = "locations/9", acct.id
        await db.commit()
        conn_id = conn.id

    raw = [
        _raw_review("r1", "ONE", "Waited an hour and the food was cold"),
        _raw_review("r2", "TWO", "Slow service"),
        _raw_review("r3", "FOUR", "Nice place"),
        _raw_review("r4", "ONE", "Terrible, years ago", days_ago=400),  # history from a first sync: no case
    ]

    async def fake_token(db, conn):
        return "token"

    async def fake_list(self, account, location_name, max_pages=20):
        return raw

    monkeypatch.setattr(google_sync, "valid_access_token", fake_token)
    monkeypatch.setattr(gbp.GBPClient, "list_reviews", fake_list)
    async with SessionLocal() as db:
        assert (await google_sync.sync_connection(db, conn_id))["created"] == 4
    await _drain()
    cases = await _cases(owner.org_id)
    assert sorted(c.severity for c in cases) == ["critical", "high"]
    crit = next(c for c in cases if c.severity == "critical")
    assert crit.source == "review" and crit.status == "open" and crit.review_id is not None
    assert abs((crit.due_at - crit.created_at) - timedelta(hours=4)) < timedelta(seconds=5)
    high = next(c for c in cases if c.severity == "high")
    assert abs((high.due_at - high.created_at) - timedelta(hours=24)) < timedelta(seconds=5)
    # The alert job ran after commit: in-app notification + honest WhatsApp skip (no numbers configured).
    assert crit.alerted_at is not None
    assert "alert_sent" in _events(crit) and "whatsapp_alert_skipped" in _events(crit)
    assert await _notifications(owner.me["user"]["id"], "recovery.case_opened") == 2

    # A re-sync (same reviews) never duplicates cases.
    async with SessionLocal() as db:
        assert (await google_sync.sync_connection(db, conn_id))["created"] == 0
    await _drain()
    assert len(await _cases(owner.org_id)) == 2
    async with SessionLocal() as db:
        review = await db.get(Review, crit.review_id)
        assert await svc.auto_open_for_review(db, review) is None  # explicit second call: still no duplicate


async def test_negative_feedback_auto_opens_and_positive_does_not():
    owner = await signup()
    loc = await create_location(owner)
    await _feedback(loc["slug"], rating=1, message="Rude staff and cold food", name="Neha", phone="9876500011", consent_contact=True)
    await _feedback(loc["slug"], message="Terrible experience, waited forever and it was dirty")  # no rating, negative sentiment
    await _feedback(loc["slug"], rating=5, message="Lovely evening, great food")
    await _feedback(loc["slug"], rating=3, message="It was fine")
    await _drain()
    cases = await _cases(owner.org_id)
    assert [(c.source, c.severity) for c in cases] == [("feedback", "critical"), ("feedback", "high")]
    detail = (await owner.get(f"/recovery/{cases[0].id}")).json()
    assert detail["feedback"]["message"] == "Rude staff and cold food"
    assert detail["contact"]["phone"] == "+919876500011" and detail["contact"]["consent_contact"] is True
    assert detail["contact"]["consents"].get("whatsapp") is True and detail["contact"]["can_contact"] is True
    assert not svc.policy_violation(detail["contact"]["suggested_message"])
    assert (await owner.get(f"/recovery/{cases[1].id}")).json()["contact"] is None  # anonymous: no contact info


async def test_demo_reviews_never_auto_open_but_can_be_opened_manually():
    owner = await signup()
    loc = await create_location(owner)
    rid = await create_review(owner.org_id, loc["id"], 1, "Awful")  # source="demo"
    async with SessionLocal() as db:
        assert await svc.auto_open_for_review(db, await db.get(Review, uuid.UUID(rid))) is None
        await db.commit()
    assert await _cases(owner.org_id) == []
    res = await owner.post("/recovery", {"review_id": rid})
    assert res.status_code == 201 and res.json()["is_demo"] is True and res.json()["severity"] == "critical"
    dup = await owner.post("/recovery", {"review_id": rid})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "case_exists"
    assert dup.json()["error"]["details"]["case_id"] == res.json()["id"]
    lookup = (await owner.get("/recovery", params={"review_id": rid, "status": "all"})).json()
    assert lookup["total"] == 1
    other = await create_review(owner.org_id, loc["id"], 2, "Meh")
    refs = (await owner.get("/recovery/lookup", params=[("review_id", rid), ("review_id", other)])).json()
    assert list(refs["reviews"]) == [rid] and refs["reviews"][rid]["status"] == "open" and refs["feedback"] == {}


async def test_settings_disable_and_thresholds():
    owner = await signup()
    loc = await create_location(owner)
    s = (await owner.get("/recovery/settings")).json()
    assert s["review_max_rating"] == 2 and s["sla_hours"] == {"critical": 4, "high": 24, "medium": 48}
    assert s["whatsapp_channel"]["mode"] == "simulated"  # demo mode in tests
    res = await owner.put("/recovery/settings", {**s, "feedback_max_rating": 3, "feedback_negative": False, "sla_hours": {"critical": 2, "high": 8, "medium": 72}})
    assert res.status_code == 200, res.text
    await _feedback(loc["slug"], rating=3, message="It was okay")
    await _drain()
    [c] = await _cases(owner.org_id)
    assert c.severity == "medium" and abs((c.due_at - c.created_at) - timedelta(hours=72)) < timedelta(seconds=5)
    await owner.put("/recovery/settings", {**s, "enabled": False})
    await _feedback(loc["slug"], rating=1, message="Bad")
    assert len(await _cases(owner.org_id)) == 1


async def test_settings_validation_and_permission():
    owner = await signup()
    s = (await owner.get("/recovery/settings")).json()
    for bad in (
        {"alert_whatsapp": ["9876543210"]},  # no country code
        {"alert_whatsapp": ["+0123"]},
        {"alert_whatsapp": [f"+9198765432{i:02d}" for i in range(6)]},  # too many
        {"sla_hours": {"critical": 30, "high": 24, "medium": 48}},  # not ordered
        {"sla_hours": {"critical": 0, "high": 24, "medium": 48}},
        {"review_max_rating": 5},
        {"whatsapp_template": "Recovery Alert!"},
    ):
        res = await owner.put("/recovery/settings", {**s, **bad})
        assert res.status_code == 422, (bad, res.text)
    ok = await owner.put("/recovery/settings", {**s, "alert_whatsapp": ["+91 98765 43210", "+919876543210", "+14155550100"]})
    assert ok.status_code == 200 and ok.json()["alert_whatsapp"] == ["+919876543210", "+14155550100"]
    manager = await add_member(owner, "manager")
    assert (await manager.get("/recovery/settings")).status_code == 403
    assert (await manager.put("/recovery/settings", s)).status_code == 403


# ------------------------------------------------------------------ alerts


async def test_alert_uses_mock_whatsapp_in_demo_mode():
    owner = await signup()
    loc = await create_location(owner)
    s = (await owner.get("/recovery/settings")).json()
    await owner.put("/recovery/settings", {**s, "alert_whatsapp": ["+919876543210", "+919800000000"]})
    await _feedback(loc["slug"], rating=2, message="Slow and cold")
    await _drain()
    [c] = await _cases(owner.org_id)
    ev = {e["event"]: e for e in c.timeline}
    assert "whatsapp_alert_simulated" in ev and "Nothing was sent" in ev["whatsapp_alert_simulated"]["note"]
    assert "+919876543210" not in ev["whatsapp_alert_simulated"]["note"]  # numbers are masked in the timeline
    assert "whatsapp_alert_failed" in ev  # the mock fails numbers ending in 0000
    assert "whatsapp_alert_sent" not in ev
    async with SessionLocal() as db:  # running the job again is a no-op
        assert (await svc.send_alert(db, c.id)) == {"skipped": "already_alerted"}


async def test_alert_skips_whatsapp_honestly_when_unconfigured(monkeypatch):
    owner = await signup()
    loc = await create_location(owner)
    s = (await owner.get("/recovery/settings")).json()
    await owner.put("/recovery/settings", {**s, "alert_whatsapp": ["+919876543210"]})
    monkeypatch.setattr(settings, "demo_mode", False)
    await _feedback(loc["slug"], rating=1, message="Never again")
    await _drain()
    [c] = await _cases(owner.org_id)
    events = _events(c)
    assert "whatsapp_alert_skipped" in events
    assert not {"whatsapp_alert_sent", "whatsapp_alert_simulated"} & set(events)
    note = next(e["note"] for e in c.timeline if e["event"] == "whatsapp_alert_skipped")
    assert "isn't connected" in note and "Nothing was sent" in note
    assert c.alerted_at is not None


# ------------------------------------------------------------------ SLA


async def test_sla_breach_marked_and_notified_once():
    owner = await signup()
    loc = await create_location(owner)
    case = await _manual_case(owner, loc["id"])
    await _drain()
    async with SessionLocal() as db:
        c = await db.get(RecoveryCase, uuid.UUID(case["id"]))
        c.due_at = datetime.now(UTC) - timedelta(minutes=5)
        await db.commit()
    async with SessionLocal() as db:
        assert (await svc.check_sla(db))["breached"] >= 1
    async with SessionLocal() as db:
        await svc.check_sla(db)  # second run must not re-mark or re-notify
    c = await _case(case["id"])
    assert _events(c).count("sla_breached") == 1
    # The manual creator is the owner; breach notifications go to everyone who can act.
    assert await _notifications(owner.me["user"]["id"], "recovery.sla_breached") == 1
    summary = (await owner.get("/recovery/summary")).json()
    assert summary["breached"] == 1 and summary["open"] == 1
    item = (await owner.get("/recovery", params={"status": "breached"})).json()["items"]
    assert [i["id"] for i in item] == [case["id"]] and item[0]["breached"] and item[0]["sla_missed"]
    # Outreach stops the clock: no longer counted as breached, but the miss stays on record.
    await owner.post(f"/recovery/{case['id']}/contact", {"channel": "call", "outcome": "reached"})
    after = (await owner.get(f"/recovery/{case['id']}")).json()
    assert after["breached"] is False and after["sla_missed"] is True
    assert (await owner.get("/recovery/summary")).json()["breached"] == 0


# ------------------------------------------------------------------ actions


async def test_contact_resolve_reopen_and_summary():
    owner = await signup()
    loc = await create_location(owner)
    case = await _manual_case(owner, loc["id"], rating=2)
    assert case["severity"] == "high" and case["status"] == "open" and case["first_response_at"] is None
    res = await owner.post(f"/recovery/{case['id']}/notes", {"note": "Checked the kitchen log for that evening."})
    assert res.status_code == 200 and _events(res.json())[-1] == "note"
    first = (await owner.post(f"/recovery/{case['id']}/contact", {"channel": "whatsapp", "outcome": "message_sent", "note": "Apologised and asked what went wrong."})).json()
    assert first["status"] == "contacted" and first["first_response_at"]
    second = (await owner.post(f"/recovery/{case['id']}/contact", {"channel": "call", "outcome": "reached"})).json()
    assert second["first_response_at"] == first["first_response_at"]  # only the first sets it
    assert (await owner.post(f"/recovery/{case['id']}/contact", {"channel": "fax"})).status_code == 422
    resolved = await owner.post(f"/recovery/{case['id']}/resolve", {"resolution": "resolved_happy", "note": "Customer appreciated the call."})
    assert resolved.status_code == 200 and resolved.json()["status"] == "resolved" and resolved.json()["resolved_at"]
    assert (await owner.post(f"/recovery/{case['id']}/resolve", {"resolution": "resolved_happy"})).status_code == 409
    assert (await owner.post(f"/recovery/{case['id']}/contact", {"channel": "call"})).status_code == 409
    summary = (await owner.get("/recovery/summary")).json()
    assert summary["open"] == 0 and summary["resolved_7d"] == 1 and summary["median_first_response_hours"] is not None
    reopened = await owner.post(f"/recovery/{case['id']}/reopen", {"note": "Customer wrote back."})
    assert reopened.status_code == 200 and reopened.json()["status"] == "open" and reopened.json()["resolution"] is None
    assert (await owner.post(f"/recovery/{case['id']}/reopen")).status_code == 409
    events = _events(reopened.json())
    for e in ("opened", "note", "contact_logged", "first_response", "resolved", "reopened"):
        assert e in events
    assert all({"at", "by", "event"} <= set(e) for e in reopened.json()["timeline"])
    # Audit trail for mutating actions.
    from app.models import AuditLog

    async with SessionLocal() as db:
        actions = set((await db.scalars(select(AuditLog.action).where(AuditLog.target_id == case["id"]))).all())
    assert {"recovery.case_created", "recovery.note_added", "recovery.contact_logged", "recovery.case_resolved", "recovery.case_reopened"} <= actions


async def test_patch_status_severity_and_assignee_must_be_member():
    owner = await signup()
    loc = await create_location(owner)
    case = await _manual_case(owner, loc["id"], rating=2)
    manager = await add_member(owner, "manager")
    other_org = await signup()
    bad = await owner.patch(f"/recovery/{case['id']}", {"assignee_id": str(uuid.uuid4())})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "assignee_not_member"
    foreign = await owner.patch(f"/recovery/{case['id']}", {"assignee_id": other_org.me["user"]["id"]})
    assert foreign.status_code == 422 and foreign.json()["error"]["code"] == "assignee_not_member"
    ok = await owner.patch(f"/recovery/{case['id']}", {"assignee_id": manager.me["user"]["id"], "status": "in_progress", "severity": "critical"})
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["assignee_name"] == manager.me["user"]["full_name"] and body["status"] == "in_progress" and body["severity"] == "critical"
    due = datetime.fromisoformat(body["due_at"]) - datetime.fromisoformat(body["created_at"])
    assert abs(due - timedelta(hours=4)) < timedelta(seconds=5)  # SLA follows the new severity
    assert await _notifications(manager.me["user"]["id"], "recovery.case_opened") >= 1
    mine = (await manager.get("/recovery", params={"assignee": "me"})).json()
    assert [i["id"] for i in mine["items"]] == [case["id"]]
    assert (await owner.get("/recovery", params={"assignee": "unassigned"})).json()["total"] == 0
    unassigned = await owner.patch(f"/recovery/{case['id']}", {"unassign": True})
    assert unassigned.json()["assignee_id"] is None
    assert (await owner.patch(f"/recovery/{case['id']}", {"status": "resolved"})).status_code == 422  # resolve has its own endpoint
    assignees = (await owner.get("/recovery/assignees")).json()
    assert {a["user_id"] for a in assignees} == {owner.me["user"]["id"], manager.me["user"]["id"]}


async def test_rbac_analyst_can_view_but_not_act():
    owner = await signup()
    loc = await create_location(owner)
    case = await _manual_case(owner, loc["id"])
    analyst = await add_member(owner, "analyst")
    staff = await add_member(owner, "staff")
    assert (await analyst.get("/recovery/summary")).json()["open"] == 1
    assert (await analyst.get("/recovery")).json()["total"] == 1
    detail = (await analyst.get(f"/recovery/{case['id']}")).json()
    assert detail["can_act"] is False
    for who in (analyst, staff):
        assert (await who.patch(f"/recovery/{case['id']}", {"status": "in_progress"})).status_code == 403
        assert (await who.post(f"/recovery/{case['id']}/notes", {"note": "x"})).status_code == 403
        assert (await who.post(f"/recovery/{case['id']}/contact", {"channel": "call"})).status_code == 403
        assert (await who.post(f"/recovery/{case['id']}/resolve", {"resolution": "unreachable"})).status_code == 403
        assert (await who.post("/recovery", {"title": "Manual case"})).status_code == 403
    # Cross-tenant ids are invisible.
    stranger = await signup()
    assert (await stranger.get(f"/recovery/{case['id']}")).status_code == 404


async def test_location_scoped_members_only_see_their_locations():
    owner = await signup()
    loc_a = await create_location(owner, "Bandra")
    loc_b = await create_location(owner, "Andheri")
    case_a = await _manual_case(owner, loc_a["id"])
    case_b = await _manual_case(owner, loc_b["id"])
    manager = await add_member(owner, "manager", location_ids=[loc_a["id"]])
    listed = (await manager.get("/recovery")).json()
    assert [i["id"] for i in listed["items"]] == [case_a["id"]]
    assert (await manager.get("/recovery/summary")).json()["open"] == 1
    assert (await manager.get(f"/recovery/{case_b['id']}")).status_code == 404
    assert (await manager.post(f"/recovery/{case_b['id']}/notes", {"note": "hi"})).status_code == 404
    assert (await manager.post("/recovery", {"title": "Other branch", "location_id": loc_b["id"]})).status_code == 403
    # A location-restricted member can't be assigned a case outside their locations.
    res = await owner.patch(f"/recovery/{case_b['id']}", {"assignee_id": manager.me["user"]["id"]})
    assert res.status_code == 422 and res.json()["error"]["code"] == "assignee_no_location_access"
    assert (await owner.patch(f"/recovery/{case_a['id']}", {"assignee_id": manager.me["user"]["id"]})).status_code == 200
    # Alerts only go to members who can see the location.
    await _drain()
    assert await _notifications(manager.me["user"]["id"], "recovery.sla_breached") == 0


async def test_list_filters_search_and_sort():
    owner = await signup()
    loc = await create_location(owner)
    crit = await _manual_case(owner, loc["id"], 1, "Found a hair in the biryani")
    high = await _manual_case(owner, loc["id"], 2, "Slow service")
    manual = await owner.post("/recovery", {"title": "Phone complaint about billing", "location_id": loc["id"], "severity": "medium"})
    assert manual.status_code == 201 and manual.json()["source"] == "manual"
    items = (await owner.get("/recovery")).json()["items"]
    assert [i["id"] for i in items][:2] == [crit["id"], high["id"]]  # soonest due first
    assert (await owner.get("/recovery", params={"severity": "high"})).json()["items"][0]["id"] == high["id"]
    assert [i["id"] for i in (await owner.get("/recovery", params={"q": "biryani"})).json()["items"]] == [crit["id"]]
    paged = (await owner.get("/recovery", params={"page_size": 2, "page": 2})).json()
    assert paged["total"] == 3 and len(paged["items"]) == 1 and paged["pages"] == 2
    assert (await owner.get("/recovery", params={"status": "nope"})).status_code == 422


async def test_policy_blocks_review_change_requests_and_incentives():
    owner = await signup()
    loc = await create_location(owner)
    case = await _manual_case(owner, loc["id"])
    for text in (
        "Please remove your review and we'll give you a free dessert",
        "Could you update the review once we fix it?",
        "Offered a 20% discount if they change their rating",
        "Can you give us 5 stars next time",
        "Free meal in exchange for editing the post",
    ):
        res = await owner.post(f"/recovery/{case['id']}/notes", {"note": text})
        assert res.status_code == 422 and res.json()["error"]["code"] == "recovery_policy", text
        assert (await owner.post(f"/recovery/{case['id']}/contact", {"channel": "call", "note": text})).status_code == 422
    for fine in ("Customer said she may update her review herself.", "Refunded the dessert as an apology.", "Called to apologise; the 1-star review mentions a long wait."):
        assert (await owner.post(f"/recovery/{case['id']}/notes", {"note": fine})).status_code == 200, fine
    assert not svc.policy_violation(svc.suggested_message(customer_name="Asha Rao", business="Test Bistro", channel="email"))


async def test_seed_demo_cases_idempotent():
    owner = await signup()
    loc = await create_location(owner)
    for rating in (1, 2, 2, 1, 2):
        await create_review(owner.org_id, loc["id"], rating, "Waited too long, food was cold")
    async with SessionLocal() as db:
        from app.models import Organization

        org = await db.get(Organization, uuid.UUID(owner.org_id))
        assert await svc.seed_demo_cases(db, org) == 0  # never for a real organization
        org.is_demo = True
        assert await svc.seed_demo_cases(db, org) == 5
        await db.commit()
        assert await svc.seed_demo_cases(db, org) == 0
    items = (await owner.get("/recovery", params={"status": "all"})).json()["items"]
    assert len(items) == 5 and all(i["is_demo"] for i in items)
    assert all(c.alerted_at is not None for c in await _cases(owner.org_id))  # no alerts for demo cases
    statuses = {i["status"] for i in items}
    assert {"open", "in_progress", "contacted", "resolved"} <= statuses
