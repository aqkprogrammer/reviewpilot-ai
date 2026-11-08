from __future__ import annotations

from tests.conftest import create_location, new_client, signup

FEEDBACK = {"message": "Lovely place but the wait was long", "privacy_accepted": True, "elapsed_ms": 6000, "language": "en"}


async def test_qr_create_download_and_scan():
    owner = await signup()
    loc = await create_location(owner, google_review_url="https://g.page/r/Cxyz/review")
    res = await owner.post("/qr-codes", {"name": "Table card", "location_id": loc["id"], "foreground": "#1b1530", "background": "#ffffff", "template": "bold"})
    assert res.status_code == 201, res.text
    qr = res.json()
    assert qr["scan_url"].endswith(f"/q/{qr['code']}")
    for fmt, ctype, magic in (("png", "image/png", b"\x89PNG"), ("svg", "image/svg+xml", b"<svg"), ("pdf", "application/pdf", b"%PDF")):
        r = await owner.get(f"/qr-codes/{qr['id']}/download", params={"format": fmt})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith(ctype)
        assert magic in r.content[:200]
        assert "attachment" in r.headers["content-disposition"]
    scan = await new_client().get(f"/api/v1/qr-codes/scan/{qr['code']}", headers={"User-Agent": "Mozilla/5.0 (iPhone)"})
    assert scan.status_code == 302
    assert scan.headers["location"] == f"http://localhost:3000/r/{loc['slug']}?qr={qr['code']}"
    after = (await owner.get(f"/qr-codes/{qr['id']}")).json()
    assert after["scan_count"] == 1
    series = (await owner.get(f"/qr-codes/{qr['id']}/scans")).json()
    assert series["devices"] == {"ios": 1}


async def test_qr_rejects_low_contrast():
    owner = await signup()
    loc = await create_location(owner)
    res = await owner.post("/qr-codes", {"name": "Bad", "location_id": loc["id"], "foreground": "#eeeeee", "background": "#ffffff"})
    assert res.status_code == 422


async def test_unknown_qr_redirects_home():
    res = await new_client().get("/api/v1/qr-codes/scan/doesnotexist")
    assert res.status_code == 302 and res.headers["location"] == "http://localhost:3000/"


async def test_public_feedback_without_login():
    owner = await signup()
    loc = await create_location(owner, google_review_url="https://g.page/r/Cxyz/review")
    anon = new_client()
    page = await anon.get(f"/api/v1/public/locations/{loc['slug']}")
    assert page.status_code == 200
    data = page.json()
    assert data["has_google_link"] is True and "hi" in data["languages"]
    res = await anon.post(f"/api/v1/public/locations/{loc['slug']}/feedback", json={**FEEDBACK, "rating": 4, "name": "Riya", "email": "riya@example.com", "consent_contact": True})
    assert res.status_code == 201
    inbox = (await owner.get("/feedback")).json()
    assert inbox["total"] == 1 and inbox["items"][0]["consent_contact"] is True
    customers = (await owner.get("/customers")).json()
    assert customers["items"][0]["consents"].get("email") is True


async def test_feedback_requires_privacy_acceptance():
    owner = await signup()
    loc = await create_location(owner)
    res = await new_client().post(f"/api/v1/public/locations/{loc['slug']}/feedback", json={**FEEDBACK, "privacy_accepted": False})
    assert res.status_code == 422


async def test_honeypot_and_too_fast_submissions_are_dropped():
    owner = await signup()
    loc = await create_location(owner)
    anon = new_client()
    r1 = await anon.post(f"/api/v1/public/locations/{loc['slug']}/feedback", json={**FEEDBACK, "website": "http://spam.example"})
    r2 = await anon.post(f"/api/v1/public/locations/{loc['slug']}/feedback", json={**FEEDBACK, "elapsed_ms": 300})
    assert r1.status_code == 201 and r2.status_code == 201  # bots get no signal
    assert (await owner.get("/feedback")).json()["total"] == 0


async def test_google_link_offered_regardless_of_rating():
    """No review gating: the Google option doesn't depend on the rating or on private feedback."""
    owner = await signup()
    loc = await create_location(owner, google_review_url="https://g.page/r/Cxyz/review")
    anon = new_client()
    url = f"/api/v1/public/locations/{loc['slug']}/google-click"
    no_rating = await anon.post(url, json={})
    assert no_rating.status_code == 200 and no_rating.json()["url"] == "https://g.page/r/Cxyz/review"
    await anon.post(f"/api/v1/public/locations/{loc['slug']}/feedback", json={**FEEDBACK, "rating": 1, "message": "Terrible, never again"})
    after_bad = await anon.post(url, json={})
    assert after_bad.status_code == 200 and after_bad.json()["url"] == no_rating.json()["url"]
    page = (await anon.get(f"/api/v1/public/locations/{loc['slug']}")).json()
    assert page["has_google_link"] is True


async def test_tracking_link_records_clicks_and_unsubscribe():
    from app.services.jobs import drain_inline_tasks

    owner = await signup()
    loc = await create_location(owner, google_review_url="https://g.page/r/Cxyz/review")
    cust = (await owner.post("/customers", {"name": "Track Tara", "email": "tara@example.com", "consent": {"email": True}})).json()
    await owner.post("/review-requests", {"customer_id": cust["id"], "location_id": loc["id"], "channel": "email"})
    await drain_inline_tasks()
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import ReviewRequest

    async with SessionLocal() as db:
        token = (await db.scalars(select(ReviewRequest.tracking_token).where(ReviewRequest.location_id == __import__("uuid").UUID(loc["id"])))).first()
    anon = new_client()
    await anon.get(f"/api/v1/public/locations/{loc['slug']}", params={"t": token})
    await anon.post(f"/api/v1/public/locations/{loc['slug']}/google-click", json={"t": token})
    reqs = (await owner.get("/review-requests")).json()["items"]
    assert reqs[0]["clicked_at"] and reqs[0]["google_clicked_at"]
    assert (await anon.post("/api/v1/public/unsubscribe", json={"t": token})).status_code == 200
    detail = (await owner.get(f"/customers/{cust['id']}")).json()
    assert detail["opted_out_at"] is not None


async def test_unknown_public_location_404():
    res = await new_client().get("/api/v1/public/locations/no-such-place")
    assert res.status_code == 404


async def test_contact_form():
    res = await new_client().post("/api/v1/public/contact", json={"name": "Lead", "email": "lead@example.com", "company": "Acme", "message": "Interested in Enterprise pricing"})
    assert res.status_code == 201
