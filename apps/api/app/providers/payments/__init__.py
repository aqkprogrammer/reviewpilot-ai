"""Payment provider abstraction (Razorpay, Stripe, and a DEMO-ONLY mock).

Providers only *create* checkouts and *verify/normalise* webhooks. Subscription state is
changed exclusively by `services.billing.apply_event` after a webhook signature passes."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

import httpx

from app.core.config import settings


@dataclass
class CheckoutSession:
    provider: str
    checkout_url: str | None
    reference: str
    extra: dict = field(default_factory=dict)


@dataclass
class NormalizedEvent:
    provider: str
    event_id: str
    type: str  # subscription.activated | payment.succeeded | payment.failed | subscription.canceled | subscription.updated | ignored
    organization_id: str | None = None
    plan_code: str | None = None
    interval: str | None = None
    provider_subscription_id: str | None = None
    provider_customer_id: str | None = None
    provider_payment_id: str | None = None
    amount_minor: int | None = None
    currency: str | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    cancel_at_period_end: bool | None = None
    failure_reason: str | None = None
    raw: dict = field(default_factory=dict)


class WebhookSignatureError(Exception):
    pass


class PaymentProvider(Protocol):
    name: str

    async def create_checkout(self, *, org_id: str, org_name: str, email: str, plan: Any, interval: str) -> CheckoutSession: ...
    async def cancel(self, provider_subscription_id: str, at_period_end: bool = True) -> None: ...
    def parse_webhook(self, body: bytes, headers: dict[str, str]) -> NormalizedEvent: ...


def _ts(value: int | None) -> datetime | None:
    return datetime.fromtimestamp(value, UTC) if value else None


# ------------------------------------------------------------------ Stripe

class StripeProvider:
    name = "stripe"
    api = "https://api.stripe.com/v1"

    async def _post(self, path: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=20, auth=(settings.stripe_secret_key or "", "")) as client:
            res = await client.post(f"{self.api}{path}", data=data)
        if res.status_code >= 400:
            raise RuntimeError(f"Stripe error: {res.json().get('error', {}).get('message', res.text[:200])}")
        return res.json()

    async def create_checkout(self, *, org_id, org_name, email, plan, interval) -> CheckoutSession:
        amount = plan.price_yearly_minor if interval == "yearly" else plan.price_monthly_minor
        meta = {"organization_id": org_id, "plan_code": plan.code, "interval": interval}
        data = {
            "mode": "subscription",
            "customer_email": email,
            "success_url": f"{settings.frontend_url}/app/subscription?checkout=success",
            "cancel_url": f"{settings.frontend_url}/app/subscription?checkout=cancelled",
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": plan.currency.lower(),
            "line_items[0][price_data][unit_amount]": str(amount),
            "line_items[0][price_data][recurring][interval]": "year" if interval == "yearly" else "month",
            "line_items[0][price_data][product_data][name]": f"ReviewPilot AI — {plan.name}",
            "client_reference_id": org_id,
        }
        for k, v in meta.items():
            data[f"metadata[{k}]"] = v
            data[f"subscription_data[metadata][{k}]"] = v
        session = await self._post("/checkout/sessions", data)
        return CheckoutSession(self.name, session["url"], session["id"])

    async def cancel(self, provider_subscription_id: str, at_period_end: bool = True) -> None:
        await self._post(f"/subscriptions/{provider_subscription_id}", {"cancel_at_period_end": "true" if at_period_end else "false"})

    def parse_webhook(self, body: bytes, headers: dict[str, str]) -> NormalizedEvent:
        sig = headers.get("stripe-signature", "")
        parts = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)
        t, v1 = parts.get("t"), parts.get("v1")
        if not t or not v1 or not settings.stripe_webhook_secret:
            raise WebhookSignatureError("Missing Stripe signature")
        expected = hmac.new(settings.stripe_webhook_secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, v1) or abs(time.time() - int(t)) > 300:
            raise WebhookSignatureError("Invalid Stripe signature")
        evt = json.loads(body)
        obj = evt["data"]["object"]
        meta = obj.get("metadata") or {}
        base = dict(provider=self.name, event_id=evt["id"], raw=evt)
        et = evt["type"]
        if et == "checkout.session.completed":
            return NormalizedEvent(**base, type="subscription.activated", organization_id=meta.get("organization_id") or obj.get("client_reference_id"), plan_code=meta.get("plan_code"), interval=meta.get("interval"), provider_subscription_id=obj.get("subscription"), provider_customer_id=obj.get("customer"))
        if et in ("invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"):
            line = ((obj.get("lines") or {}).get("data") or [{}])[0]
            sub_meta = (obj.get("subscription_details") or {}).get("metadata") or line.get("metadata") or {}
            period = line.get("period") or {}
            return NormalizedEvent(
                **base, type="payment.failed" if et == "invoice.payment_failed" else "payment.succeeded",
                organization_id=sub_meta.get("organization_id"), plan_code=sub_meta.get("plan_code"), interval=sub_meta.get("interval"),
                provider_subscription_id=obj.get("subscription"), provider_customer_id=obj.get("customer"), provider_payment_id=obj.get("payment_intent") or obj["id"],
                amount_minor=obj.get("amount_paid") if et != "invoice.payment_failed" else obj.get("amount_due"), currency=(obj.get("currency") or "inr").upper(),
                period_start=_ts(period.get("start")), period_end=_ts(period.get("end")), failure_reason=(obj.get("last_finalization_error") or {}).get("message"),
            )
        if et == "customer.subscription.deleted":
            return NormalizedEvent(**base, type="subscription.canceled", organization_id=meta.get("organization_id"), provider_subscription_id=obj["id"])
        if et == "customer.subscription.updated":
            return NormalizedEvent(**base, type="subscription.updated", organization_id=meta.get("organization_id"), provider_subscription_id=obj["id"], cancel_at_period_end=obj.get("cancel_at_period_end"), period_start=_ts(obj.get("current_period_start")), period_end=_ts(obj.get("current_period_end")))
        return NormalizedEvent(**base, type="ignored")


# ------------------------------------------------------------------ Razorpay

class RazorpayProvider:
    name = "razorpay"
    api = "https://api.razorpay.com/v1"

    def _auth(self):
        return (settings.razorpay_key_id or "", settings.razorpay_key_secret or "")

    async def _req(self, method: str, path: str, payload: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=20, auth=self._auth()) as client:
            res = await client.request(method, f"{self.api}{path}", json=payload)
        if res.status_code >= 400:
            raise RuntimeError(f"Razorpay error: {res.json().get('error', {}).get('description', res.text[:200])}")
        return res.json()

    async def _plan_id(self, plan, interval: str) -> str:
        key = f"razorpay_{interval}"
        if plan.provider_refs.get(key):
            return plan.provider_refs[key]
        amount = plan.price_yearly_minor if interval == "yearly" else plan.price_monthly_minor
        created = await self._req("POST", "/plans", {"period": "yearly" if interval == "yearly" else "monthly", "interval": 1, "item": {"name": f"ReviewPilot {plan.name} ({interval})", "amount": amount, "currency": plan.currency}})
        plan.provider_refs = {**plan.provider_refs, key: created["id"]}  # persisted by caller's commit
        return created["id"]

    async def create_checkout(self, *, org_id, org_name, email, plan, interval) -> CheckoutSession:
        plan_id = await self._plan_id(plan, interval)
        sub = await self._req("POST", "/subscriptions", {
            "plan_id": plan_id, "total_count": 10 if interval == "yearly" else 120, "customer_notify": 1, "quantity": 1,
            "notes": {"organization_id": org_id, "plan_code": plan.code, "interval": interval, "org_name": org_name[:200]},
        })
        return CheckoutSession(self.name, sub.get("short_url"), sub["id"], {"key_id": settings.razorpay_key_id, "subscription_id": sub["id"]})

    async def cancel(self, provider_subscription_id: str, at_period_end: bool = True) -> None:
        await self._req("POST", f"/subscriptions/{provider_subscription_id}/cancel", {"cancel_at_cycle_end": 1 if at_period_end else 0})

    def parse_webhook(self, body: bytes, headers: dict[str, str]) -> NormalizedEvent:
        sig = headers.get("x-razorpay-signature", "")
        if not sig or not settings.razorpay_webhook_secret:
            raise WebhookSignatureError("Missing Razorpay signature")
        expected = hmac.new(settings.razorpay_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise WebhookSignatureError("Invalid Razorpay signature")
        evt = json.loads(body)
        event_id = headers.get("x-razorpay-event-id") or hashlib.sha256(body).hexdigest()
        payload = evt.get("payload", {})
        sub = (payload.get("subscription") or {}).get("entity") or {}
        pay = (payload.get("payment") or {}).get("entity") or {}
        notes = sub.get("notes") or pay.get("notes") or {}
        base = dict(provider=self.name, event_id=event_id, raw=evt, organization_id=notes.get("organization_id"), plan_code=notes.get("plan_code"), interval=notes.get("interval"), provider_subscription_id=sub.get("id") or pay.get("subscription_id"), provider_customer_id=sub.get("customer_id"))
        et = evt.get("event")
        if et == "subscription.activated":
            return NormalizedEvent(**base, type="subscription.activated", period_start=_ts(sub.get("current_start")), period_end=_ts(sub.get("current_end")))
        if et == "subscription.charged":
            return NormalizedEvent(**base, type="payment.succeeded", provider_payment_id=pay.get("id"), amount_minor=pay.get("amount"), currency=pay.get("currency"), period_start=_ts(sub.get("current_start")), period_end=_ts(sub.get("current_end")))
        if et in ("payment.failed", "subscription.pending", "subscription.halted"):
            return NormalizedEvent(**base, type="payment.failed", provider_payment_id=pay.get("id") or f"{event_id}", amount_minor=pay.get("amount"), currency=pay.get("currency"), failure_reason=pay.get("error_description") or et)
        if et in ("subscription.cancelled", "subscription.completed"):
            return NormalizedEvent(**base, type="subscription.canceled")
        return NormalizedEvent(**base, type="ignored")


# ------------------------------------------------------------------ Mock (DEMO MODE ONLY)

def mock_secret() -> str:
    return hashlib.sha256(f"mock-payments:{settings.secret_key}".encode()).hexdigest()


class MockPaymentProvider:
    """Simulated checkout for demos. Its webhooks are HMAC-signed and go through the same
    verification + state machine as real providers. Refused unless DEMO_MODE=true."""

    name = "mock"

    async def create_checkout(self, *, org_id, org_name, email, plan, interval) -> CheckoutSession:
        ref = f"mock_sub_{hashlib.sha1(f'{org_id}{time.time()}'.encode()).hexdigest()[:14]}"
        return CheckoutSession(self.name, f"{settings.frontend_url}/app/subscription/checkout?session={ref}&plan={plan.code}&interval={interval}", ref)

    async def cancel(self, provider_subscription_id: str, at_period_end: bool = True) -> None:
        return None

    @staticmethod
    def sign(body: bytes) -> str:
        return hmac.new(mock_secret().encode(), body, hashlib.sha256).hexdigest()

    def parse_webhook(self, body: bytes, headers: dict[str, str]) -> NormalizedEvent:
        if not settings.demo_mode:
            raise WebhookSignatureError("Mock payments are disabled outside demo mode")
        if not hmac.compare_digest(self.sign(body), headers.get("x-mock-signature", "")):
            raise WebhookSignatureError("Invalid mock signature")
        evt = json.loads(body)
        return NormalizedEvent(
            provider=self.name, event_id=evt["id"], type=evt["type"], organization_id=evt.get("organization_id"), plan_code=evt.get("plan_code"), interval=evt.get("interval"),
            provider_subscription_id=evt.get("subscription_id"), provider_payment_id=evt.get("payment_id"), amount_minor=evt.get("amount_minor"), currency=evt.get("currency", "INR"),
            period_start=datetime.fromisoformat(evt["period_start"]) if evt.get("period_start") else None, period_end=datetime.fromisoformat(evt["period_end"]) if evt.get("period_end") else None,
            failure_reason=evt.get("failure_reason"), raw=evt,
        )


def get_provider(name: str | None = None) -> PaymentProvider:
    name = name or settings.default_payment_provider
    if name == "stripe" and settings.stripe_configured:
        return StripeProvider()
    if name == "razorpay" and settings.razorpay_configured:
        return RazorpayProvider()
    if settings.demo_mode:
        return MockPaymentProvider()
    from app.core.errors import IntegrationNotConfigured

    raise IntegrationNotConfigured(f"Payment provider '{name}' is not configured. Add its API keys (see docs/PAYMENTS.md).")


def provider_by_name(name: str) -> PaymentProvider:
    return {"stripe": StripeProvider, "razorpay": RazorpayProvider, "mock": MockPaymentProvider}[name]()
