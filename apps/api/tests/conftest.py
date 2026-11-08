"""Test harness.

Environment is configured BEFORE any `app` import because `app.core.config.settings`
and the SQLAlchemy engine are created at import time. Tests run against the
`reviewpilot_test` database, which is dropped and rebuilt with Alembic once per session.
Redis points at an unused port so background jobs run inline (development fallback).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://reviewpilot:reviewpilot@localhost:5432/reviewpilot_test")
os.environ.update(
    {
        "DATABASE_URL": TEST_DB,
        "ENVIRONMENT": "test",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-0123456789",
        "JWT_SECRET": "test-jwt-secret-that-is-long-enough-0123456789",
        "DEMO_MODE": "true",
        "REDIS_URL": "redis://127.0.0.1:6399/0",
        "INLINE_JOBS_FALLBACK": "true",
        "OAUTH_MOCK_ENABLED": "false",
        "FRONTEND_URL": "http://localhost:3000",
        "BACKEND_URL": "http://localhost:8000",
        "OPENAI_API_KEY": "",
        "RESEND_API_KEY": "",
        "GOOGLE_CLIENT_ID": "",
        "GOOGLE_CLIENT_SECRET": "",
        "STRIPE_SECRET_KEY": "",
        "STRIPE_WEBHOOK_SECRET": "",
        "RAZORPAY_KEY_ID": "",
        "RAZORPAY_KEY_SECRET": "",
        "RAZORPAY_WEBHOOK_SECRET": "",
        "WHATSAPP_ACCESS_TOKEN": "",
        "WHATSAPP_PHONE_NUMBER_ID": "",
        "AWS_ACCESS_KEY_ID": "",
        "LOCAL_STORAGE_DIR": "/tmp/reviewpilot-test-storage",
    }
)

API_DIR = Path(__file__).resolve().parents[1]


def _rebuild_schema() -> None:
    sync_url = TEST_DB.replace("+asyncpg", "")
    script = (
        "import asyncio, asyncpg\n"
        "async def main():\n"
        f"    c = await asyncpg.connect({sync_url!r})\n"
        "    await c.execute('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')\n"
        "    await c.close()\n"
        "asyncio.run(main())\n"
    )
    subprocess.run([sys.executable, "-c", script], check=True, cwd=API_DIR)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=API_DIR, env={**os.environ}, capture_output=True)


_rebuild_schema()

import re  # noqa: E402
import uuid  # noqa: E402
from datetime import UTC, datetime, timedelta  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Review, Subscription, SubscriptionPlan  # noqa: E402
from app.providers.email import DEV_OUTBOX  # noqa: E402
from app.seed import seed_reference_data  # noqa: E402
from app.services.jobs import drain_inline_tasks  # noqa: E402

PASSWORD = "Passw0rd!long"
BASE_URL = "http://api.test"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _reference_data():
    async with SessionLocal() as db:
        await seed_reference_data(db)
    yield


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    ratelimit.clear_memory()
    yield
    ratelimit.clear_memory()


class Api:
    """A browser-like session: cookie jar + CSRF + active organization header."""

    def __init__(self, client: httpx.AsyncClient):
        self.c = client
        self.org_id: str | None = None
        self.me: dict | None = None
        self.email: str | None = None

    def headers(self, extra: dict | None = None, org: bool = True) -> dict:
        h: dict[str, str] = {}
        csrf = self.c.cookies.get("rp_csrf")
        if csrf:
            h["X-CSRF-Token"] = csrf
        if org and self.org_id:
            h["X-Organization-Id"] = self.org_id
        h.update(extra or {})
        return h

    async def get(self, path, **kw):
        return await self.c.get(f"/api/v1{path}", headers=self.headers(kw.pop("headers", None)), **kw)

    async def post(self, path, json=None, **kw):
        return await self.c.post(f"/api/v1{path}", json=json, headers=self.headers(kw.pop("headers", None)), **kw)

    async def put(self, path, json=None, **kw):
        return await self.c.put(f"/api/v1{path}", json=json, headers=self.headers(kw.pop("headers", None)), **kw)

    async def patch(self, path, json=None, **kw):
        return await self.c.patch(f"/api/v1{path}", json=json, headers=self.headers(kw.pop("headers", None)), **kw)

    async def delete(self, path, **kw):
        return await self.c.delete(f"/api/v1{path}", headers=self.headers(kw.pop("headers", None)), **kw)


_clients: list[httpx.AsyncClient] = []


def new_client() -> httpx.AsyncClient:
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL, follow_redirects=False)
    _clients.append(client)
    return client


@pytest_asyncio.fixture(autouse=True)
async def _close_clients():
    yield
    await drain_inline_tasks()
    while _clients:
        await _clients.pop().aclose()


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


async def signup(email: str | None = None, *, business: str = "Test Bistro", industry: str = "restaurant", password: str = PASSWORD) -> Api:
    api = Api(new_client())
    email = email or unique_email()
    res = await api.c.post(
        "/api/v1/auth/signup",
        json={"full_name": "Test Owner", "email": email, "password": password, "business_name": business, "industry": industry, "country": "IN", "phone": "+919876543210", "accept_terms": True},
    )
    assert res.status_code == 201, res.text
    api.me = res.json()
    api.email = email
    api.org_id = api.me["memberships"][0]["organization"]["id"]
    return api


async def login(email: str, password: str = PASSWORD) -> Api:
    api = Api(new_client())
    res = await api.c.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    api.me = res.json()
    api.email = email
    if api.me["memberships"]:
        api.org_id = api.me["memberships"][0]["organization"]["id"]
    return api


def outbox_token(to: str, path: str) -> str:
    """Pull the most recent token for `path` (e.g. 'verify-email') sent to `to` from the dev outbox."""
    for msg in DEV_OUTBOX:
        if msg["to"] == to and f"/{path}?token=" in msg["text"]:
            m = re.search(rf"/{path}\?token=([\w-]+)", msg["text"])
            if m:
                return m.group(1)
    raise AssertionError(f"No {path} email for {to}")


async def add_member(owner: Api, role: str, location_ids: list[str] | None = None) -> Api:
    email = unique_email(role)
    res = await owner.post("/team/invitations", {"email": email, "role": role, "location_ids": location_ids or []})
    assert res.status_code == 201, res.text
    token = outbox_token(email, "invite")
    member = await signup(email, business=f"{role} side business")
    res = await member.post("/team/invitations/accept", {"token": token})
    assert res.status_code == 200, res.text
    member.org_id = owner.org_id
    return member


async def create_location(api: Api, name: str = "Main Branch", **extra) -> dict:
    res = await api.post("/locations", {"name": name, "city": "Mumbai", **extra})
    assert res.status_code == 201, res.text
    return res.json()


async def create_review(org_id: str, location_id: str, rating: int = 5, comment: str | None = "Great food and friendly staff", days_ago: int = 1) -> str:
    async with SessionLocal() as db:
        r = Review(
            organization_id=uuid.UUID(org_id), location_id=uuid.UUID(location_id), source="demo", platform="google",
            external_id=f"test-{uuid.uuid4().hex[:10]}", reviewer_name="Asha K.", rating=rating, comment=comment,
            review_created_at=datetime.now(UTC) - timedelta(days=days_ago), topics=[], history=[],
        )
        db.add(r)
        await db.commit()
        return str(r.id)


async def set_plan(org_id: str, code: str) -> None:
    async with SessionLocal() as db:
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == code))
        sub = await db.scalar(select(Subscription).where(Subscription.organization_id == uuid.UUID(org_id)))
        sub.plan_id = plan.id
        await db.commit()


async def get_subscription(org_id: str) -> Subscription:
    async with SessionLocal() as db:
        return await db.scalar(select(Subscription).where(Subscription.organization_id == uuid.UUID(org_id)))
