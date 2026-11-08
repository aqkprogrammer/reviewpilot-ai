from __future__ import annotations

from tests.conftest import create_location, create_review, signup


async def _setup():
    owner = await signup()
    loc = await create_location(owner)
    ids = {
        "good": await create_review(owner.org_id, loc["id"], 5, "Amazing biryani and friendly staff", days_ago=2),
        "bad": await create_review(owner.org_id, loc["id"], 1, "Waited an hour, food was cold", days_ago=1),
        "mid": await create_review(owner.org_id, loc["id"], 3, None, days_ago=40),
    }
    return owner, loc, ids


async def test_list_filters_and_search():
    owner, loc, ids = await _setup()
    res = (await owner.get("/reviews")).json()
    assert res["total"] == 3 and res["page"] == 1
    neg = (await owner.get("/reviews", params=[("rating", 1), ("rating", 2)])).json()
    assert [r["id"] for r in neg["items"]] == [ids["bad"]]
    q = (await owner.get("/reviews", params={"q": "biryani"})).json()
    assert [r["id"] for r in q["items"]] == [ids["good"]]
    pending = (await owner.get("/reviews", params={"status": "pending", "location_id": loc["id"]})).json()
    assert pending["total"] == 3
    paged = (await owner.get("/reviews", params={"page_size": 2, "page": 2, "sort": "rating_high"})).json()
    assert len(paged["items"]) == 1 and paged["pages"] == 2
    stats = (await owner.get("/reviews/stats")).json()
    assert stats["total"] == 3 and stats["negative_pending"] == 1


async def test_suggest_draft_publish_handle():
    owner, _, ids = await _setup()
    res = await owner.post(f"/reviews/{ids['bad']}/suggest", {"tone": "apologetic", "language": "en"})
    assert res.status_code == 200, res.text
    suggestion = res.json()
    assert suggestion["provider"] == "heuristic"  # no OpenAI key configured in tests
    assert suggestion["reply"]
    # AI output is never published automatically.
    detail = (await owner.get(f"/reviews/{ids['bad']}")).json()
    assert detail["response_status"] == "pending" and detail["replies"] == []

    res = await owner.put(f"/reviews/{ids['bad']}/reply", {"body": suggestion["reply"], "tone": "apologetic", "ai_generation_id": suggestion["generation_id"]})
    assert res.status_code == 200
    assert res.json()["replies"][0]["status"] == "draft"
    assert res.json()["publish_mode"] == "demo"

    res = await owner.post(f"/reviews/{ids['bad']}/reply/publish")
    assert res.status_code == 200
    body = res.json()
    assert body["response_status"] == "responded"
    assert body["replies"][0]["status"] == "published"
    assert body["platform_reply"] == suggestion["reply"]

    res = await owner.post(f"/reviews/{ids['good']}/handled")
    assert res.json()["response_status"] == "handled"
    res = await owner.post(f"/reviews/{ids['good']}/reopen")
    assert res.json()["response_status"] == "pending"


async def test_publish_requires_draft():
    owner, _, ids = await _setup()
    res = await owner.post(f"/reviews/{ids['good']}/reply/publish")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "no_draft"


async def test_hindi_and_hinglish_suggestions():
    owner, _, ids = await _setup()
    for lang in ("hi", "hinglish"):
        res = await owner.post(f"/reviews/{ids['good']}/suggest", {"tone": "friendly", "language": lang})
        assert res.status_code == 200 and res.json()["reply"]
    bad = await owner.post(f"/reviews/{ids['good']}/suggest", {"tone": "sarcastic", "language": "en"})
    assert bad.status_code == 422


async def test_ai_requires_entitlement():
    from tests.conftest import set_plan

    owner, _, ids = await _setup()
    await set_plan(owner.org_id, "starter")
    res = await owner.post(f"/reviews/{ids['good']}/suggest", {"tone": "friendly", "language": "en"})
    assert res.status_code == 402


async def test_analytics_overview_uses_stored_records():
    owner, _, _ = await _setup()
    data = (await owner.get("/analytics/overview", params={"period": "30d"})).json()
    assert data["kpis"]["total_reviews"] == 3
    assert data["kpis"]["new_reviews"] == 2  # the 40-day-old review is outside the window
    assert "conversion_rate" in data["definitions"]
    assert data["is_demo"] is False
    detailed = await owner.get("/analytics/detailed", params={"period": "90d"})
    assert detailed.status_code == 200
    assert sum(r["count"] for r in detailed.json()["ratings"]) == 3
    csv = await owner.get("/analytics/export.csv")
    assert csv.headers["content-type"].startswith("text/csv")
    pdf = await owner.get("/analytics/report.pdf")
    assert pdf.headers["content-type"] == "application/pdf" and pdf.content[:4] == b"%PDF"
