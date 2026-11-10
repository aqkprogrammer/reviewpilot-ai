"""Retention purge, account deletion, exports, auto-publish, white-label, scheduled downgrades, GST billing."""

from __future__ import annotations

import io
import uuid
import zipfile
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import Customer, Invoice, Organization, Payment, Review, Subscription, User
from app.seed import bootstrap_super_admin
from app.services import auto_reply, white_label
from app.services.billing import run_maintenance
from app.services.retention import purge_deleted_organizations
from tests.conftest import PASSWORD, add_member, create_location, create_review, get_subscription, login, new_client, set_plan, signup, unique_email


async def _activate(owner, plan_code: str) -> None:
    co = (await owner.post("/subscriptions/checkout", {"plan_code": plan_code, "interval": "monthly"})).json()
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "success"})
    assert res.json()["result"] == "payment_recorded", res.text


async def _super_admin():
    email = unique_email("root")
    async with SessionLocal() as db:
        await bootstrap_super_admin(db, email, "Root", PASSWORD)
    admin = await login(email)
    admin.org_id = None
    return admin


async def _age_deletion(org_id: str, days: int) -> None:
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(org_id))
        org.deleted_at = datetime.now(UTC) - timedelta(days=days)
        await db.commit()


# ------------------------------------------------------------------ retention

async def test_purge_erases_operational_data_but_keeps_financial_records():
    owner = await signup()
    loc = await create_location(owner)
    await create_review(owner.org_id, loc["id"])
    await owner.post("/customers", {"name": "Ravi", "email": "ravi@example.com"})
    await _activate(owner, "growth")
    assert (await owner.delete("/organizations/current")).status_code == 204
    await _age_deletion(owner.org_id, 31)
    async with SessionLocal() as db:
        result = await purge_deleted_organizations(db)
    assert result["purged"] >= 1
    oid = uuid.UUID(owner.org_id)
    async with SessionLocal() as db:
        org = await db.get(Organization, oid)
        assert org.name == "Deleted organization" and org.email is None and org.settings.get("purged_at")
        assert await db.scalar(select(func.count()).select_from(Review).where(Review.organization_id == oid)) == 0
        assert await db.scalar(select(func.count()).select_from(Customer).where(Customer.organization_id == oid)) == 0
        assert await db.scalar(select(func.count()).select_from(Payment).where(Payment.organization_id == oid)) >= 1
        assert await db.scalar(select(func.count()).select_from(Invoice).where(Invoice.organization_id == oid)) >= 1


async def test_grace_window_and_admin_restore():
    owner = await signup()
    await owner.delete("/organizations/current")
    await _age_deletion(owner.org_id, 5)
    async with SessionLocal() as db:
        await purge_deleted_organizations(db)
    async with SessionLocal() as db:
        assert not (await db.get(Organization, uuid.UUID(owner.org_id))).settings.get("purged_at")
    admin = await _super_admin()
    pending = (await admin.get("/admin/organizations-pending-deletion")).json()
    assert any(p["id"] == owner.org_id and not p["purged"] for p in pending)
    res = await admin.post(f"/admin/organizations/{owner.org_id}/restore", {"reason": "Owner asked support to restore"})
    assert res.status_code == 200, res.text
    assert (await owner.get("/organizations/current")).status_code == 200


async def test_restore_after_purge_is_refused():
    owner = await signup()
    await owner.delete("/organizations/current")
    await _age_deletion(owner.org_id, 40)
    async with SessionLocal() as db:
        await purge_deleted_organizations(db)
    admin = await _super_admin()
    res = await admin.post(f"/admin/organizations/{owner.org_id}/restore", {"reason": "Too late to restore this"})
    assert res.status_code == 409


# ------------------------------------------------------------------ account deletion + exports

async def test_account_deletion_blocked_while_sole_owner_of_shared_org():
    owner = await signup()
    await add_member(owner, "staff")
    check = (await owner.get("/auth/me/deletion-check")).json()
    assert check["blocked_by"]
    res = await owner.c.request("DELETE", "/api/v1/auth/me", json={"confirm": "DELETE", "password": PASSWORD}, headers=owner.headers())
    assert res.status_code == 409 and res.json()["error"]["code"] == "ownership_transfer_required"


async def test_account_deletion_anonymises_and_schedules_solo_org():
    owner = await signup()
    bad = await owner.c.request("DELETE", "/api/v1/auth/me", json={"confirm": "DELETE", "password": "wrong-pass1"}, headers=owner.headers())
    assert bad.status_code == 400
    unconfirmed = await owner.c.request("DELETE", "/api/v1/auth/me", json={"confirm": "yes", "password": PASSWORD}, headers=owner.headers())
    assert unconfirmed.status_code == 400
    res = await owner.c.request("DELETE", "/api/v1/auth/me", json={"confirm": "DELETE", "password": PASSWORD}, headers=owner.headers())
    assert res.status_code == 200, res.text
    relogin = await new_client().post("/api/v1/auth/login", json={"email": owner.email, "password": PASSWORD})
    assert relogin.status_code == 401
    async with SessionLocal() as db:
        assert await db.scalar(select(User).where(User.email == owner.email)) is None
        assert (await db.get(Organization, uuid.UUID(owner.org_id))).deleted_at is not None


async def test_personal_and_organization_exports():
    owner = await signup()
    loc = await create_location(owner)
    await create_review(owner.org_id, loc["id"])
    personal = await owner.get("/auth/me/export")
    assert personal.status_code == 200 and personal.json()["profile"]["email"] == owner.email
    assert "password_hash" not in personal.json()["profile"]
    org = await owner.get("/organizations/current/export")
    assert org.status_code == 200 and org.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(org.content))
    assert {"manifest.json", "reviews.csv", "customers.csv", "invoices.csv"} <= set(z.namelist())
    assert z.read("reviews.csv").decode("utf-8-sig").count("\n") >= 2
    admin_member = await add_member(owner, "admin")
    assert (await admin_member.get("/organizations/current/export")).status_code == 403


# ------------------------------------------------------------------ auto-publish

async def test_auto_publish_requires_owner_and_respects_guard_rails():
    owner = await signup()
    admin_member = await add_member(owner, "admin")
    assert (await admin_member.patch("/organizations/current", {"auto_publish_min_rating": 3})).status_code == 403
    res = await owner.patch("/organizations/current", {"auto_publish_replies": True, "auto_publish_min_rating": 5})
    assert res.status_code == 200 and res.json()["auto_publish_min_rating"] == 5
    assert (await owner.patch("/organizations/current", {"auto_publish_min_rating": 2})).status_code == 422
    loc = await create_location(owner)
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(owner.org_id))
        base = dict(organization_id=org.id, location_id=uuid.UUID(loc["id"]), platform="google", reviewer_name="A", topics=[], history=[], response_status="pending")
        fresh5 = Review(source="google", external_id="g1", rating=5, review_created_at=datetime.now(UTC), **base)
        fresh4 = Review(source="google", external_id="g2", rating=4, review_created_at=datetime.now(UTC), **base)
        old5 = Review(source="google", external_id="g3", rating=5, review_created_at=datetime.now(UTC) - timedelta(days=30), **base)
        demo5 = Review(source="demo", external_id="d1", rating=5, review_created_at=datetime.now(UTC), **base)
        assert auto_reply.eligible(org, fresh5) == (True, "ok")
        assert auto_reply.eligible(org, fresh4)[1] == "below_threshold"
        assert auto_reply.eligible(org, old5)[1] == "too_old"
        assert auto_reply.eligible(org, demo5)[1] == "not_google"
        org.auto_publish_replies = False
        assert auto_reply.eligible(org, fresh5)[1] == "disabled"


# ------------------------------------------------------------------ white-label

async def test_white_label_is_agency_only_and_reverts_on_downgrade():
    owner = await signup()
    payload = {"hide_attribution": True, "sender_name": "Glow Group", "footer_text": "© Glow Group"}
    assert (await owner.put("/organizations/current/white-label", payload)).status_code == 402
    await set_plan(owner.org_id, "agency")
    res = await owner.put("/organizations/current/white-label", payload)
    assert res.status_code == 200 and res.json()["hide_attribution"] is True
    loc = await create_location(owner)
    pub = (await new_client().get(f"/api/v1/public/locations/{loc['slug']}")).json()
    assert pub["show_attribution"] is False and pub["footer_text"] == "© Glow Group"
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(owner.org_id))
        eff = await white_label.effective(db, org)
        assert white_label.sender_for(org, eff).startswith("Glow Group <")
    await set_plan(owner.org_id, "starter")
    pub = (await new_client().get(f"/api/v1/public/locations/{loc['slug']}")).json()
    assert pub["show_attribution"] is True and pub["footer_text"] is None
    async with SessionLocal() as db:
        org = await db.get(Organization, uuid.UUID(owner.org_id))
        assert " via ReviewPilot <" in white_label.sender_for(org, await white_label.effective(db, org))


# ------------------------------------------------------------------ scheduled downgrades

async def test_downgrade_is_scheduled_and_applied_at_period_end():
    owner = await signup()
    await _activate(owner, "agency")
    assert (await owner.post("/subscriptions/schedule-change", {"plan_code": "agency"})).json()["error"]["code"] == "same_plan"
    res = await owner.post("/subscriptions/schedule-change", {"plan_code": "growth"})
    assert res.status_code == 200, res.text
    cur = res.json()
    assert cur["plan"]["code"] == "agency" and cur["subscription"]["scheduled_change"]["plan"]["code"] == "growth"
    async with SessionLocal() as db:
        sub = await db.scalar(select(Subscription).where(Subscription.organization_id == uuid.UUID(owner.org_id)))
        sub.current_period_end = datetime.now(UTC) - timedelta(minutes=1)
        await db.commit()
    async with SessionLocal() as db:
        out = await run_maintenance(db)
    assert out["mock_changes_applied"] >= 1
    cur = (await owner.get("/subscriptions/current")).json()
    assert cur["plan"]["code"] == "growth" and cur["subscription"]["scheduled_change"] is None
    assert cur["subscription"]["status"] == "active"


async def test_downgrade_rules():
    owner = await signup()
    await _activate(owner, "growth")
    assert (await owner.post("/subscriptions/schedule-change", {"plan_code": "agency"})).json()["error"]["code"] == "use_checkout"
    await create_location(owner, "One")
    await create_location(owner, "Two")
    res = await owner.post("/subscriptions/schedule-change", {"plan_code": "starter"})
    assert res.status_code == 400 and res.json()["error"]["code"] == "downgrade_blocked"
    trial = await signup()
    assert (await trial.post("/subscriptions/schedule-change", {"plan_code": "starter"})).json()["error"]["code"] == "no_active_subscription"


async def test_cancel_scheduled_change_and_abandoned_checkout_is_not_applied():
    owner = await signup()
    await _activate(owner, "agency")
    await owner.post("/subscriptions/schedule-change", {"plan_code": "growth"})
    res = await owner.delete("/subscriptions/schedule-change")
    assert res.status_code == 200 and res.json()["subscription"]["scheduled_change"] is None
    # An abandoned upgrade checkout must never look like (or be applied as) a scheduled change.
    await owner.post("/subscriptions/checkout", {"plan_code": "enterprise", "interval": "monthly"})
    sub = await get_subscription(owner.org_id)
    assert sub.pending_plan_id is None


# ------------------------------------------------------------------ GST billing

async def test_gstin_validation_and_state_derivation():
    owner = await signup()
    bad = await owner.put("/subscriptions/billing-details", {"legal_name": "Bistro Pvt Ltd", "gstin": "27AAPFU0939F1ZX"})
    assert bad.status_code == 422
    mismatch = await owner.put("/subscriptions/billing-details", {"legal_name": "Bistro Pvt Ltd", "gstin": "27AAPFU0939F1ZV", "state_code": "29"})
    assert mismatch.status_code == 400
    ok = await owner.put("/subscriptions/billing-details", {"legal_name": "Bistro Pvt Ltd", "gstin": "27aapfu0939f1zv", "city": "Mumbai"})
    assert ok.status_code == 200 and ok.json()["details"]["state_code"] == "27" and ok.json()["details"]["gstin"] == "27AAPFU0939F1ZV"


async def test_invoices_split_gst_by_state(monkeypatch):
    monkeypatch.setattr(settings, "company_state_code", "27")
    monkeypatch.setattr(settings, "company_gstin", "27AAPFU0939F1ZV")
    same = await signup()
    await same.put("/subscriptions/billing-details", {"legal_name": "Same State Co", "gstin": "27AAPFU0939F1ZV"})
    await _activate(same, "growth")
    other = await signup()
    await other.put("/subscriptions/billing-details", {"legal_name": "Other State Co", "gstin": "29AAGCB7383J1Z4"})
    await _activate(other, "growth")
    async with SessionLocal() as db:
        inv_same = await db.scalar(select(Invoice).where(Invoice.organization_id == uuid.UUID(same.org_id)))
        inv_other = await db.scalar(select(Invoice).where(Invoice.organization_id == uuid.UUID(other.org_id)))
    names_same = [t["name"] for t in inv_same.line_items[0]["taxes"]]
    names_other = [t["name"] for t in inv_other.line_items[0]["taxes"]]
    assert names_same == ["CGST 9%", "SGST 9%"] and names_other == ["IGST 18%"]
    assert sum(t["amount_minor"] for t in inv_same.line_items[0]["taxes"]) == inv_same.tax_minor
    assert inv_same.billing_details["gstin"] == "27AAPFU0939F1ZV" and inv_other.billing_details["place_of_supply"] == "Karnataka"
    payments = (await same.get("/subscriptions/payments")).json()
    pdf = await same.get(f"/subscriptions/invoices/{payments[0]['invoice_id']}.pdf")
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
