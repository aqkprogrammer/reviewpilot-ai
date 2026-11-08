"""Campaign engine: audience resolution, consent checks, rendering, delivery, reminders, stats."""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_json
from app.core.security import generate_token, now
from app.models import (
    Campaign,
    CampaignTemplate,
    Customer,
    IntegrationCredential,
    Location,
    MessageDelivery,
    Organization,
    QRCode,
    QRScan,
    ReviewRequest,
)
from app.models.enums import CampaignStatus, Channel, DeliveryStatus, IntegrationStatus, RequestStatus
from app.providers.email import ResendProvider, get_email_provider
from app.providers.messaging import MockAdapter, SendResult, TwilioSMSAdapter, WhatsAppCloudAdapter
from app.services import email_templates
from app.services.consent import can_message
from app.services.notify import notify_org

log = logging.getLogger("reviewpilot.campaigns")


def tracked_link(location: Location, token: str) -> str:
    return f"{settings.frontend_url}/r/{location.slug}?t={token}"


def unsubscribe_link(location: Location, token: str) -> str:
    return f"{settings.frontend_url}/r/{location.slug}/unsubscribe?t={token}"


def render(body: str, *, customer: Customer | None, org: Organization, location: Location, link: str) -> str:
    name = (customer.name.split(" ")[0] if customer and customer.name else "there")
    return (
        body.replace("{{name}}", name)
        .replace("{{business}}", org.name)
        .replace("{{location}}", location.name)
        .replace("{{link}}", link)
    )


async def channel_status(db: AsyncSession, org_id: uuid.UUID, channel: str) -> dict:
    """Describe whether a channel can deliver for real, in demo simulation, or not at all."""
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == org_id, IntegrationCredential.provider == channel))
    if channel == Channel.QR:
        return {"channel": channel, "mode": "live", "ready": True}
    if channel == Channel.WHATSAPP:
        if cred and cred.status == IntegrationStatus.CONNECTED:
            return {"channel": channel, "mode": "live", "ready": True}
        if settings.whatsapp_platform_configured:
            return {"channel": channel, "mode": "live", "ready": True, "note": "Using platform WhatsApp number"}
    if channel == Channel.EMAIL and settings.resend_configured:
        return {"channel": channel, "mode": "live", "ready": True}
    if channel == Channel.SMS and settings.twilio_account_sid and settings.twilio_auth_token:
        return {"channel": channel, "mode": "live", "ready": True}
    if settings.demo_mode:
        return {"channel": channel, "mode": "simulated", "ready": True, "note": "Demo mode — messages are simulated, nothing is sent"}
    return {"channel": channel, "mode": "unavailable", "ready": False, "note": f"Connect {channel} in Integrations to send"}


async def _adapter(db: AsyncSession, org_id: uuid.UUID, channel: str):
    cred = await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == org_id, IntegrationCredential.provider == channel))
    if channel == Channel.WHATSAPP:
        if cred and cred.status == IntegrationStatus.CONNECTED:
            secrets_ = decrypt_json(cred.secrets_enc)
            return WhatsAppCloudAdapter(secrets_.get("access_token", ""), cred.config.get("phone_number_id", ""))
        if settings.whatsapp_platform_configured:
            return WhatsAppCloudAdapter(settings.whatsapp_access_token or "", settings.whatsapp_phone_number_id or "")
    if channel == Channel.SMS and settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number:
        return TwilioSMSAdapter(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number)
    if settings.demo_mode:
        return MockAdapter(channel)
    return None


async def resolve_audience(db: AsyncSession, campaign: Campaign) -> list[Customer]:
    aud = campaign.audience or {}
    stmt = select(Customer).where(Customer.organization_id == campaign.organization_id, Customer.deleted_at.is_(None))
    if aud.get("customer_ids"):
        stmt = stmt.where(Customer.id.in_([uuid.UUID(c) for c in aud["customer_ids"]]))
    elif aud.get("tags"):
        stmt = stmt.where(Customer.tags.overlap(aud["tags"]))
    if aud.get("location_only", True):
        stmt = stmt.where((Customer.location_id == campaign.location_id) | Customer.location_id.is_(None))
    return list((await db.scalars(stmt.limit(5000))).all())


async def process_campaign(db: AsyncSession, campaign_id: uuid.UUID) -> dict:
    """Create review requests for the audience and dispatch them. Idempotent per customer."""
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None or campaign.status != CampaignStatus.ACTIVE or campaign.channel == Channel.QR:
        return {"skipped": True}
    customers = await resolve_audience(db, campaign)
    existing = set((await db.scalars(select(ReviewRequest.customer_id).where(ReviewRequest.campaign_id == campaign.id))).all())
    created = skipped = 0
    new_ids: list[uuid.UUID] = []
    for c in customers:
        if c.id in existing:
            continue
        ok, reason = await can_message(db, c, campaign.channel)
        req = ReviewRequest(
            organization_id=campaign.organization_id, location_id=campaign.location_id, campaign_id=campaign.id, customer_id=c.id,
            channel=campaign.channel, tracking_token=generate_token(18),
            status=RequestStatus.QUEUED if ok else RequestStatus.SKIPPED, failed_reason=None if ok else reason,
        )
        db.add(req)
        await db.flush()
        if ok:
            created += 1
            new_ids.append(req.id)
        else:
            skipped += 1
    await db.commit()
    sent = failed = 0
    for rid in new_ids:
        result = await send_review_request(db, rid)
        sent += int(result)
        failed += int(not result)
    campaign = await db.get(Campaign, campaign_id)
    if campaign and not campaign.reminder_enabled:
        campaign.status = CampaignStatus.COMPLETED
        campaign.completed_at = now()
    if campaign:
        campaign.stats = await campaign_stats(db, campaign)
        org_id = campaign.organization_id
        if failed and failed >= max(1, (sent + failed) // 2):
            await notify_org(db, org_id, "campaign.failed", f"Campaign “{campaign.name}” had delivery failures", f"{failed} of {sent + failed} messages failed. Check integration settings.", link=f"/app/campaigns/{campaign.id}")
        elif campaign.status == CampaignStatus.COMPLETED:
            await notify_org(db, org_id, "campaign.completed", f"Campaign “{campaign.name}” completed", f"{sent} sent, {skipped} skipped (no consent or opted out).", link=f"/app/campaigns/{campaign.id}", send_email=False)
    await db.commit()
    return {"created": created, "skipped": skipped, "sent": sent, "failed": failed}


async def send_review_request(db: AsyncSession, request_id: uuid.UUID, *, is_reminder: bool = False) -> bool:
    req = await db.get(ReviewRequest, request_id)
    if req is None:
        return False
    customer = await db.get(Customer, req.customer_id) if req.customer_id else None
    location = await db.get(Location, req.location_id)
    org = await db.get(Organization, req.organization_id)
    campaign = await db.get(Campaign, req.campaign_id) if req.campaign_id else None
    if not (customer and location and org):
        req.status, req.failed_reason = RequestStatus.FAILED, "missing_data"
        await db.commit()
        return False
    ok, reason = await can_message(db, customer, req.channel)
    if not ok:
        req.status, req.failed_reason, req.next_reminder_at = RequestStatus.SKIPPED, reason, None
        await db.commit()
        return False

    template = await db.get(CampaignTemplate, campaign.template_id) if campaign and campaign.template_id else None
    body_tpl = (campaign.message_body if campaign and campaign.message_body else None) or (template.body if template else None) or (
        "Hi {{name}}, thank you for visiting {{business}}! We'd value your honest feedback: {{link}}"
    )
    link = tracked_link(location, req.tracking_token)
    body = render(body_tpl, customer=customer, org=org, location=location, link=link)
    recipient = customer.email if req.channel == Channel.EMAIL else customer.phone or ""

    result: SendResult
    if req.channel == Channel.EMAIL:
        provider = get_email_provider()
        subject = render((campaign.message_subject if campaign else None) or (template.subject if template else None) or f"How was your visit to {org.name}?", customer=customer, org=org, location=location, link=link)
        html, text = email_templates.review_request(business=org.name, customer_name=customer.name, message=body.replace(link, "").strip(), link=link, unsubscribe_url=unsubscribe_link(location, req.tracking_token), color=org.brand_color)
        if not isinstance(provider, ResendProvider) and not settings.demo_mode:
            result = SendResult(False, "none", error_code="not_configured", error_message="Email provider not configured")
        else:
            er = await provider.send(to=recipient, subject=subject, html=html, text=text, headers={"List-Unsubscribe": f"<{unsubscribe_link(location, req.tracking_token)}>"})
            result = SendResult(er.ok, "resend" if er.provider == "resend" else "mock", er.message_id, "sent" if er.provider == "resend" else "delivered", None if er.ok else "send_failed", er.error)
    else:
        adapter = await _adapter(db, org.id, req.channel)
        if adapter is None:
            result = SendResult(False, "none", error_code="not_configured", error_message=f"{req.channel} is not connected")
        else:
            wa_template = None
            if req.channel == Channel.WHATSAPP:
                tpl_name = (template.provider_template_name if template else None) or ((campaign.audience or {}) if campaign else {}).get("wa_template")
                wa_template = {"name": tpl_name or "review_request", "language": "hi" if customer.preferred_language == "hi" else "en", "params": [(customer.name or "there").split(" ")[0], org.name, link]}
            result = await adapter.send(to=recipient, body=body, template=wa_template)

    delivery = MessageDelivery(
        organization_id=org.id, review_request_id=req.id, channel=req.channel, provider=result.provider, provider_message_id=result.message_id,
        recipient=recipient, status=(result.status if result.ok else DeliveryStatus.FAILED), error_code=result.error_code,
        error_message=result.error_message, attempt=req.reminders_sent + 1, is_reminder=is_reminder,
        events=[{"at": now().isoformat(), "status": result.status if result.ok else "failed", "simulated": result.provider == "mock"}],
    )
    db.add(delivery)
    if result.ok:
        req.status = RequestStatus.DELIVERED if result.status == "delivered" else RequestStatus.SENT
        req.sent_at = req.sent_at or now()
        if result.status == "delivered":
            req.delivered_at = req.delivered_at or now()
        customer.last_contacted_at = now()
        if is_reminder:
            req.reminders_sent += 1
        if campaign and campaign.reminder_enabled and req.reminders_sent < campaign.max_reminders:
            req.next_reminder_at = now() + timedelta(hours=campaign.reminder_after_hours)
        else:
            req.next_reminder_at = None
    else:
        req.status = RequestStatus.FAILED if not is_reminder else req.status
        req.failed_reason = result.error_message or result.error_code
        req.next_reminder_at = None
    await db.commit()
    return result.ok


async def due_reminders(db: AsyncSession, limit: int = 200) -> list[uuid.UUID]:
    rows = await db.scalars(
        select(ReviewRequest.id)
        .join(Campaign, Campaign.id == ReviewRequest.campaign_id)
        .where(
            ReviewRequest.next_reminder_at.is_not(None), ReviewRequest.next_reminder_at <= now(),
            ReviewRequest.clicked_at.is_(None), Campaign.status == CampaignStatus.ACTIVE,
        )
        .limit(limit)
    )
    return list(rows.all())


async def campaign_stats(db: AsyncSession, campaign: Campaign) -> dict:
    if campaign.channel == Channel.QR:
        qr_ids = (await db.scalars(select(QRCode.id).where(QRCode.campaign_id == campaign.id))).all()
        scans = await db.scalar(select(func.count()).select_from(QRScan).where(QRScan.qr_code_id.in_(qr_ids))) if qr_ids else 0
        return {"requests": 0, "sent": 0, "delivered": 0, "failed": 0, "skipped": 0, "clicks": scans or 0, "google_clicks": 0, "scans": scans or 0, "conversion_rate": None}
    row = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(ReviewRequest.sent_at.is_not(None)),
                func.count().filter(ReviewRequest.delivered_at.is_not(None)),
                func.count().filter(ReviewRequest.status == RequestStatus.FAILED),
                func.count().filter(ReviewRequest.status == RequestStatus.SKIPPED),
                func.count().filter(ReviewRequest.clicked_at.is_not(None)),
                func.count().filter(ReviewRequest.google_clicked_at.is_not(None)),
            ).where(ReviewRequest.campaign_id == campaign.id)
        )
    ).one()
    total, sent, delivered, failed, skipped, clicks, gclicks = row
    return {
        "requests": total, "sent": sent, "delivered": delivered, "failed": failed, "skipped": skipped,
        "clicks": clicks, "google_clicks": gclicks,
        # Definition: share of sent requests where the customer clicked through to Google.
        "conversion_rate": round(gclicks / sent, 4) if sent else None,
    }
