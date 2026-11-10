"""Weekly AI intelligence digest: numbers, deltas, scoping, recipients, delivery and rendering."""

from __future__ import annotations

import colorsys
import re
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from app.core.db import SessionLocal
from app.models import Notification, NotificationPreference, Organization, QRCode, QRScan, Review, ReviewRequest, Subscription
from app.models.enums import OrgStatus, ResponseStatus, SubscriptionStatus
from app.models.growth import RecoveryCase, VisitEvent
from app.providers.email import DEV_OUTBOX
from app.services import digest as svc
from app.worker import tasks_digest
from tests.conftest import add_member, create_location, create_review, signup


def _ago(days: float) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


async def _review(org_id: str, location_id: str, rating: int, comment: str | None, days_ago: float, *, name: str = "Asha K.", topics: list[str] | None = None, responded: bool = False) -> str:
    async with SessionLocal() as db:
        r = Review(
            organization_id=uuid.UUID(org_id), location_id=uuid.UUID(location_id), source="demo", platform="google",
            external_id=f"dg-{uuid.uuid4().hex[:10]}", reviewer_name=name, rating=rating, comment=comment,
            review_created_at=_ago(days_ago), topics=topics or [], history=[],
            response_status=ResponseStatus.RESPONDED if responded else ResponseStatus.PENDING,
        )
        db.add(r)
        await db.commit()
        return str(r.id)


async def _activity(org_id: str, location_id: str) -> None:
    """Recovery cases, requests, visits and QR scans across both windows."""
    oid, lid = uuid.UUID(org_id), uuid.UUID(location_id)
    async with SessionLocal() as db:
        # Recovery: 2 opened this week (1 resolved, 1 breached), 1 opened the week before.
        db.add(RecoveryCase(organization_id=oid, location_id=lid, source="manual", title="Cold food", created_at=_ago(2), resolved_at=_ago(1), status="resolved", due_at=_ago(1.5), first_response_at=_ago(1.8)))
        db.add(RecoveryCase(organization_id=oid, location_id=lid, source="manual", title="Long wait", created_at=_ago(3), status="open", due_at=_ago(2)))
        db.add(RecoveryCase(organization_id=oid, location_id=lid, source="manual", title="Old case", created_at=_ago(10), status="open"))
        # Requests: 3 sent this week (2 Google clicks), 1 the week before.
        for days, clicked in ((1, True), (2, True), (3, False), (9, False)):
            db.add(ReviewRequest(organization_id=oid, location_id=lid, channel="whatsapp", status="sent", tracking_token=uuid.uuid4().hex, sent_at=_ago(days), google_clicked_at=_ago(days - 0.1) if clicked else None))
        # Visits: 4 this week (2 sent, 1 skipped), 2 the week before.
        for days, status in ((1, "sent"), (1.5, "sent"), (2, "skipped"), (3, "received"), (8, "sent"), (9, "sent")):
            db.add(VisitEvent(organization_id=oid, location_id=lid, source="api", external_id=uuid.uuid4().hex, occurred_at=_ago(days), status=status))
        qr = QRCode(organization_id=oid, location_id=lid, name="Table card", code=uuid.uuid4().hex[:10])
        db.add(qr)
        await db.flush()
        for days in (1, 2, 9):
            db.add(QRScan(qr_code_id=qr.id, organization_id=oid, scanned_at=_ago(days)))
        await db.commit()


async def _set_sub_status(org_id: str, status: str) -> None:
    async with SessionLocal() as db:
        sub = await db.scalar(select(Subscription).where(Subscription.organization_id == uuid.UUID(org_id)))
        sub.status = status
        await db.commit()


async def _org(org_id: str) -> Organization:
    async with SessionLocal() as db:
        return await db.get(Organization, uuid.UUID(org_id))


# ------------------------------------------------------------------ numbers


async def test_digest_numbers_match_seeded_data_and_deltas():
    owner = await signup(business="Digest Diner")
    loc = await create_location(owner, "Digest Main")
    oid, lid = owner.org_id, loc["id"]
    # This week: 5★, 4★ (replied), 2★.  Previous week: 5★, 5★ (replied).
    await _review(oid, lid, 5, "Great food and friendly staff, will come again", 1, name="Rahul Sharma")
    await _review(oid, lid, 4, "Lovely ambience and quick service overall", 2, responded=True)
    await _review(oid, lid, 2, "We waited an hour and the staff were rude to us", 3, name="Meera")
    await create_review(oid, lid, rating=5, days_ago=9)
    await _review(oid, lid, 5, "Perfect evening", 10, responded=True)
    # Outside both windows: must not be counted anywhere.
    await create_review(oid, lid, rating=1, comment="Terrible", days_ago=30)
    await _activity(oid, lid)

    res = await owner.get("/digest/preview")
    assert res.status_code == 200, res.text
    d = res.json()
    r = d["reviews"]
    assert (r["new"], r["previous"], r["delta"]) == (3, 2, 1)
    assert r["delta_pct"] == 0.5
    assert r["average_rating"] == round(11 / 3, 2)
    assert r["previous_average_rating"] == 5.0
    assert r["rating_delta"] == round(round(11 / 3, 2) - 5.0, 2)
    assert r["response_rate"] == round(1 / 3, 4) and r["previous_response_rate"] == 0.5
    assert r["response_rate_delta"] == round(round(1 / 3, 4) - 0.5, 4)
    assert r["pending_replies"] == 2
    assert r["backlog"] == 4  # 2 this week + 1 previous week + 1 old, still pending
    mix = {m["rating"]: m["count"] for m in r["rating_mix"]}
    assert mix == {5: 1, 4: 1, 3: 0, 2: 1, 1: 0}

    themes = {t["topic"]: t for t in d["themes"]}
    assert themes["staff"]["mentions"] == 2 and themes["staff"]["negative"] == 1
    assert d["themes_source"] == "keyword"

    praise, complaints = d["highlights"]["praise"], d["highlights"]["complaints"]
    assert len(praise) == 2 and len(complaints) == 1
    assert {p["reviewer"] for p in praise} == {"Rahul S.", "Asha K."}
    assert complaints[0]["reviewer"] == "Meera" and complaints[0]["rating"] == 2
    assert "Sharma" not in res.text  # never full surnames

    assert d["recovery"] == {"opened": 2, "previous_opened": 1, "resolved": 1, "breached": 1, "open_now": 2}
    assert d["requests"]["sent"] == 3 and d["requests"]["previous_sent"] == 1 and d["requests"]["google_clicks"] == 2
    a = d["automation"]
    assert (a["visits"], a["previous_visits"], a["requests_sent"], a["skipped"]) == (4, 2, 2, 1)
    assert d["qr"] == {"scans": 2, "previous_scans": 1}

    assert len(d["actions"]) == 3
    assert d["actions"][0]["title"] == "Reply to 4 reviews awaiting a response"
    nar = d["narrative"]
    assert nar["provider"] == "heuristic" and "heuristic" in nar["label"].lower()
    assert nar["text"].startswith("3 new reviews arrived this week, up from 2")
    assert svc.numbers_grounded(nar["text"], svc._facts(d))
    assert d["is_demo"] is False and d["label"] is None
    assert d["available_weeks"][0]["label"] == "Last 7 days"


async def test_previous_week_selection_and_empty_week():
    owner = await signup(business="Quiet Cafe")
    res = await owner.get("/digest/preview")
    d = res.json()
    assert d["reviews"]["new"] == 0 and d["has_activity"] is False
    assert d["narrative"]["text"].startswith("No new reviews arrived this week")
    assert d["reviews"]["average_rating"] is None and d["reviews"]["rating_delta"] is None

    loc = await create_location(owner, "Quiet Main")
    await _review(owner.org_id, loc["id"], 4, "Nice coffee", 9)
    last = d["available_weeks"][1]["week_end"]
    res = await owner.get("/digest/preview", params={"week_end": last})
    assert res.json()["week"]["week_end"] == last
    # A future week_end is clamped to today.
    future = (datetime.now(UTC) + timedelta(days=30)).date().isoformat()
    assert (await owner.get("/digest/preview", params={"week_end": future})).json()["week"]["is_partial"] is True


def test_numbers_guard_rejects_invented_figures():
    facts = {"reviews": {"new": 8, "previous": 26, "average_rating": 4.5, "response_rate": 0.875}}
    assert svc.numbers_grounded("8 new reviews, down from 26, averaging 4.5★ with 90% replied.", facts) is False
    assert svc.numbers_grounded("8 new reviews, down from 26, averaging 4.5★ with 87.5% replied.", facts)
    assert svc.numbers_grounded("You received 12 new reviews.", facts) is False
    assert svc.short_name("Priya Ramesh Kumar") == "Priya K." and svc.short_name(None) == "A customer"


# ------------------------------------------------------------------ scoping


async def test_location_filter_and_scoped_members():
    owner = await signup(business="Two Branch Co")
    a = await create_location(owner, "Branch A")
    b = await create_location(owner, "Branch B")
    for _ in range(2):
        await _review(owner.org_id, a["id"], 5, "Great service from the staff here", 1)
    await _review(owner.org_id, b["id"], 1, "Dirty tables and slow service today", 2)

    full = (await owner.get("/digest/preview")).json()
    assert full["reviews"]["new"] == 3 and len(full["locations"]) == 2
    only_b = (await owner.get("/digest/preview", params={"location_id": b["id"]})).json()
    assert only_b["reviews"]["new"] == 1 and only_b["scope"]["location_name"] == "Branch B"
    assert [lo["name"] for lo in only_b["locations"]] == ["Branch B"]

    manager = await add_member(owner, "manager", [a["id"]])
    scoped = (await manager.get("/digest/preview")).json()
    assert scoped["reviews"]["new"] == 2 and scoped["scope"]["restricted"] is True
    assert [lo["name"] for lo in scoped["locations"]] == ["Branch A"]
    assert scoped["highlights"]["complaints"] == []
    res = await manager.get("/digest/preview", params={"location_id": b["id"]})
    assert res.status_code == 403 and res.json()["error"]["code"] == "location_forbidden"
    assert (await manager.get("/digest/preview.html", params={"location_id": b["id"]})).status_code == 403

    other = await signup(business="Other Tenant")
    other_loc = await create_location(other, "Elsewhere")
    assert (await owner.get("/digest/preview", params={"location_id": other_loc["id"]})).status_code == 404

    staff = await add_member(owner, "staff")
    assert (await staff.get("/digest/preview")).status_code == 403
    assert (await staff.get("/digest/settings")).status_code == 403


# ------------------------------------------------------------------ recipients + settings


async def test_recipient_selection_defaults_and_opt_out():
    owner = await signup(business="Recipients Inc")
    admin = await add_member(owner, "admin")
    manager = await add_member(owner, "manager")
    analyst = await add_member(owner, "analyst")
    await add_member(owner, "staff")

    async def emails() -> dict[str, bool]:
        async with SessionLocal() as db:
            org = await db.get(Organization, uuid.UUID(owner.org_id))
            return {r.user.email: r.email for r in await svc.recipients(db, org)}

    # Registration creates a row per type; untouched rows follow the role default.
    got = await emails()
    assert got == {owner.email: True, admin.email: True, manager.email: False, analyst.email: False}  # staff lacks analytics.read
    # Missing rows behave the same way.
    async with SessionLocal() as db:
        for api in (owner, analyst):
            await db.execute(delete(NotificationPreference).where(NotificationPreference.user_id == uuid.UUID(api.me["user"]["id"]), NotificationPreference.type == "digest.weekly"))
        await db.commit()
    got = await emails()
    assert got[owner.email] is True and got[analyst.email] is False

    s = (await owner.get("/digest/settings")).json()
    assert s["email_enabled"] is True and s["is_default"] is True and s["org_enabled"] is True and s["can_manage_org"] is True
    assert (await analyst.get("/digest/settings")).json()["email_enabled"] is False

    assert (await owner.put("/digest/settings", {"email_enabled": False})).json()["email_enabled"] is False
    assert (await analyst.put("/digest/settings", {"email_enabled": True})).json()["email_enabled"] is True
    got = await emails()
    assert got[owner.email] is False and got[analyst.email] is True and got[admin.email] is True

    # The org-wide toggle is owner-only.
    res = await admin.put("/digest/settings", {"org_enabled": False})
    assert res.status_code == 403
    assert (await owner.put("/digest/settings", {"org_enabled": False})).json()["org_enabled"] is False
    assert (await _org(owner.org_id)).settings["digest"]["enabled"] is False


# ------------------------------------------------------------------ delivery


async def test_weekly_send_is_idempotent_and_respects_preferences():
    owner = await signup(business="Weekly Send Bistro")
    admin = await add_member(owner, "admin")
    analyst = await add_member(owner, "analyst")
    loc = await create_location(owner, "Send Main")
    await _review(owner.org_id, loc["id"], 5, "Wonderful staff and tasty food", 3)
    await admin.put("/digest/settings", {"email_enabled": False})  # explicit opt-out
    oid = uuid.UUID(owner.org_id)

    DEV_OUTBOX.clear()
    async with SessionLocal() as db:
        first = await svc.send_org_digest(db, oid)
    assert first["emailed"] == 1 and first["notified"] == 3, first
    sent_to = [m["to"] for m in DEV_OUTBOX]
    assert sent_to == [owner.email]
    msg = DEV_OUTBOX[0]
    assert "weekly digest" in msg["subject"] and "/app/digest" in msg["text"]

    before = {m["id"] for m in DEV_OUTBOX}
    async with SessionLocal() as db:
        again = await svc.send_org_digest(db, oid)
    assert again["skipped"] == "already_sent"
    # The full cron run also skips the organization this week.
    await tasks_digest.send_weekly_digests({})
    assert not [m for m in DEV_OUTBOX if m["to"] == owner.email and m["id"] not in before]
    async with SessionLocal() as db:
        n = await db.scalar(select(func.count()).select_from(Notification).where(Notification.organization_id == oid, Notification.type == "digest.weekly"))
        assert n == 3
        org = await db.get(Organization, oid)
        assert org.settings["digest"]["last_sent_week"] == svc.week_key(svc.last_complete_week_end(org))
        assert org.settings["digest"]["last_recipients"] == 1
        analyst_n = await db.scalar(select(Notification).where(Notification.organization_id == oid, Notification.user_id == uuid.UUID(analyst.me["user"]["id"])))
        assert analyst_n.link.startswith("/app/digest?week_end=")


async def test_suspended_expired_and_disabled_orgs_are_skipped():
    suspended = await signup(business="Suspended Shop")
    expired = await signup(business="Expired Shop")
    disabled = await signup(business="Disabled Shop")
    async with SessionLocal() as db:
        (await db.get(Organization, uuid.UUID(suspended.org_id))).status = OrgStatus.SUSPENDED
        await db.commit()
    await _set_sub_status(expired.org_id, SubscriptionStatus.EXPIRED)
    await disabled.put("/digest/settings", {"org_enabled": False})

    await tasks_digest.send_weekly_digests({})
    for api in (suspended, expired, disabled):
        async with SessionLocal() as db:
            assert await svc.send_org_digest(db, uuid.UUID(api.org_id)) == {"skipped": "ineligible"}
            n = await db.scalar(select(func.count()).select_from(Notification).where(Notification.organization_id == uuid.UUID(api.org_id), Notification.type == "digest.weekly"))
            assert n == 0
            assert "last_sent_week" not in ((await db.get(Organization, uuid.UUID(api.org_id))).settings or {}).get("digest", {})

    # Past-due subscriptions stay entitled.
    past_due = await signup(business="Past Due Shop")
    await _set_sub_status(past_due.org_id, SubscriptionStatus.PAST_DUE)
    async with SessionLocal() as db:
        assert "emailed" in await svc.send_org_digest(db, uuid.UUID(past_due.org_id))


async def test_send_test_goes_only_to_requester_and_is_rate_limited():
    owner = await signup(business="Test Send Studio")
    admin = await add_member(owner, "admin")
    DEV_OUTBOX.clear()
    res = await admin.post("/digest/send-test")
    assert res.status_code == 200, res.text
    assert res.json()["sent_to"] == admin.email
    assert [m["to"] for m in DEV_OUTBOX] == [admin.email]
    assert DEV_OUTBOX[0]["subject"].startswith("[Test]")
    # A test send never marks the week as delivered.
    assert "last_sent_week" not in ((await _org(owner.org_id)).settings or {}).get("digest", {})
    for _ in range(2):
        assert (await admin.post("/digest/send-test")).status_code == 200
    assert (await admin.post("/digest/send-test")).status_code == 429
    assert all(m["to"] == admin.email for m in DEV_OUTBOX)
    assert (await admin.get("/digest/settings")).json()["is_default"] is True  # a test send changes no preference


# ------------------------------------------------------------------ rendering


def _purple(hex_code: str) -> bool:
    h = hex_code.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    return 250 <= hue * 360 <= 330 and sat > 0.15 and 0.1 < light < 0.95


async def test_email_html_renders_without_purple_and_labels_demo():
    owner = await signup(business="Render Rooms")
    loc = await create_location(owner, "Render Main")
    await _review(owner.org_id, loc["id"], 5, "Friendly staff and spotless rooms", 1, name="Kabir Singh")
    await _review(owner.org_id, loc["id"], 2, "Slow check-in and a dirty bathroom", 2)
    async with SessionLocal() as db:
        (await db.get(Organization, uuid.UUID(owner.org_id))).is_demo = True
        await db.commit()

    res = await owner.get("/digest/preview.html")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/html")
    assert "frame-ancestors 'self'" in res.headers["content-security-policy"]
    html = res.text
    assert "Weekly intelligence" in html and "Render Rooms" in html and "Demo data" in html
    assert "Kabir S." in html and "Singh" not in html
    assert "background:#0e9aa7;height:8px" in html  # rating-mix bar cells
    assert "<script" not in html.lower()
    colors = re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", html)
    assert colors and not [c for c in colors if _purple(c)]
    assert not re.search(r"purple|violet|lavender", html, re.I)

    d = (await owner.get("/digest/preview")).json()
    assert d["is_demo"] is True and d["label"] == "Demo data"
    subject, _, text, _ = await _render(owner.org_id, d)
    assert subject.endswith("(demo data)") and "DEMO DATA" in text and "Kabir S." in text


async def _render(org_id: str, d: dict):
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(org_id))
        return await svc.render_email(db, org, d)


def test_cron_is_registered_for_monday_0330_utc():
    from app.worker.settings import TASKS, WorkerSettings

    assert "send_weekly_digests" in TASKS
    assert ("send_weekly_digests", {"weekday": {0}, "hour": {3}, "minute": {30}}) in tasks_digest.CRONS
    assert any(c.name == "cron_send_weekly_digests" for c in WorkerSettings.cron_jobs)
