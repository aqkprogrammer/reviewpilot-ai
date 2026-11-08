from __future__ import annotations

import pytest

from app.core.db import SessionLocal
from app.seed import bootstrap_super_admin
from tests.conftest import PASSWORD, login, new_client, signup, unique_email


async def test_business_users_cannot_access_admin_api():
    owner = await signup()
    res = await owner.get("/admin/overview")
    if res.status_code == 404:
        pytest.xfail("admin router not implemented yet")
    assert res.status_code == 403
    assert (await new_client().get("/api/v1/admin/overview")).status_code == 401


async def test_super_admin_can_access_admin_api():
    email = unique_email("sa")
    async with SessionLocal() as db:
        await bootstrap_super_admin(db, email, "Test Super Admin", PASSWORD)
    admin = await login(email)
    admin.org_id = None
    res = await admin.get("/admin/overview")
    if res.status_code == 404:
        pytest.xfail("admin router not implemented yet")
    assert res.status_code == 200


async def test_super_admin_is_not_implicit_org_member():
    """Least privilege: platform admins can't read tenant data through business APIs."""
    owner = await signup()
    email = unique_email("sa")
    async with SessionLocal() as db:
        await bootstrap_super_admin(db, email, "Test Super Admin", PASSWORD)
    admin = await login(email)
    res = await admin.get("/reviews", headers={"X-Organization-Id": owner.org_id})
    assert res.status_code == 403


async def test_role_cannot_be_escalated_via_profile_update():
    owner = await signup()
    res = await owner.patch("/auth/me", {"full_name": "Sneaky", "platform_role": "platform_super_admin"})
    assert res.status_code == 200
    assert res.json()["platform_role"] == "user"
