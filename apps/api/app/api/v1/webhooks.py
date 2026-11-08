"""Inbound provider webhooks. Every handler verifies the provider signature before acting."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import time

from fastapi import APIRouter, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import DB
from app.core.errors import AppError
from app.core.security import now
from app.models import MessageDelivery, ReviewRequest, WebhookEvent
from app.models.enums import DeliveryStatus, RequestStatus
from app.providers.payments import RazorpayProvider, StripeProvider, WebhookSignatureError
from app.services.billing import apply_event, record_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
log = logging.getLogger("reviewpilot.webhooks")


async def _payment_webhook(provider, request: Request, db) -> dict:
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    try:
        evt = provider.parse_webhook(body, headers)
    except WebhookSignatureError as exc:
        log.warning("Rejected %s webhook: %s", provider.name, exc)
        raise AppError("Invalid signature", code="invalid_signature", status_code=400)
    row, is_new = await record_event(db, evt)
    if not is_new:
        await db.commit()
        return {"status": "duplicate"}
    try:
        result = await apply_event(db, evt)
        row.processed_at = now()
    except Exception as exc:  # noqa: BLE001
        row.processing_error = str(exc)[:1000]
        row.attempts += 1
        await db.commit()
        raise
    row.attempts += 1
    await db.commit()
    return {"status": result}


@router.post("/stripe")
async def stripe_webhook(request: Request, db: DB):
    if not settings.stripe_configured:
        raise AppError("Stripe not configured", code="integration_not_configured", status_code=503)
    return await _payment_webhook(StripeProvider(), request, db)


@router.post("/razorpay")
async def razorpay_webhook(request: Request, db: DB):
    if not settings.razorpay_configured:
        raise AppError("Razorpay not configured", code="integration_not_configured", status_code=503)
    return await _payment_webhook(RazorpayProvider(), request, db)


# ------------------------------------------------------------------ WhatsApp Cloud API

@router.get("/whatsapp", response_class=PlainTextResponse)
async def whatsapp_verify(mode: str = Query(alias="hub.mode", default=""), token: str = Query(alias="hub.verify_token", default=""), challenge: str = Query(alias="hub.challenge", default="")):
    if mode == "subscribe" and settings.whatsapp_verify_token and hmac.compare_digest(token, settings.whatsapp_verify_token):
        return challenge
    raise AppError("Verification failed", code="forbidden", status_code=403)


WA_STATUS = {"sent": DeliveryStatus.SENT, "delivered": DeliveryStatus.DELIVERED, "read": DeliveryStatus.READ, "failed": DeliveryStatus.FAILED}


@router.post("/whatsapp")
async def whatsapp_events(request: Request, db: DB):
    body = await request.body()
    sig = request.headers.get("x-hub-signature-256", "")
    if not settings.whatsapp_app_secret:
        raise AppError("WhatsApp app secret not configured", code="integration_not_configured", status_code=503)
    expected = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise AppError("Invalid signature", code="invalid_signature", status_code=400)
    import json

    payload = json.loads(body)
    updated = 0
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for st in value.get("statuses", []):
                event_id = f"{st.get('id')}:{st.get('status')}"
                if await db.scalar(select(WebhookEvent.id).where(WebhookEvent.provider == "whatsapp", WebhookEvent.event_id == event_id)):
                    continue
                db.add(WebhookEvent(provider="whatsapp", event_id=event_id, event_type=f"status.{st.get('status')}", signature_valid=True, payload=st, processed_at=now()))
                delivery = await db.scalar(select(MessageDelivery).where(MessageDelivery.provider_message_id == st.get("id")))
                if delivery is None:
                    continue
                new = WA_STATUS.get(st.get("status"))
                if new:
                    delivery.status = new
                    delivery.events = [*delivery.events, {"at": now().isoformat(), "status": st.get("status")}]
                    if new == DeliveryStatus.FAILED:
                        err = (st.get("errors") or [{}])[0]
                        delivery.error_code, delivery.error_message = str(err.get("code")), err.get("title") or err.get("message")
                    req = await db.get(ReviewRequest, delivery.review_request_id) if delivery.review_request_id else None
                    if req:
                        if new in (DeliveryStatus.DELIVERED, DeliveryStatus.READ):
                            req.delivered_at = req.delivered_at or now()
                            if req.status in (RequestStatus.SENT, RequestStatus.QUEUED):
                                req.status = RequestStatus.DELIVERED
                        elif new == DeliveryStatus.FAILED:
                            req.status, req.failed_reason, req.next_reminder_at = RequestStatus.FAILED, delivery.error_message, None
                    updated += 1
            # Inbound "STOP" replies → opt out.
            for msg in value.get("messages", []):
                text = ((msg.get("text") or {}).get("body") or "").strip().lower()
                if text in ("stop", "unsubscribe", "band karo", "रोकें"):
                    from app.models import Customer
                    from app.models.enums import ConsentStatus, ConsentType
                    from app.services.consent import record_consent

                    phone = "+" + msg.get("from", "").lstrip("+")
                    for c in (await db.scalars(select(Customer).where(Customer.phone == phone))).all():
                        c.opted_out_at = c.opted_out_at or now()
                        await record_consent(db, c, "whatsapp", ConsentType.TRANSACTIONAL, ConsentStatus.REVOKED, "whatsapp_stop_reply", {"message_id": msg.get("id")})
    await db.commit()
    return {"updated": updated}


# ------------------------------------------------------------------ Resend (Svix-signed)

RESEND_STATUS = {"email.sent": DeliveryStatus.SENT, "email.delivered": DeliveryStatus.DELIVERED, "email.bounced": DeliveryStatus.BOUNCED, "email.complained": DeliveryStatus.FAILED, "email.delivery_delayed": None}


@router.post("/resend")
async def resend_events(request: Request, db: DB):
    if not settings.resend_webhook_secret:
        raise AppError("Resend webhook secret not configured", code="integration_not_configured", status_code=503)
    body = await request.body()
    msg_id, ts, sigs = request.headers.get("svix-id", ""), request.headers.get("svix-timestamp", ""), request.headers.get("svix-signature", "")
    if not msg_id or not ts or abs(time.time() - int(ts or 0)) > 300:
        raise AppError("Invalid signature", code="invalid_signature", status_code=400)
    secret = base64.b64decode(settings.resend_webhook_secret.split("_", 1)[-1])
    expected = base64.b64encode(hmac.new(secret, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    if not any(hmac.compare_digest(expected, s.split(",", 1)[-1]) for s in sigs.split(" ")):
        raise AppError("Invalid signature", code="invalid_signature", status_code=400)
    import json

    evt = json.loads(body)
    if await db.scalar(select(WebhookEvent.id).where(WebhookEvent.provider == "resend", WebhookEvent.event_id == msg_id)):
        return {"status": "duplicate"}
    db.add(WebhookEvent(provider="resend", event_id=msg_id, event_type=evt.get("type", "unknown"), signature_valid=True, payload=evt, processed_at=now()))
    email_id = (evt.get("data") or {}).get("email_id")
    new = RESEND_STATUS.get(evt.get("type"))
    if email_id and new:
        delivery = await db.scalar(select(MessageDelivery).where(MessageDelivery.provider_message_id == email_id))
        if delivery:
            delivery.status = new
            delivery.events = [*delivery.events, {"at": now().isoformat(), "status": evt.get("type")}]
            req = await db.get(ReviewRequest, delivery.review_request_id) if delivery.review_request_id else None
            if req and new == DeliveryStatus.DELIVERED:
                req.delivered_at = req.delivered_at or now()
                if req.status == RequestStatus.SENT:
                    req.status = RequestStatus.DELIVERED
            elif req and new in (DeliveryStatus.BOUNCED, DeliveryStatus.FAILED):
                req.status, req.failed_reason, req.next_reminder_at = RequestStatus.FAILED, evt.get("type"), None
    await db.commit()
    return {"status": "ok"}
