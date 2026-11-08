"""Messaging channel adapters: WhatsApp Cloud API, SMS (Twilio), plus clearly-labelled mocks.

Mock adapters are only selected when DEMO_MODE=true. They never contact a real network and
every delivery they create is stored with provider="mock"."""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import settings

log = logging.getLogger("reviewpilot.messaging")


@dataclass
class SendResult:
    ok: bool
    provider: str
    message_id: str | None = None
    status: str = "sent"
    error_code: str | None = None
    error_message: str | None = None


class ChannelAdapter(Protocol):
    name: str

    async def send(self, *, to: str, body: str, template: dict | None = None) -> SendResult: ...


class WhatsAppCloudAdapter:
    """Meta WhatsApp Cloud API. Business-initiated messages must use an approved template."""

    name = "whatsapp_cloud"

    def __init__(self, access_token: str, phone_number_id: str, api_version: str | None = None):
        self.token, self.phone_number_id = access_token, phone_number_id
        self.base = f"https://graph.facebook.com/{api_version or settings.whatsapp_api_version}"

    async def send(self, *, to: str, body: str, template: dict | None = None) -> SendResult:
        if not template or not template.get("name"):
            return SendResult(False, self.name, error_code="template_required", error_message="An approved WhatsApp template is required for business-initiated messages.")
        payload = {
            "messaging_product": "whatsapp",
            "to": to.lstrip("+"),
            "type": "template",
            "template": {
                "name": template["name"],
                "language": {"code": template.get("language", "en")},
                "components": [{"type": "body", "parameters": [{"type": "text", "text": str(p)} for p in template.get("params", [])]}],
            },
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(f"{self.base}/{self.phone_number_id}/messages", json=payload, headers={"Authorization": f"Bearer {self.token}"})
        except httpx.HTTPError as exc:
            return SendResult(False, self.name, error_code="network_error", error_message=str(exc))
        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        if res.status_code >= 400:
            err = data.get("error", {})
            return SendResult(False, self.name, error_code=str(err.get("code", res.status_code)), error_message=err.get("message", res.text[:300]))
        return SendResult(True, self.name, message_id=(data.get("messages") or [{}])[0].get("id"), status="sent")

    async def list_templates(self, business_account_id: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.get(f"{self.base}/{business_account_id}/message_templates", params={"limit": 100, "fields": "name,status,language,category,components"}, headers={"Authorization": f"Bearer {self.token}"})
        res.raise_for_status()
        return res.json().get("data", [])

    async def verify(self) -> tuple[bool, str | None]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(f"{self.base}/{self.phone_number_id}", params={"fields": "display_phone_number,verified_name,quality_rating"}, headers={"Authorization": f"Bearer {self.token}"})
            if res.status_code >= 400:
                return False, res.json().get("error", {}).get("message", "Verification failed")
            info = res.json()
            return True, f"{info.get('verified_name', '')} {info.get('display_phone_number', '')}".strip()
        except httpx.HTTPError as exc:
            return False, str(exc)


class TwilioSMSAdapter:
    name = "twilio"

    def __init__(self, sid: str, token: str, from_number: str):
        self.sid, self.token, self.from_number = sid, token, from_number

    async def send(self, *, to: str, body: str, template: dict | None = None) -> SendResult:
        try:
            async with httpx.AsyncClient(timeout=20, auth=(self.sid, self.token)) as client:
                res = await client.post(f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Messages.json", data={"To": to, "From": self.from_number, "Body": body})
        except httpx.HTTPError as exc:
            return SendResult(False, self.name, error_code="network_error", error_message=str(exc))
        data = res.json()
        if res.status_code >= 400:
            return SendResult(False, self.name, error_code=str(data.get("code")), error_message=data.get("message"))
        return SendResult(True, self.name, message_id=data.get("sid"), status="sent")


class MockAdapter:
    """DEMO MODE ONLY. Simulates acceptance by the provider; nothing is sent."""

    name = "mock"

    def __init__(self, channel: str):
        self.channel = channel

    async def send(self, *, to: str, body: str, template: dict | None = None) -> SendResult:
        log.info("[mock %s] to=%s body=%s", self.channel, to, body[:120])
        if to.endswith("0000"):
            return SendResult(False, self.name, error_code="mock_undeliverable", error_message="Simulated failure (numbers ending in 0000)")
        return SendResult(True, self.name, message_id=f"mock_{secrets.token_hex(8)}", status="delivered")
