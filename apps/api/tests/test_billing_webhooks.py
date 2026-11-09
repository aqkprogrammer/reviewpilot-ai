from __future__ import annotations

import hashlib
import hmac
import json
import time

from app.core.config import settings
from tests.conftest import add_member, get_subscription, new_client, signup


async def test_public_plans():
    plans = (await new_client().get("/api/v1/subscriptions/plans")).json()
    codes = [p["code"] for p in plans]
    assert codes == ["starter", "growth", "agency", "enterprise"]
    growth = next(p for p in plans if p["code"] == "growth")
    assert growth["price_monthly_minor"] == 199_900 and growth["is_popular"]


async def test_mock_checkout_success_activates_via_signed_event():
    owner = await signup()
    res = await owner.post("/subscriptions/checkout", {"plan_code": "agency", "interval": "monthly"})
    assert res.status_code == 200, res.text
    co = res.json()
    assert co["provider"] == "mock"
    assert "/app/subscription/checkout?session=" in co["checkout_url"]
    # Starting checkout does not change subscription state.
    assert (await get_subscription(owner.org_id)).status == "trialing"
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "success"})
    assert res.status_code == 200 and res.json()["result"] == "payment_recorded"
    cur = (await owner.get("/subscriptions/current")).json()
    assert cur["subscription"]["status"] == "active"
    assert cur["plan"]["code"] == "agency"
    payments = (await owner.get("/subscriptions/payments")).json()
    assert payments[0]["status"] == "succeeded" and payments[0]["invoice_id"] and payments[0]["simulated"]
    pdf = await owner.get(f"/subscriptions/invoices/{payments[0]['invoice_id']}.pdf")
    assert pdf.headers["content-type"] == "application/pdf"


async def _activate(owner, plan_code: str = "growth") -> None:
    co = (await owner.post("/subscriptions/checkout", {"plan_code": plan_code, "interval": "monthly"})).json()
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "success"})
    assert res.json()["result"] == "payment_recorded"


async def test_declined_first_checkout_keeps_trial():
    owner = await signup()
    co = (await owner.post("/subscriptions/checkout", {"plan_code": "growth", "interval": "yearly"})).json()
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "failure"})
    assert res.json()["result"] == "plan_change_failed"
    sub = await get_subscription(owner.org_id)
    assert sub.status == "trialing" and sub.grace_period_ends_at is None
    payments = (await owner.get("/subscriptions/payments")).json()
    assert payments[0]["status"] == "failed"


async def test_declined_upgrade_leaves_active_plan_untouched():
    owner = await signup()
    await _activate(owner, "growth")
    co = (await owner.post("/subscriptions/checkout", {"plan_code": "agency", "interval": "monthly"})).json()
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "failure"})
    assert res.json()["result"] == "plan_change_failed"
    sub = await get_subscription(owner.org_id)
    assert sub.status == "active" and sub.grace_period_ends_at is None
    cur = (await owner.get("/subscriptions/current")).json()
    assert cur["plan"]["code"] == "growth"


async def test_failed_renewal_enters_grace_period():
    owner = await signup()
    await _activate(owner, "growth")
    co = (await owner.post("/subscriptions/checkout", {"plan_code": "growth", "interval": "monthly"})).json()
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": co["reference"], "outcome": "failure"})
    assert res.json()["result"] == "payment_failed"
    sub = await get_subscription(owner.org_id)
    assert sub.status == "grace_period" and sub.grace_period_ends_at is not None


async def test_mock_checkout_rejects_unknown_session():
    owner = await signup()
    await owner.post("/subscriptions/checkout", {"plan_code": "growth", "interval": "monthly"})
    res = await owner.post("/subscriptions/mock-checkout/complete", {"session": "mock_sub_forged000", "outcome": "success"})
    assert res.status_code == 400


async def test_only_billing_managers_can_checkout():
    owner = await signup()
    admin = await add_member(owner, "admin")
    res = await admin.post("/subscriptions/checkout", {"plan_code": "growth", "interval": "monthly"})
    assert res.status_code == 403


async def test_downgrade_blocked_by_location_count():
    from tests.conftest import create_location

    owner = await signup()
    await create_location(owner, "One")
    await create_location(owner, "Two")
    res = await owner.post("/subscriptions/checkout", {"plan_code": "starter", "interval": "monthly"})
    assert res.status_code == 400 and res.json()["error"]["code"] == "downgrade_blocked"


async def test_cancel_trial():
    owner = await signup()
    res = await owner.post("/subscriptions/cancel")
    assert res.status_code == 200
    assert res.json()["subscription"]["status"] == "canceled"


# ------------------------------------------------------------------ Razorpay

def _razorpay(monkeypatch):
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_key")
    monkeypatch.setattr(settings, "razorpay_key_secret", "rzp_test_secret")
    monkeypatch.setattr(settings, "razorpay_webhook_secret", "rzp_webhook_secret")


def _rzp_body(org_id: str) -> bytes:
    now = int(time.time())
    return json.dumps({
        "event": "subscription.charged",
        "payload": {
            "subscription": {"entity": {"id": "sub_rzp_1", "customer_id": "cust_1", "notes": {"organization_id": org_id, "plan_code": "growth", "interval": "monthly"}, "current_start": now, "current_end": now + 30 * 86400}},
            "payment": {"entity": {"id": f"pay_{org_id[:8]}", "amount": 199900, "currency": "INR"}},
        },
    }).encode()


async def test_razorpay_webhook_valid_and_idempotent(monkeypatch):
    _razorpay(monkeypatch)
    owner = await signup()
    body = _rzp_body(owner.org_id)
    sig = hmac.new(b"rzp_webhook_secret", body, hashlib.sha256).hexdigest()
    headers = {"X-Razorpay-Signature": sig, "X-Razorpay-Event-Id": f"evt_{owner.org_id}", "Content-Type": "application/json"}
    client = new_client()
    res = await client.post("/api/v1/webhooks/razorpay", content=body, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "payment_recorded"
    sub = await get_subscription(owner.org_id)
    assert sub.status == "active" and sub.provider == "razorpay"
    again = await client.post("/api/v1/webhooks/razorpay", content=body, headers=headers)
    assert again.json()["status"] == "duplicate"
    payments = (await owner.get("/subscriptions/payments")).json()
    assert len(payments) == 1


async def test_razorpay_webhook_invalid_signature(monkeypatch):
    _razorpay(monkeypatch)
    owner = await signup()
    body = _rzp_body(owner.org_id)
    res = await new_client().post("/api/v1/webhooks/razorpay", content=body, headers={"X-Razorpay-Signature": "deadbeef"})
    assert res.status_code == 400
    assert (await get_subscription(owner.org_id)).status == "trialing"


async def test_razorpay_webhook_not_configured():
    res = await new_client().post("/api/v1/webhooks/razorpay", content=b"{}")
    assert res.status_code == 503


# ------------------------------------------------------------------ Stripe

def _stripe(monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")


def _stripe_sig(body: bytes, t: int | None = None, secret: str = "whsec_test") -> str:
    t = t or int(time.time())
    v1 = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={t},v1={v1}"


async def test_stripe_checkout_completed_activates(monkeypatch):
    _stripe(monkeypatch)
    owner = await signup()
    body = json.dumps({"id": f"evt_{owner.org_id}", "type": "checkout.session.completed", "data": {"object": {"client_reference_id": owner.org_id, "subscription": "sub_s1", "customer": "cus_1", "metadata": {"organization_id": owner.org_id, "plan_code": "agency", "interval": "yearly"}}}}).encode()
    client = new_client()
    res = await client.post("/api/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": _stripe_sig(body)})
    assert res.status_code == 200 and res.json()["status"] == "activated"
    sub = await get_subscription(owner.org_id)
    assert sub.status == "active" and sub.interval == "yearly" and sub.provider_subscription_id == "sub_s1"
    dup = await client.post("/api/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": _stripe_sig(body)})
    assert dup.json()["status"] == "duplicate"


async def test_stripe_rejects_bad_or_stale_signatures(monkeypatch):
    _stripe(monkeypatch)
    owner = await signup()
    body = json.dumps({"id": "evt_bad", "type": "checkout.session.completed", "data": {"object": {"metadata": {"organization_id": owner.org_id}}}}).encode()
    client = new_client()
    assert (await client.post("/api/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": _stripe_sig(body, secret="whsec_wrong")})).status_code == 400
    assert (await client.post("/api/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": _stripe_sig(body, t=int(time.time()) - 3600)})).status_code == 400
    assert (await client.post("/api/v1/webhooks/stripe", content=body)).status_code == 400
    assert (await get_subscription(owner.org_id)).status == "trialing"


async def test_stripe_payment_failed_moves_to_grace(monkeypatch):
    _stripe(monkeypatch)
    owner = await signup()
    await _activate(owner, "growth")  # a renewal failure only matters for a paid subscription
    body = json.dumps({"id": f"evt_fail_{owner.org_id}", "type": "invoice.payment_failed", "data": {"object": {"id": "in_1", "subscription": "sub_x", "amount_due": 199900, "currency": "inr", "subscription_details": {"metadata": {"organization_id": owner.org_id, "plan_code": "growth"}}, "lines": {"data": [{}]}}}}).encode()
    res = await new_client().post("/api/v1/webhooks/stripe", content=body, headers={"Stripe-Signature": _stripe_sig(body)})
    assert res.json()["status"] == "payment_failed"
    assert (await get_subscription(owner.org_id)).status == "grace_period"
