"""Email delivery: Resend in production, a console/dev-outbox adapter otherwise."""

from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

from app.core.config import settings

log = logging.getLogger("reviewpilot.email")

# Development-only outbox so verification / reset links are inspectable without a provider.
DEV_OUTBOX: deque[dict] = deque(maxlen=50)


@dataclass
class EmailResult:
    provider: str
    message_id: str | None
    ok: bool
    error: str | None = None


class EmailProvider(Protocol):
    name: str

    async def send(self, *, to: str, subject: str, html: str, text: str, headers: dict | None = None, sender: str | None = None) -> EmailResult: ...


class ResendProvider:
    name = "resend"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def send(self, *, to, subject, html, text, headers=None, sender=None) -> EmailResult:
        payload = {"from": sender or settings.email_from, "to": [to], "subject": subject, "html": html, "text": text}
        if headers:
            payload["headers"] = headers
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    "https://api.resend.com/emails", json=payload, headers={"Authorization": f"Bearer {self.api_key}"}
                )
            if res.status_code >= 400:
                return EmailResult(self.name, None, False, f"{res.status_code}: {res.text[:300]}")
            return EmailResult(self.name, res.json().get("id"), True)
        except httpx.HTTPError as exc:
            return EmailResult(self.name, None, False, str(exc))


class DevEmailProvider:
    """Logs emails and keeps them in an in-memory outbox. Never used in production."""

    name = "dev_outbox"

    async def send(self, *, to, subject, html, text, headers=None, sender=None) -> EmailResult:
        message_id = f"dev_{datetime.now(UTC).timestamp():.0f}_{len(DEV_OUTBOX)}"
        DEV_OUTBOX.appendleft({"id": message_id, "to": to, "subject": subject, "text": text, "sent_at": datetime.now(UTC).isoformat()})
        log.info("[dev email] to=%s subject=%s\n%s", to, subject, text)
        return EmailResult(self.name, message_id, True)


def get_email_provider() -> EmailProvider:
    if settings.resend_configured:
        return ResendProvider(settings.resend_api_key or "")
    if settings.is_production:
        raise RuntimeError("RESEND_API_KEY is required in production")
    return DevEmailProvider()
