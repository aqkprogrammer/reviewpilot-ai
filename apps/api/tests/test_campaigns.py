from __future__ import annotations

from app.services.jobs import drain_inline_tasks
from tests.conftest import create_location, signup

BODY = "Hi {{name}}, thanks for visiting {{business}}! Share honest feedback: {{link}}"


async def _customers(owner):
    consented = (await owner.post("/customers", {"name": "Consented Carla", "email": "carla@example.com", "consent": {"email": True}})).json()
    no_consent = (await owner.post("/customers", {"name": "Silent Sam", "email": "sam@example.com"})).json()
    opted = (await owner.post("/customers", {"name": "Opted Olga", "email": "olga@example.com", "consent": {"email": True}})).json()
    res = await owner.post(f"/customers/{opted['id']}/opt-out")
    assert res.status_code == 200
    return consented, no_consent, opted


async def test_launch_email_campaign_respects_consent():
    owner = await signup()
    loc = await create_location(owner)
    consented, no_consent, opted = await _customers(owner)
    res = await owner.post("/campaigns", {"name": "Post visit", "location_id": loc["id"], "channel": "email", "message_subject": "How was it?", "message_body": BODY, "launch": True})
    assert res.status_code == 201, res.text
    campaign = res.json()
    assert campaign["status"] == "active"
    await drain_inline_tasks()
    reqs = (await owner.get(f"/campaigns/{campaign['id']}/requests")).json()
    by_customer = {r["customer_id"]: r for r in reqs["items"]}
    assert reqs["total"] == 3
    assert by_customer[consented["id"]]["status"] == "delivered"
    assert by_customer[no_consent["id"]]["status"] == "skipped"
    assert by_customer[no_consent["id"]]["failed_reason"] == "no_consent"
    assert by_customer[opted["id"]]["failed_reason"] == "opted_out"
    detail = (await owner.get(f"/campaigns/{campaign['id']}")).json()
    assert detail["status"] == "completed"
    assert detail["stats"]["sent"] == 1 and detail["stats"]["skipped"] == 2
    deliveries = (await owner.get(f"/review-requests/{by_customer[consented['id']]['id']}/deliveries")).json()
    assert deliveries[0]["simulated"] is True  # demo mode never pretends to be a real provider


async def test_pause_resume_duplicate_archive():
    owner = await signup()
    loc = await create_location(owner)
    await _customers(owner)
    c = (await owner.post("/campaigns", {"name": "With reminders", "location_id": loc["id"], "channel": "email", "message_body": BODY, "reminder_enabled": True, "launch": True})).json()
    await drain_inline_tasks()
    assert (await owner.get(f"/campaigns/{c['id']}")).json()["status"] == "active"
    res = await owner.post(f"/campaigns/{c['id']}/pause")
    assert res.status_code == 200 and res.json()["status"] == "paused"
    assert (await owner.post(f"/campaigns/{c['id']}/pause")).status_code == 400
    res = await owner.post(f"/campaigns/{c['id']}/resume")
    assert res.json()["status"] == "active"
    await drain_inline_tasks()
    # Resuming is idempotent per customer — no duplicate requests.
    assert (await owner.get(f"/campaigns/{c['id']}/requests")).json()["total"] == 3
    dup = await owner.post(f"/campaigns/{c['id']}/duplicate")
    assert dup.status_code == 201
    assert dup.json()["status"] == "draft" and dup.json()["name"].endswith("(copy)")
    res = await owner.post(f"/campaigns/{c['id']}/archive")
    assert res.json()["status"] == "archived"
    listed = (await owner.get("/campaigns")).json()
    assert c["id"] not in [x["id"] for x in listed["items"]]


async def test_template_validation():
    owner = await signup()
    no_link = await owner.post("/campaigns/templates", {"name": "Bad", "channel": "whatsapp", "body": "Please review us on Google soon!"})
    assert no_link.status_code == 422
    incentive = await owner.post("/campaigns/templates", {"name": "Bad", "channel": "email", "body": "Get a free gift for your review: {{link}}"})
    assert incentive.status_code == 422
    gating = await owner.post("/campaigns/templates", {"name": "Bad", "channel": "email", "body": "Leave us a 5-star review here {{link}}"})
    assert gating.status_code == 422
    ok = await owner.post("/campaigns/templates", {"name": "Good", "channel": "whatsapp", "body": "Hi {{name}}, how was your visit? {{link}}", "provider_template_name": "review_request_en"})
    assert ok.status_code == 201
    assert ok.json()["provider_status"] == "pending_submission"
    templates = (await owner.get("/campaigns/templates")).json()
    assert any(t["is_system"] for t in templates)


async def test_campaign_body_validation_rejects_incentives():
    owner = await signup()
    loc = await create_location(owner)
    res = await owner.post("/campaigns", {"name": "Bad", "location_id": loc["id"], "channel": "email", "message_body": "Coupon for review! {{link}}"})
    assert res.status_code == 422


async def test_one_off_review_request_requires_consent():
    owner = await signup()
    loc = await create_location(owner)
    consented, no_consent, _ = await _customers(owner)
    bad = await owner.post("/review-requests", {"customer_id": no_consent["id"], "location_id": loc["id"], "channel": "email"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "no_consent"
    ok = await owner.post("/review-requests", {"customer_id": consented["id"], "location_id": loc["id"], "channel": "email"})
    assert ok.status_code == 201
    await drain_inline_tasks()
    summary = (await owner.get("/review-requests/summary")).json()
    assert summary["sent"] == 1


async def test_whatsapp_campaign_requires_entitlement():
    from tests.conftest import set_plan

    owner = await signup()
    loc = await create_location(owner)
    await set_plan(owner.org_id, "starter")
    c = (await owner.post("/campaigns", {"name": "WA", "location_id": loc["id"], "channel": "whatsapp", "message_body": BODY})).json()
    res = await owner.post(f"/campaigns/{c['id']}/launch")
    assert res.status_code == 402


async def test_customer_csv_import_export_and_erasure():
    owner = await signup()
    csv_body = "name,email,phone,tags\nAsha,asha@example.com,9876543210,vip;regular\nBad,not-an-email,,\n"
    files = {"file": ("customers.csv", csv_body, "text/csv")}
    res = await owner.c.post("/api/v1/customers/import", files=files, headers=owner.headers())
    assert res.status_code == 200, res.text
    result = res.json()
    assert result["created"] == 1 and result["skipped"] == 1
    customers = (await owner.get("/customers")).json()
    asha = customers["items"][0]
    assert asha["phone"] == "+919876543210" and asha["consents"] == {}  # consent never inferred
    export = await owner.get("/customers/export")
    assert "asha@example.com" in export.text
    assert (await owner.delete(f"/customers/{asha['id']}")).status_code == 204
    assert (await owner.get(f"/customers/{asha['id']}")).status_code == 404
