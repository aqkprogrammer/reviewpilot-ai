"""Super Admin API: access control, least privilege, audited mutations."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import now
from app.models import AuditLog, SupportTicket, User
from app.models.enums import PlatformRole
from tests.conftest import PASSWORD, create_location, create_review, login, signup, unique_email


async def make_super_admin() -> object:
    owner = await signup(unique_email("sa"))
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == owner.email))
        user.platform_role = PlatformRole.SUPER_ADMIN
        await db.commit()
    return await login(owner.email, PASSWORD)


async def test_business_user_cannot_access_admin_api():
    owner = await signup()
    for path in ("/admin/overview", "/admin/organizations", "/admin/users", "/admin/audit-logs", "/admin/system-health"):
        res = await owner.get(path)
        assert res.status_code == 403, path
        assert res.json()["error"]["code"] == "super_admin_required"


async def test_unauthenticated_admin_request_rejected():
    from tests.conftest import Api, new_client

    anon = Api(new_client())
    assert (await anon.get("/admin/overview")).status_code == 401


async def test_super_admin_overview_and_lists():
    admin = await make_super_admin()
    admin.org_id = None
    res = await admin.get("/admin/overview")
    assert res.status_code == 200
    body = res.json()
    assert {"users", "organizations", "mrr_minor", "arr_minor"} <= set(body["totals"])
    assert body["totals"]["arr_minor"] == body["totals"]["mrr_minor"] * 12
    for path in ("/admin/organizations", "/admin/users", "/admin/subscriptions", "/admin/payments", "/admin/plans", "/admin/revenue",
                 "/admin/integrations", "/admin/ai-usage", "/admin/campaigns", "/admin/support/tickets", "/admin/announcements",
                 "/admin/audit-logs", "/admin/feature-flags", "/admin/settings"):
        assert (await admin.get(path)).status_code == 200, path


async def test_user_list_never_exposes_secrets():
    admin = await make_super_admin()
    admin.org_id = None
    text = (await admin.get("/admin/users?page_size=100")).text
    assert "password_hash" not in text and "$argon2" not in text and "token_hash" not in text


async def test_org_detail_hides_customer_content():
    owner = await signup()
    loc = await create_location(owner)
    await create_review(owner.org_id, loc["id"], comment="Secret review text that admins should not see")
    admin = await make_super_admin()
    admin.org_id = None
    res = await admin.get(f"/admin/organizations/{owner.org_id}")
    assert res.status_code == 200
    assert "Secret review text" not in res.text
    assert res.json()["usage"]["reviews"] == 1


async def test_suspend_requires_reason_and_is_audited():
    owner = await signup()
    admin = await make_super_admin()
    admin.org_id = None
    assert (await admin.post(f"/admin/organizations/{owner.org_id}/suspend", json={})).status_code == 422
    res = await admin.post(f"/admin/organizations/{owner.org_id}/suspend", json={"reason": "fraud review"})
    assert res.status_code == 200
    assert (await owner.get("/locations")).json()["error"]["code"] == "org_suspended"
    async with SessionLocal() as db:
        entry = await db.scalar(select(AuditLog).where(AuditLog.action == "admin.organization_suspended", AuditLog.organization_id == uuid.UUID(owner.org_id)))
        assert entry is not None and entry.meta["reason"] == "fraud review"
    assert (await admin.post(f"/admin/organizations/{owner.org_id}/reactivate", json={"reason": "cleared"})).status_code == 200
    assert (await owner.get("/locations")).status_code == 200


async def test_disable_user_revokes_sessions_and_blocks_self_disable():
    victim = await signup()
    admin = await make_super_admin()
    admin.org_id = None
    me = (await admin.get("/auth/me")).json()["user"]
    assert (await admin.post(f"/admin/users/{me['id']}/disable", json={"reason": "self test"})).status_code == 403
    victim_id = (await victim.get("/auth/me")).json()["user"]["id"]
    assert (await admin.post(f"/admin/users/{victim_id}/disable", json={"reason": "abuse"})).status_code == 200
    assert (await victim.get("/auth/me")).status_code in (401, 403)
    assert (await admin.post(f"/admin/users/{victim_id}/reactivate", json={"reason": "appeal"})).status_code == 200


async def test_subscription_override_is_limited():
    owner = await signup()
    admin = await make_super_admin()
    admin.org_id = None
    subs = (await admin.get("/admin/subscriptions?q=Test")).json()["items"]
    sub = next(s for s in subs if s["organization_id"] == owner.org_id)
    res = await admin.post(f"/admin/subscriptions/{sub['id']}/action", json={"action": "extend_trial", "days": 7, "reason": "sales"})
    assert res.status_code == 200 and res.json()["status"] == "trialing"
    # No action can mark a payment as paid.
    bad = await admin.post(f"/admin/subscriptions/{sub['id']}/action", json={"action": "mark_paid", "reason": "nope"})
    assert bad.status_code == 422


async def test_org_snapshot_requires_customer_grant():
    owner = await signup()
    res = await owner.post("/support/tickets", json={"subject": "Help please", "message": "Our sync is failing badly", "organization_id": owner.org_id})
    ticket_id = res.json()["id"]
    admin = await make_super_admin()
    admin.org_id = None
    denied = await admin.get(f"/admin/support/tickets/{ticket_id}/org-snapshot")
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "data_access_not_granted"
    async with SessionLocal() as db:
        t = await db.get(SupportTicket, uuid.UUID(ticket_id))
        t.data_access_granted_until = now() + timedelta(days=1)
        await db.commit()
    assert (await admin.get(f"/admin/support/tickets/{ticket_id}/org-snapshot")).status_code == 200
    async with SessionLocal() as db:
        actions = (await db.scalars(select(AuditLog.action).where(AuditLog.target_id == ticket_id))).all()
    assert "admin.org_snapshot_denied" in actions and "admin.org_snapshot_accessed" in actions


async def test_settings_reject_secret_keys_and_audit_plan_edits():
    admin = await make_super_admin()
    admin.org_id = None
    assert (await admin.put("/admin/settings/stripe_secret_key", json={"value": {"v": "x"}})).status_code == 400
    plan = (await admin.get("/admin/plans")).json()[0]
    res = await admin.patch(f"/admin/plans/{plan['id']}", json={"max_team_members": plan["max_team_members"] + 1})
    assert res.status_code == 200
    async with SessionLocal() as db:
        assert await db.scalar(select(AuditLog).where(AuditLog.action == "admin.plan_updated", AuditLog.target_id == plan["id"]))
    await admin.patch(f"/admin/plans/{plan['id']}", json={"max_team_members": plan["max_team_members"]})
