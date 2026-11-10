"""Unauthenticated client telemetry: browser error reports from the web app.

The Next.js error boundaries and global listeners (apps/web/src/lib/report-error.ts) POST here via
`navigator.sendBeacon`. Reports become `error_events` rows (source="web"), which Super Admin →
System health already lists. Rate-limited per IP and length-capped; no PII is stored beyond the
page path and a truncated user agent.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

import app.core.monitoring  # noqa: F401  (initialises optional Sentry once, at import time)
from app.core.deps import DB
from app.core.ratelimit import limiter
from app.models import ErrorEvent
from app.schemas.common import Message

router = APIRouter(prefix="/public", tags=["telemetry"])

_ERROR_NAME = re.compile(r"^[A-Za-z_$][\w$.]{0,127}$")
_MAX_STORED = 8000


class ClientErrorIn(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    message: str = Field(..., min_length=1, max_length=2000)
    name: str | None = Field(None, max_length=128)
    stack: str | None = Field(None, max_length=4096)
    digest: str | None = Field(None, max_length=64)
    path: str | None = Field(None, max_length=512)
    user_agent: str | None = Field(None, max_length=512)


@router.post("/client-errors", response_model=Message, status_code=202, dependencies=[Depends(limiter("client-errors", 20, 600))])
async def report_client_error(data: ClientErrorIn, db: DB):
    error_type = data.name if data.name and _ERROR_NAME.match(data.name) else "ClientError"
    parts = [data.message]
    if data.user_agent:
        parts.append(f"UA: {data.user_agent[:300]}")
    if data.stack:
        parts.append(data.stack)
    db.add(
        ErrorEvent(
            source="web",
            path=data.path or None,
            error_type=error_type,
            message="\n\n".join(parts)[:_MAX_STORED],
            request_id=data.digest or None,
        )
    )
    await db.commit()
    return Message(message="Error report received.")
