from __future__ import annotations

import uuid

from tests.conftest import add_member, create_location, create_review, set_plan, signup


async def test_analyst_cannot_reply_to_reviews():
    owner = await signup()
    loc = await create_location(owner)
    rid = await create_review(owner.org_id, loc["id"], rating=2, comment="Slow service")
    analyst = await add_member(owner, "analyst")
    assert (await analyst.get("/reviews")).status_code == 200
    res = await analyst.post(f"/reviews/{rid}/suggest", {"tone": "professional", "language": "en"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "permission_denied"
    res = await analyst.put(f"/reviews/{rid}/reply", {"body": "Thanks for the feedback"})
    assert res.status_code == 403


async def test_staff_cannot_manage_campaigns():
    owner = await signup()
    loc = await create_location(owner)
    staff = await add_member(owner, "staff")
    res = await staff.post("/campaigns", {"name": "Nope", "location_id": loc["id"], "channel": "email", "message_body": "Hi {{name}} {{link}}"})
    assert res.status_code == 403
    res = await staff.post("/qr-codes", {"name": "Nope", "location_id": loc["id"]})
    assert res.status_code == 403


async def test_admin_cannot_assign_owner_role():
    owner = await signup()
    admin = await add_member(owner, "admin")
    res = await admin.post("/team/invitations", {"email": f"x-{uuid.uuid4().hex[:6]}@example.com", "role": "owner"})
    assert res.status_code == 403
    staff = await add_member(owner, "staff")
    members = (await admin.get("/team/members")).json()
    staff_member = next(m for m in members if m["email"] == staff.email)
    res = await admin.patch(f"/team/members/{staff_member['id']}", {"role": "owner"})
    assert res.status_code == 403
    res = await admin.patch(f"/team/members/{staff_member['id']}", {"role": "manager"})
    assert res.status_code == 200 and res.json()["role"] == "manager"


async def test_owner_protection():
    owner = await signup()
    admin = await add_member(owner, "admin")
    members = (await owner.get("/team/members")).json()
    me = next(m for m in members if m["is_you"])
    assert (await owner.patch(f"/team/members/{me['id']}", {"role": "admin"})).status_code == 403
    assert (await owner.delete(f"/team/members/{me['id']}")).status_code == 403
    # Admins can't remove the owner either.
    assert (await admin.delete(f"/team/members/{me['id']}")).status_code == 403


async def test_member_from_other_org_forbidden():
    a = await signup(business="Org A")
    b = await signup(business="Org B")
    res = await a.get("/locations", headers={"X-Organization-Id": b.org_id})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "not_a_member"


async def test_missing_org_header():
    a = await signup()
    a.org_id = None
    res = await a.get("/locations")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "organization_required"


async def test_cross_tenant_object_access_returns_404():
    a = await signup(business="Org A")
    b = await signup(business="Org B")
    loc_b = await create_location(b, "B Branch")
    review_b = await create_review(b.org_id, loc_b["id"])
    cust_b = (await b.post("/customers", {"name": "Bob", "email": "bob@example.com"})).json()
    camp_b = (await b.post("/campaigns", {"name": "B campaign", "location_id": loc_b["id"], "channel": "email", "message_body": "Hi {{name}} {{link}}"})).json()
    await create_location(a, "A Branch")
    assert (await a.get(f"/reviews/{review_b}")).status_code == 404
    assert (await a.get(f"/customers/{cust_b['id']}")).status_code == 404
    assert (await a.get(f"/campaigns/{camp_b['id']}")).status_code == 404
    assert (await a.get(f"/locations/{loc_b['id']}")).status_code == 404
    assert (await a.patch(f"/locations/{loc_b['id']}", {"name": "Hijacked"})).status_code == 404
    # Lists never leak the other tenant's rows.
    reviews = (await a.get("/reviews")).json()
    assert reviews["total"] == 0
    names = [l["name"] for l in (await a.get("/locations")).json()]
    assert names == ["A Branch"]


async def test_location_restricted_member():
    owner = await signup()
    l1 = await create_location(owner, "Andheri")
    l2 = await create_location(owner, "Powai")
    await create_review(owner.org_id, l1["id"], rating=5)
    r2 = await create_review(owner.org_id, l2["id"], rating=1, comment="Rude staff")
    manager = await add_member(owner, "manager", location_ids=[l1["id"]])
    locs = (await manager.get("/locations")).json()
    assert [l["id"] for l in locs] == [l1["id"]]
    reviews = (await manager.get("/reviews")).json()
    assert reviews["total"] == 1
    res = await manager.get(f"/reviews/{r2}")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "location_forbidden"


async def test_location_limit_enforced_by_plan():
    owner = await signup()
    await set_plan(owner.org_id, "starter")
    await create_location(owner, "Only one")
    res = await owner.post("/locations", {"name": "Second", "city": "Pune"})
    assert res.status_code == 402
    assert res.json()["error"]["code"] == "plan_limit_exceeded"


async def test_growth_trial_allows_three_locations():
    owner = await signup()
    for i in range(3):
        await create_location(owner, f"Branch {i}")
    res = await owner.post("/locations", {"name": "Fourth"})
    assert res.status_code == 402


async def test_location_validation_rejects_non_google_review_url():
    owner = await signup()
    res = await owner.post("/locations", {"name": "Bad link", "google_review_url": "https://evil.example.com/review"})
    assert res.status_code == 422
    ok = await owner.post("/locations", {"name": "Good link", "google_review_url": "https://g.page/r/CabcDEF/review"})
    assert ok.status_code == 201
    assert ok.json()["effective_review_url"] == "https://g.page/r/CabcDEF/review"


async def test_location_soft_delete_and_update():
    owner = await signup()
    loc = await create_location(owner)
    res = await owner.patch(f"/locations/{loc['id']}", {"phone": "+919800000001"})
    assert res.status_code == 200 and res.json()["phone"] == "+919800000001"
    assert (await owner.delete(f"/locations/{loc['id']}")).status_code == 204
    assert (await owner.get(f"/locations/{loc['id']}")).status_code == 404


async def test_onboarding_progress_persists():
    owner = await signup()
    res = await owner.put("/onboarding", {"step": 3, "data": {"business": {"website": "https://x.example"}}})
    assert res.status_code == 200 and res.json()["step"] == 3
    state = (await owner.get("/onboarding")).json()
    assert state["data"]["business"]["website"] == "https://x.example"
    done = (await owner.post("/onboarding/complete")).json()
    assert done["completed"] is True
    me = (await owner.get("/auth/me")).json()
    assert me["memberships"][0]["organization"]["onboarding_completed"] is True


async def test_suspended_org_blocked():
    from app.core.db import SessionLocal
    from app.models import Organization

    owner = await signup()
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(owner.org_id))
        org.status = "suspended"
        await db.commit()
    res = await owner.get("/locations")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "org_suspended"
