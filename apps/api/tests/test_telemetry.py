"""Client error telemetry: POST /api/v1/public/client-errors → error_events (source="web")."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import ErrorEvent
from tests.conftest import new_client

URL = "/api/v1/public/client-errors"


async def test_client_error_creates_error_event():
    c = new_client()
    marker = f"boom-{uuid.uuid4().hex[:8]}"
    res = await c.post(
        URL,
        json={"message": marker, "name": "TypeError", "stack": "TypeError: boom\n    at x (app.js:1:1)", "digest": "d1g3st", "path": "/app/reviews", "user_agent": "Mozilla/5.0 Test"},
    )
    assert res.status_code == 202, res.text
    async with SessionLocal() as db:
        ev = await db.scalar(select(ErrorEvent).where(ErrorEvent.message.startswith(marker)))
    assert ev is not None
    assert ev.source == "web"
    assert ev.error_type == "TypeError"
    assert ev.path == "/app/reviews"
    assert ev.request_id == "d1g3st"
    assert "UA: Mozilla/5.0 Test" in ev.message
    assert "at x (app.js:1:1)" in ev.message


async def test_client_error_defaults_type_and_ignores_unknown_fields():
    c = new_client()
    marker = f"plain-{uuid.uuid4().hex[:8]}"
    res = await c.post(URL, json={"message": marker, "name": "not a <valid> name", "extra": "ignored"})
    assert res.status_code == 202, res.text
    async with SessionLocal() as db:
        ev = await db.scalar(select(ErrorEvent).where(ErrorEvent.message == marker))
    assert ev is not None and ev.error_type == "ClientError" and ev.path is None


async def test_client_error_rejects_oversized_payload():
    c = new_client()
    assert (await c.post(URL, json={"message": "x" * 2001})).status_code == 422
    assert (await c.post(URL, json={"message": "ok", "stack": "s" * 5000})).status_code == 422
    assert (await c.post(URL, json={"message": "ok", "path": "/" + "p" * 600})).status_code == 422
    assert (await c.post(URL, json={"message": ""})).status_code == 422


async def test_client_error_rate_limited():
    c = new_client()
    for i in range(20):
        res = await c.post(URL, json={"message": f"rl-{i}"})
        assert res.status_code == 202, res.text
    res = await c.post(URL, json={"message": "rl-over"})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "rate_limited"
