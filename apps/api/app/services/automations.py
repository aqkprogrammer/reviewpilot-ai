"""Post-visit automations: API keys, visit ingestion, rule matching, scheduling and sending.

Pipeline (one VisitEvent per real-world visit/order/appointment):

    ingest ──► upsert customer ──► record consent (only if explicitly provided)
           ──► match rule (location-specific beats org-wide)
           ──► eligibility (consent · opt-out · contact · cooldown · plan · channel)
           ──► scheduled_for = occurred_at + delay → shifted out of quiet hours (location tz)
    cron / inline ──► claim due event ──► re-check eligibility ──► ReviewRequest ──► send

Statuses: received → scheduled → processing → sent | skipped(reason) | failed(reason).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
import string
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_token, hash_token, now
from app.models import AuditLog, Customer, Location, Organization, ReviewRequest, User
from app.models.enums import ConsentStatus, ConsentType, RequestStatus
from app.models.growth import ApiKey, AutomationRule, VisitEvent
from app.services import audit
from app.services.campaigns import channel_status, send_review_request
from app.services.consent import can_message, consent_map, record_consent
from app.services.notify import notify_org
from app.services.organizations import has_entitlement

log = logging.getLogger("reviewpilot.automations")

API_KEY_PREFIX = "rp_live_"
_KEY_ALPHABET = string.ascii_letters + string.digits
DEFAULT_SCOPES = ["visits:write"]
MAX_ACTIVE_KEYS = 20
CHANNEL_ORDER = ("whatsapp", "email", "sms")  # "auto" preference
# A visit reported long after it happened shouldn't trigger a "how was your visit?" message.
MAX_VISIT_AGE = timedelta(days=14)
STALE_PROCESSING = timedelta(minutes=30)

SKIP_REASONS = {
    "no_matching_rule": "No enabled automation rule covers this location",
    "no_consent": "Customer hasn't consented on any eligible channel",
    "opted_out": "Customer opted out of messages",
    "no_phone": "No phone number for this channel",
    "no_email": "No email address for this channel",
    "no_contact": "No phone or email on the visit",
    "cooldown": "Customer already received a request within the cooldown window",
    "not_in_plan": "WhatsApp isn't included in the current plan",
    "channel_unavailable": "Channel isn't connected",
    "rule_disabled": "Rule was disabled before sending",
    "rule_removed": "Rule was deleted before sending",
    "visit_too_old": "Visit happened more than 14 days ago",
    "customer_deleted": "Customer record was erased",
}


# ------------------------------------------------------------------ API keys


def generate_api_key() -> tuple[str, str, str]:
    """Return (full secret, 8-char display prefix, sha256 hash). Only the hash is stored."""
    rand = "".join(secrets.choice(_KEY_ALPHABET) for _ in range(40))
    secret = API_KEY_PREFIX + rand
    return secret, rand[:8], hash_token(secret)


async def authenticate_api_key(db: AsyncSession, raw: str | None) -> ApiKey | None:
    if not raw or not raw.startswith(API_KEY_PREFIX) or len(raw) > 128:
        return None
    return await db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_token(raw), ApiKey.revoked_at.is_(None)))


# ------------------------------------------------------------------ scheduling math


def _zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "Asia/Kolkata")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("Asia/Kolkata")


def in_quiet_hours(hour: int, start: int, end: int) -> bool:
    """`start`..`end` are local hours; the window may wrap midnight (21 → 9)."""
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def apply_quiet_hours(when: datetime, quiet: dict | None, tz_name: str | None) -> datetime:
    """Shift `when` to the next allowed hour (the window's end, on the hour) in the location's timezone."""
    if not quiet or quiet.get("start") is None or quiet.get("end") is None:
        return when
    start, end = int(quiet["start"]), int(quiet["end"])
    local = when.astimezone(_zone(tz_name))
    if not in_quiet_hours(local.hour, start, end):
        return when
    target = local.replace(hour=end, minute=0, second=0, microsecond=0)
    if target <= local:
        target += timedelta(days=1)
    return target.astimezone(UTC)


def compute_schedule(occurred_at: datetime, delay_minutes: int, quiet: dict | None, tz_name: str | None, *, at: datetime | None = None) -> datetime:
    current = at or now()
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=UTC)
    base = occurred_at + timedelta(minutes=delay_minutes)
    if base < current:
        base = current
    return apply_quiet_hours(base, quiet, tz_name)


# ------------------------------------------------------------------ rules & eligibility


async def match_rule(db: AsyncSession, org_id: uuid.UUID, location_id: uuid.UUID) -> AutomationRule | None:
    """First enabled visit rule for the location; a location-specific rule beats an org-wide one."""
    return await db.scalar(
        select(AutomationRule)
        .where(
            AutomationRule.organization_id == org_id, AutomationRule.enabled.is_(True), AutomationRule.trigger == "visit",
            or_(AutomationRule.location_id == location_id, AutomationRule.location_id.is_(None)),
        )
        .order_by(AutomationRule.location_id.is_(None), AutomationRule.created_at, AutomationRule.id)
        .limit(1)
    )


async def in_cooldown(db: AsyncSession, customer_id: uuid.UUID, days: int, *, exclude_request: uuid.UUID | None = None) -> bool:
    if days <= 0:
        return False
    conds = [ReviewRequest.customer_id == customer_id, ReviewRequest.sent_at.is_not(None), ReviewRequest.sent_at >= now() - timedelta(days=days)]
    if exclude_request:
        conds.append(ReviewRequest.id != exclude_request)
    return bool(await db.scalar(select(func.count()).select_from(ReviewRequest).where(*conds)))


async def resolve_channel(db: AsyncSession, rule: AutomationRule, customer: Customer) -> tuple[str | None, str | None]:
    """Pick the channel for this customer, or explain why none can be used."""
    wa_ok = await has_entitlement(db, rule.organization_id, "whatsapp_campaigns")
    if rule.channel != "auto":
        if rule.channel == "whatsapp" and not wa_ok:
            return None, "not_in_plan"
        ok, reason = await can_message(db, customer, rule.channel)
        if not ok:
            return None, reason
        status = await channel_status(db, rule.organization_id, rule.channel)
        return (rule.channel, None) if status["ready"] else (None, "channel_unavailable")
    reasons: list[str | None] = []
    consented_but_unavailable = False
    for ch in CHANNEL_ORDER:
        if ch == "whatsapp" and not wa_ok:
            continue
        ok, reason = await can_message(db, customer, ch)
        if not ok:
            reasons.append(reason)
            continue
        if (await channel_status(db, rule.organization_id, ch))["ready"]:
            return ch, None
        consented_but_unavailable = True
    if "opted_out" in reasons or "customer_deleted" in reasons:
        return None, "opted_out" if "opted_out" in reasons else "customer_deleted"
    return None, "channel_unavailable" if consented_but_unavailable else "no_consent"


async def eligibility(db: AsyncSession, rule: AutomationRule, customer: Customer | None, *, exclude_request: uuid.UUID | None = None) -> tuple[str | None, str | None]:
    if customer is None:
        return None, "no_contact"
    if customer.deleted_at is not None:
        return None, "customer_deleted"
    if customer.opted_out_at is not None:
        return None, "opted_out"
    channel, reason = await resolve_channel(db, rule, customer)
    if channel is None:
        return None, reason
    if await in_cooldown(db, customer.id, rule.cooldown_days, exclude_request=exclude_request):
        return None, "cooldown"
    return channel, None


# ------------------------------------------------------------------ ingestion


@dataclass
class CustomerData:
    name: str | None = None
    phone: str | None = None  # already normalized to E.164
    email: str | None = None
    language: str | None = None


@dataclass
class ConsentData:
    channels: list[str] = field(default_factory=list)  # granted channels
    revoked: list[str] = field(default_factory=list)
    source: str = "api"
    evidence: dict = field(default_factory=dict)


async def upsert_customer(db: AsyncSession, org_id: uuid.UUID, location: Location, data: CustomerData, *, source: str) -> Customer | None:
    """Match an existing customer in the organization by phone, then email; otherwise create one."""
    if not (data.phone or data.email):
        return None
    base = select(Customer).where(Customer.organization_id == org_id, Customer.deleted_at.is_(None))
    customer = None
    if data.phone:
        customer = await db.scalar(base.where(Customer.phone == data.phone).order_by(Customer.created_at).limit(1))
    if customer is None and data.email:
        customer = await db.scalar(base.where(func.lower(Customer.email) == data.email.lower()).order_by(Customer.created_at).limit(1))
    if customer is None:
        customer = Customer(
            organization_id=org_id, location_id=location.id, name=data.name, phone=data.phone, email=data.email,
            source=source, preferred_language=data.language or "en", tags=[], attributes={},
        )
        db.add(customer)
        await db.flush()
        return customer
    # Fill gaps only — never overwrite what the business already has.
    if data.name and not customer.name:
        customer.name = data.name
    if data.phone and not customer.phone:
        customer.phone = data.phone
    if data.email and not customer.email:
        customer.email = data.email
    if data.language and customer.preferred_language == "en" and data.language != "en":
        customer.preferred_language = data.language
    if customer.location_id is None:
        customer.location_id = location.id
    return customer


async def apply_consent(db: AsyncSession, customer: Customer, consent: ConsentData | None, *, recorded_by_id: uuid.UUID | None = None) -> list[str]:
    """Record only what was explicitly provided. Returns the channels newly granted."""
    if consent is None or customer is None:
        return []
    granted = []
    for ch in consent.channels:
        await record_consent(db, customer, ch, ConsentType.TRANSACTIONAL, ConsentStatus.GRANTED, consent.source[:64], consent.evidence, recorded_by_id)
        granted.append(ch)
    if consent.revoked:
        current = (await consent_map(db, [customer.id])).get(customer.id, {})
        for ch in consent.revoked:
            if current.get(ch):
                await record_consent(db, customer, ch, ConsentType.TRANSACTIONAL, ConsentStatus.REVOKED, consent.source[:64], consent.evidence, recorded_by_id)
    return granted


async def find_existing(db: AsyncSession, org_id: uuid.UUID, source: str, external_id: str | None) -> VisitEvent | None:
    if not external_id:
        return None
    return await db.scalar(select(VisitEvent).where(VisitEvent.organization_id == org_id, VisitEvent.source == source, VisitEvent.external_id == external_id))


async def ingest_visit(
    db: AsyncSession, *, org: Organization, location: Location, source: str, external_id: str | None, occurred_at: datetime,
    customer_data: CustomerData, consent: ConsentData | None = None, api_key: ApiKey | None = None, actor: User | None = None,
    payload: dict | None = None, existing_customer: Customer | None = None,
) -> tuple[VisitEvent, bool]:
    """Create (or return the existing) visit event and schedule it. Commits. Returns (event, created)."""
    existing = await find_existing(db, org.id, source, external_id)
    if existing is not None:
        return existing, False

    customer = existing_customer or await upsert_customer(db, org.id, location, customer_data, source=source)
    if customer is not None:
        await apply_consent(db, customer, consent, recorded_by_id=actor.id if actor else None)

    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=UTC)
    event = VisitEvent(
        organization_id=org.id, location_id=location.id, customer_id=customer.id if customer else None, api_key_id=api_key.id if api_key else None,
        source=source, external_id=external_id, occurred_at=occurred_at, status="received", payload=payload or {},
    )
    rule = await match_rule(db, org.id, location.id)
    if rule is None:
        event.status, event.skip_reason = "skipped", "no_matching_rule"
    elif occurred_at < now() - MAX_VISIT_AGE:
        event.rule_id = rule.id
        event.status, event.skip_reason = "skipped", "visit_too_old"
    else:
        event.rule_id = rule.id
        channel, reason = await eligibility(db, rule, customer)
        if channel is None:
            event.status, event.skip_reason = "skipped", reason
        else:
            event.status = "scheduled"
            event.scheduled_for = compute_schedule(occurred_at, rule.delay_minutes, rule.quiet_hours, location.timezone)
            event.payload = {**event.payload, "planned_channel": channel}
    db.add(event)
    try:
        await db.flush()
    except IntegrityError:
        # A concurrent delivery of the same external id won the race.
        await db.rollback()
        again = await find_existing(db, org.id, source, external_id)
        if again is None:
            raise
        return again, False
    await audit.record(
        db, "visit.recorded", actor=actor, organization_id=org.id, target_type="visit_event", target_id=event.id,
        actor_type=None if actor else "integration", meta={"source": source, "api_key_prefix": api_key.prefix if api_key else None, "status": event.status},
    )
    await db.commit()
    await db.refresh(event)
    return event, True


def is_due_now(event: VisitEvent) -> bool:
    return event.status == "scheduled" and event.scheduled_for is not None and event.scheduled_for <= now()


# ------------------------------------------------------------------ processing


async def _finish(db: AsyncSession, event: VisitEvent, status: str, reason: str | None = None) -> dict:
    event.status, event.skip_reason = status, reason
    await db.commit()
    return {"visit_id": str(event.id), "status": status, "reason": reason}


async def process_visit(db: AsyncSession, visit_id: uuid.UUID) -> dict:
    """Send the review request for one due visit. Safe to call concurrently (atomic claim)."""
    claimed = (
        await db.execute(
            update(VisitEvent)
            .where(VisitEvent.id == visit_id, VisitEvent.status == "scheduled", VisitEvent.scheduled_for <= now())
            .values(status="processing")
            .returning(VisitEvent.id)
        )
    ).first()
    await db.commit()
    if not claimed:
        return {"visit_id": str(visit_id), "status": "not_due"}
    event = await db.get(VisitEvent, visit_id)
    await db.refresh(event)
    try:
        return await _send_for_visit(db, event)
    except Exception as exc:
        await db.rollback()
        event = await db.get(VisitEvent, visit_id)
        if event is not None and event.status == "processing":
            await _finish(db, event, "failed", f"internal_error: {type(exc).__name__}"[:64])
        raise


async def _send_for_visit(db: AsyncSession, event: VisitEvent) -> dict:
    rule = await db.get(AutomationRule, event.rule_id) if event.rule_id else None
    if rule is None:
        return await _finish(db, event, "skipped", "rule_removed")
    if not rule.enabled:
        return await _finish(db, event, "skipped", "rule_disabled")
    customer = await db.get(Customer, event.customer_id) if event.customer_id else None
    channel, reason = await eligibility(db, rule, customer)
    if channel is None:
        return await _finish(db, event, "skipped", reason)
    assert customer is not None

    req = ReviewRequest(
        organization_id=event.organization_id, location_id=event.location_id, campaign_id=None, customer_id=customer.id,
        channel=channel, tracking_token=generate_token(18), status=RequestStatus.QUEUED,
    )
    db.add(req)
    await db.flush()
    event.review_request_id = req.id
    await db.commit()

    ok = await send_review_request(db, req.id, body_override=rule.message_body, template_id=rule.template_id)
    await db.refresh(req)
    if ok:
        return await _finish(db, event, "sent")
    if req.status == RequestStatus.SKIPPED:
        return await _finish(db, event, "skipped", (req.failed_reason or "no_consent")[:64])
    result = await _finish(db, event, "failed", (req.failed_reason or "send_failed")[:64])
    await notify_failure(db, rule, event, req.failed_reason or "send_failed")
    return result


async def notify_failure(db: AsyncSession, rule: AutomationRule, event: VisitEvent, reason: str) -> bool:
    """`automation.failed` at most once per rule per 24h (deduplicated through the audit trail)."""
    since = now() - timedelta(days=1)
    already = await db.scalar(
        select(AuditLog.id)
        .where(AuditLog.organization_id == rule.organization_id, AuditLog.action == "automation.failure_notified", AuditLog.target_id == str(rule.id), AuditLog.created_at >= since)
        .limit(1)
    )
    if already:
        return False
    await notify_org(
        db, rule.organization_id, "automation.failed", f"Automation “{rule.name}” couldn't send a review request",
        f"Delivery failed ({reason[:120]}). Check the channel connection in Integrations. Further failures today won't notify again.",
        link="/app/automations?tab=activity", data={"rule_id": str(rule.id), "visit_id": str(event.id)},
    )
    await audit.record(db, "automation.failure_notified", organization_id=rule.organization_id, target_type="automation_rule", target_id=rule.id, actor_type="system", meta={"visit_id": str(event.id), "reason": reason[:200]})
    await db.commit()
    return True


async def due_visit_ids(db: AsyncSession, limit: int = 200) -> list[uuid.UUID]:
    rows = await db.scalars(
        select(VisitEvent.id).where(VisitEvent.status == "scheduled", VisitEvent.scheduled_for <= now()).order_by(VisitEvent.scheduled_for).limit(limit)
    )
    return list(rows.all())


async def recover_stale(db: AsyncSession) -> int:
    """Events stuck in `processing` (worker crash) are marked failed rather than re-sent blindly."""
    res = await db.execute(
        update(VisitEvent)
        .where(VisitEvent.status == "processing", VisitEvent.updated_at < now() - STALE_PROCESSING)
        .values(status="failed", skip_reason="interrupted")
        .returning(VisitEvent.id)
    )
    n = len(res.all())
    await db.commit()
    return n


# ------------------------------------------------------------------ Shopify (official order webhooks)


def verify_shopify_hmac(secret: str, body: bytes, header: str | None) -> bool:
    """`X-Shopify-Hmac-Sha256` is base64(HMAC-SHA256(app/webhook secret, raw body))."""
    if not secret or not header:
        return False
    expected = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, header.strip())


def _shop_lang(locale: str | None) -> str:
    return "hi" if (locale or "").lower().startswith("hi") else "en"


def shopify_customer(order: dict) -> dict:
    cust = order.get("customer") or {}
    billing = order.get("billing_address") or {}
    shipping = order.get("shipping_address") or {}
    name = " ".join(x for x in (cust.get("first_name"), cust.get("last_name")) if x) or billing.get("name") or shipping.get("name")
    return {
        "name": (name or None) and str(name)[:200],
        "email": order.get("email") or order.get("contact_email") or cust.get("email"),
        "phone": cust.get("phone") or order.get("phone") or billing.get("phone") or shipping.get("phone"),
        "language": _shop_lang(order.get("customer_locale")),
    }


def shopify_consent(order: dict) -> tuple[list[str], list[str], dict]:
    """Consent from Shopify's structured, timestamped consent records only.

    - `customer.email_marketing_consent.state == "subscribed"` → email
    - `customer.sms_marketing_consent.state == "subscribed"`   → sms
    These are explicit opt-ins the customer gave the shop (checkbox at checkout or a signup
    form), carry an opt-in level and timestamp, and cover the channel's commercial messages —
    a post-purchase review request is narrower than that. `unsubscribed`/`redacted` is treated
    as an explicit withdrawal. Nothing else is inferred: an email or phone on the order is not
    consent, the deprecated `buyer_accepts_marketing` boolean has no evidence attached, and SMS
    consent never implies WhatsApp (Meta requires a WhatsApp-specific opt-in).
    """
    cust = order.get("customer") or {}
    granted: list[str] = []
    revoked: list[str] = []
    evidence: dict = {"via": "shopify_webhook", "order_id": str(order.get("id")), "order_name": order.get("name")}
    for field_name, channel in (("email_marketing_consent", "email"), ("sms_marketing_consent", "sms")):
        rec = cust.get(field_name) or {}
        state = (rec.get("state") or "").lower()
        if state == "subscribed":
            granted.append(channel)
        elif state in ("unsubscribed", "redacted"):
            revoked.append(channel)
        if rec:
            evidence[field_name] = {k: rec.get(k) for k in ("state", "opt_in_level", "consent_updated_at", "consent_collected_from") if k in rec}
    return granted, revoked, evidence
