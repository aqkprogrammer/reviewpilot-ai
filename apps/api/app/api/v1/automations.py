"""Automations API: post-visit review requests.

- API keys (integrations.manage) for inbound integrations (POS, booking tools, Zapier).
- `POST /automations/ingest/visits` — authenticated ONLY by API key (never by session), rate-limited per key.
- `POST /automations/visits` — staff record a visit from the dashboard (session auth, customers.manage).
- Rules CRUD (campaigns.manage), activity log + summary, Shopify order webhooks.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from sqlalchemy import func, or_, select

from app.api.v1.campaigns import TemplateIn
from app.api.v1.customers import normalize_phone
from app.core import ratelimit
from app.core.config import settings
from app.core.crypto import decrypt_json, encrypt_json, mask
from app.core.deps import DB, OrgContext, require_perm
from app.core.errors import AppError, Forbidden, NotFound, RateLimited, Unauthorized
from app.core.permissions import Perm
from app.core.security import now
from app.models import CampaignTemplate, Customer, IntegrationCredential, Location, Organization, ReviewRequest
from app.models.enums import IntegrationStatus, OrgStatus
from app.models.growth import ApiKey, AutomationRule, VisitEvent
from app.schemas.common import ORM, Page
from app.services import audit
from app.services import automations as svc
from app.services.jobs import enqueue
from app.services.locations import get_location, scoped_location_filter
from app.services.organizations import require_entitlement

router = APIRouter(prefix="/automations", tags=["automations"])

INGEST_PER_KEY_PER_MIN = 120
INGEST_PER_IP_PER_MIN = 600
SHOPIFY_TOPICS = {"orders/paid", "orders/fulfilled"}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_body(v: str | None) -> str | None:
    if v is not None:
        TemplateIn._body.__func__(TemplateIn, v)  # type: ignore[attr-defined]  # same rules as campaign templates
    return v


# ================================================================== API keys


class ApiKeyIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class ApiKeyOut(ORM):
    id: uuid.UUID
    name: str
    prefix: str
    scopes: list[str]
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ApiKeyCreated(BaseModel):
    key: ApiKeyOut
    secret: str  # shown once


@router.get("/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    rows = await db.scalars(select(ApiKey).where(ApiKey.organization_id == ctx.org_id).order_by(ApiKey.revoked_at.is_not(None), ApiKey.created_at.desc()))
    return rows.all()


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=201)
async def create_api_key(data: ApiKeyIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    active = await db.scalar(select(func.count()).select_from(ApiKey).where(ApiKey.organization_id == ctx.org_id, ApiKey.revoked_at.is_(None)))
    if (active or 0) >= svc.MAX_ACTIVE_KEYS:
        raise AppError(f"Up to {svc.MAX_ACTIVE_KEYS} active keys per organization. Revoke an unused key first.", code="api_key_limit")
    secret, prefix, key_hash = svc.generate_api_key()
    key = ApiKey(organization_id=ctx.org_id, name=data.name.strip(), prefix=prefix, key_hash=key_hash, scopes=list(svc.DEFAULT_SCOPES), created_by_id=ctx.user.id)
    db.add(key)
    await db.flush()
    await audit.record(db, "api_key.created", actor=ctx.user, organization_id=ctx.org_id, target_type="api_key", target_id=key.id, request=request, meta={"prefix": prefix, "name": key.name, "scopes": key.scopes})
    await db.commit()
    await db.refresh(key)
    return ApiKeyCreated(key=ApiKeyOut.model_validate(key), secret=secret)


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(key_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    key = await db.get(ApiKey, key_id)
    if key is None or key.organization_id != ctx.org_id:
        raise NotFound("API key not found")
    if key.revoked_at is None:
        key.revoked_at = now()
        await audit.record(db, "api_key.revoked", actor=ctx.user, organization_id=ctx.org_id, target_type="api_key", target_id=key.id, request=request, meta={"prefix": key.prefix, "name": key.name})
        await db.commit()


async def api_key_auth(request: Request, db: DB) -> ApiKey:
    """API-key authentication for integrations. Deliberately independent of session/JWT parsing."""
    allowed, _ = await ratelimit.hit(f"automations_ingest_ip:{ratelimit.client_ip(request)}", INGEST_PER_IP_PER_MIN, 60)
    if not allowed:
        raise RateLimited("Too many requests. Please slow down and try again shortly.")
    raw = (request.headers.get("x-api-key") or "").strip()
    auth = request.headers.get("authorization", "")
    if not raw and auth.lower().startswith("bearer "):
        raw = auth[7:].strip()
    if not raw:
        raise Unauthorized("Send your API key as `Authorization: Bearer rp_live_…` or `X-API-Key`.", code="api_key_required")
    key = await svc.authenticate_api_key(db, raw)
    if key is None:
        raise Unauthorized("Invalid or revoked API key.", code="invalid_api_key")
    if "visits:write" not in (key.scopes or []):
        raise Forbidden("This API key can't write visits.", code="insufficient_scope")
    org = await db.get(Organization, key.organization_id)
    if org is None or org.deleted_at is not None:
        raise Unauthorized("Invalid or revoked API key.", code="invalid_api_key")
    if org.status == OrgStatus.SUSPENDED:
        raise Forbidden("This organization is suspended.", code="org_suspended")
    allowed, _ = await ratelimit.hit(f"automations_ingest_key:{key.id}", INGEST_PER_KEY_PER_MIN, 60)
    if not allowed:
        raise RateLimited(f"Rate limit: {INGEST_PER_KEY_PER_MIN} visits per minute per API key.")
    key.last_used_at = now()
    return key


ApiKeyAuth = Annotated[ApiKey, Depends(api_key_auth)]


# ================================================================== visit ingestion


class CustomerIn(BaseModel):
    name: str | None = Field(None, max_length=200)
    phone: str | None = None
    email: EmailStr | None = None
    language: str | None = Field(None, pattern="^(en|hi|hinglish)$")

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_phone(v)


class ConsentIn(BaseModel):
    """Only `true` records a consent. `false`/missing never records anything (withdrawals come
    from opt-out links, STOP replies or the dashboard). `source` + `text` are stored as evidence."""

    whatsapp: bool | None = None
    email: bool | None = None
    sms: bool | None = None
    source: str = Field(min_length=2, max_length=48, description="Where consent was captured, e.g. pos_checkout, booking_form")
    text: str = Field(min_length=5, max_length=1000, description="The consent wording the customer agreed to")

    @property
    def granted(self) -> list[str]:
        return [c for c in ("whatsapp", "email", "sms") if getattr(self, c) is True]


class VisitIn(BaseModel):
    location_id: uuid.UUID | None = None
    location_slug: str | None = Field(None, max_length=96)
    external_id: str = Field(min_length=1, max_length=160, description="Your id for this visit/order — used for idempotency")
    occurred_at: datetime
    source: Literal["api", "zapier"] = "api"
    customer: CustomerIn
    consent: ConsentIn | None = None

    @model_validator(mode="after")
    def _check(self):
        if not (self.location_id or self.location_slug):
            raise ValueError("Provide location_id or location_slug")
        if not (self.customer.phone or self.customer.email):
            raise ValueError("Customer needs a phone or email")
        if self.occurred_at.tzinfo is None:
            self.occurred_at = self.occurred_at.replace(tzinfo=UTC)
        if self.occurred_at > now() + timedelta(days=1):
            raise ValueError("occurred_at is in the future")
        return self


class IngestOut(BaseModel):
    id: uuid.UUID
    status: str
    skip_reason: str | None
    scheduled_for: datetime | None
    rule_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    duplicate: bool


def _ingest_out(e: VisitEvent, duplicate: bool) -> IngestOut:
    return IngestOut(id=e.id, status=e.status, skip_reason=e.skip_reason, scheduled_for=e.scheduled_for, rule_id=e.rule_id, customer_id=e.customer_id, duplicate=duplicate)


async def _after_ingest(event: VisitEvent, created: bool) -> None:
    if created and svc.is_due_now(event):
        await enqueue("process_visit_event", organization_id=event.organization_id, visit_id=str(event.id))


@router.post("/ingest/visits", response_model=IngestOut, status_code=201, responses={200: {"description": "Duplicate external_id — the existing event"}})
async def ingest_visit(data: VisitIn, request: Request, response: Response, db: DB, key: ApiKeyAuth):
    org = await db.get(Organization, key.organization_id)
    stmt = select(Location).where(Location.organization_id == key.organization_id, Location.deleted_at.is_(None))
    stmt = stmt.where(Location.id == data.location_id) if data.location_id else stmt.where(Location.slug == data.location_slug)
    location = await db.scalar(stmt)
    if location is None:
        await db.commit()  # persist last_used_at
        raise NotFound("Location not found for this API key's organization.", code="location_not_found")
    consent = None
    if data.consent and data.consent.granted:
        consent = svc.ConsentData(
            channels=data.consent.granted, source=f"api:{data.consent.source}",
            evidence={
                "via": data.source, "api_key_prefix": key.prefix, "api_key_id": str(key.id), "source": data.consent.source,
                "text": data.consent.text, "external_id": data.external_id, "captured_at": data.occurred_at.isoformat(),
                "ip": ratelimit.client_ip(request),
            },
        )
    c = data.customer
    event, created = await svc.ingest_visit(
        db, org=org, location=location, source=data.source, external_id=data.external_id, occurred_at=data.occurred_at,
        customer_data=svc.CustomerData(name=c.name, phone=c.phone, email=str(c.email) if c.email else None, language=c.language),
        consent=consent, api_key=key, payload={"via": data.source},
    )
    await db.commit()
    if not created:
        response.status_code = 200
    await _after_ingest(event, created)
    return _ingest_out(event, not created)


class ManualConsentIn(BaseModel):
    whatsapp: bool = False
    email: bool = False
    sms: bool = False
    note: str | None = Field(None, max_length=500)


class ManualVisitIn(BaseModel):
    location_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    customer: CustomerIn | None = None
    occurred_at: datetime | None = None
    external_id: str | None = Field(None, max_length=160, description="Receipt / booking number (optional, dedupes)")
    consent: ManualConsentIn | None = None

    @model_validator(mode="after")
    def _check(self):
        if not self.customer_id and not (self.customer and (self.customer.phone or self.customer.email)):
            raise ValueError("Choose a customer or enter a phone or email")
        if self.occurred_at and self.occurred_at.tzinfo is None:
            self.occurred_at = self.occurred_at.replace(tzinfo=UTC)
        if self.occurred_at and self.occurred_at > now() + timedelta(minutes=5):
            raise ValueError("Visit time can't be in the future")
        return self


@router.post("/visits", response_model=IngestOut, status_code=201)
async def record_visit(data: ManualVisitIn, request: Request, response: Response, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    location = await get_location(db, ctx, data.location_id)
    existing_customer = None
    if data.customer_id:
        existing_customer = await db.get(Customer, data.customer_id)
        if existing_customer is None or existing_customer.organization_id != ctx.org_id or existing_customer.deleted_at is not None:
            raise NotFound("Customer not found")
    consent = None
    if data.consent:
        granted = [ch for ch in ("whatsapp", "email", "sms") if getattr(data.consent, ch)]
        if granted:
            consent = svc.ConsentData(
                channels=granted, source="in_person",
                evidence={"recorded_via": "automations.record_visit", "recorded_by": ctx.user.email, "note": data.consent.note, "ip": ratelimit.client_ip(request)},
            )
    c = data.customer or CustomerIn()
    external_id = data.external_id.strip() if data.external_id and data.external_id.strip() else f"manual-{uuid.uuid4().hex}"
    event, created = await svc.ingest_visit(
        db, org=ctx.organization, location=location, source="manual", external_id=external_id, occurred_at=data.occurred_at or now(),
        customer_data=svc.CustomerData(name=c.name, phone=c.phone, email=str(c.email) if c.email else None, language=c.language),
        consent=consent, actor=ctx.user, payload={"via": "dashboard"}, existing_customer=existing_customer,
    )
    if not created:
        response.status_code = 200
    await _after_ingest(event, created)
    return _ingest_out(event, not created)


# ================================================================== activity & summary


class VisitOut(BaseModel):
    id: uuid.UUID
    source: str
    external_id: str | None
    status: str
    skip_reason: str | None
    skip_label: str | None
    occurred_at: datetime
    scheduled_for: datetime | None
    created_at: datetime
    location_id: uuid.UUID
    location_name: str | None
    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_contact: str | None
    rule_id: uuid.UUID | None
    rule_name: str | None
    review_request_id: uuid.UUID | None
    channel: str | None
    request_status: str | None
    clicked_at: datetime | None
    google_clicked_at: datetime | None


@router.get("/visits", response_model=Page[VisitOut])
async def list_visits(
    db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ)), page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    status: str | None = None, source: str | None = None, location_id: uuid.UUID | None = None, rule_id: uuid.UUID | None = None,
    reason: str | None = None, q: str | None = Query(None, max_length=100),
):
    conds = [VisitEvent.organization_id == ctx.org_id, scoped_location_filter(ctx, VisitEvent.location_id)]
    if status:
        conds.append(VisitEvent.status == status)
    if source:
        conds.append(VisitEvent.source == source)
    if location_id:
        conds.append(VisitEvent.location_id == location_id)
    if rule_id:
        conds.append(VisitEvent.rule_id == rule_id)
    if reason:
        conds.append(VisitEvent.skip_reason == reason)
    base = (
        select(VisitEvent, Customer, Location.name, AutomationRule.name, ReviewRequest)
        .outerjoin(Customer, Customer.id == VisitEvent.customer_id)
        .outerjoin(Location, Location.id == VisitEvent.location_id)
        .outerjoin(AutomationRule, AutomationRule.id == VisitEvent.rule_id)
        .outerjoin(ReviewRequest, ReviewRequest.id == VisitEvent.review_request_id)
        .where(*conds)
    )
    if q:
        like = f"%{q}%"
        base = base.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.email.ilike(like), VisitEvent.external_id.ilike(like)))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.execute(base.order_by(VisitEvent.created_at.desc(), VisitEvent.id).offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        VisitOut(
            id=e.id, source=e.source, external_id=e.external_id, status=e.status, skip_reason=e.skip_reason,
            skip_label=svc.SKIP_REASONS.get(e.skip_reason or "") if e.skip_reason else None,
            occurred_at=e.occurred_at, scheduled_for=e.scheduled_for, created_at=e.created_at, location_id=e.location_id, location_name=lname,
            customer_id=e.customer_id, customer_name=cust.name if cust else None, customer_contact=(cust.phone or cust.email) if cust else None,
            rule_id=e.rule_id, rule_name=rname, review_request_id=e.review_request_id,
            channel=req.channel if req else (e.payload or {}).get("planned_channel"), request_status=req.status if req else None,
            clicked_at=req.clicked_at if req else None, google_clicked_at=req.google_clicked_at if req else None,
        )
        for e, cust, lname, rname, req in rows
    ]
    return Page.build(items, total or 0, page, page_size)


@router.get("/summary")
async def summary(db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ)), days: int = Query(7, ge=1, le=90)):
    since = now() - timedelta(days=days)
    scope = [VisitEvent.organization_id == ctx.org_id, scoped_location_filter(ctx, VisitEvent.location_id)]
    recent = [*scope, VisitEvent.created_at >= since]
    received, sent, skipped, failed = (
        await db.execute(
            select(
                func.count(), func.count().filter(VisitEvent.status == "sent"), func.count().filter(VisitEvent.status == "skipped"),
                func.count().filter(VisitEvent.status == "failed"),
            ).where(*recent)
        )
    ).one()
    scheduled, next_send = (await db.execute(select(func.count(), func.min(VisitEvent.scheduled_for)).where(*scope, VisitEvent.status.in_(("scheduled", "processing"))))).one()
    reasons = (await db.execute(select(VisitEvent.skip_reason, func.count()).where(*recent, VisitEvent.status.in_(("skipped", "failed"))).group_by(VisitEvent.skip_reason).order_by(func.count().desc()))).all()
    opens, gclicks = (
        await db.execute(
            select(func.count().filter(ReviewRequest.clicked_at.is_not(None)), func.count().filter(ReviewRequest.google_clicked_at.is_not(None)))
            .select_from(VisitEvent)
            .join(ReviewRequest, ReviewRequest.id == VisitEvent.review_request_id)
            .where(*recent)
        )
    ).one()
    last_visit = await db.scalar(select(func.max(VisitEvent.created_at)).where(*scope))
    rules_enabled = await db.scalar(select(func.count()).select_from(AutomationRule).where(AutomationRule.organization_id == ctx.org_id, AutomationRule.enabled.is_(True)))
    keys_active = await db.scalar(select(func.count()).select_from(ApiKey).where(ApiKey.organization_id == ctx.org_id, ApiKey.revoked_at.is_(None)))
    by_source = dict((await db.execute(select(VisitEvent.source, func.count()).where(*recent).group_by(VisitEvent.source))).all())
    return {
        "window_days": days, "received": received, "scheduled": scheduled, "sent": sent, "skipped": skipped, "failed": failed,
        "skipped_by_reason": [{"reason": r or "unknown", "label": svc.SKIP_REASONS.get(r or "", r or "Unknown"), "count": n} for r, n in reasons],
        "page_opens": opens, "google_clicks": gclicks, "next_send_at": next_send, "last_visit_at": last_visit, "by_source": by_source,
        "rules_enabled": rules_enabled or 0, "api_keys_active": keys_active or 0,
        "definitions": {
            "google_clicks": "Customers from these visits who clicked “Review on Google” on the feedback page — intent, not a confirmed review.",
            "received": f"Visit events created in the last {days} days (API, Zapier, Shopify or recorded manually).",
        },
    }


# ================================================================== rules


class QuietHours(BaseModel):
    start: int = Field(ge=0, le=23)
    end: int = Field(ge=0, le=23)


Channel = Literal["whatsapp", "email", "sms", "auto"]


class RuleIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    location_id: uuid.UUID | None = None
    channel: Channel = "auto"
    template_id: uuid.UUID | None = None
    message_body: str | None = Field(None, max_length=1500)
    delay_minutes: int = Field(120, ge=0, le=10080)
    quiet_hours: QuietHours | None = None
    cooldown_days: int = Field(30, ge=0, le=365)
    enabled: bool = True

    @field_validator("message_body")
    @classmethod
    def _body(cls, v):
        return _validate_body(v.strip() if v else None)

    @model_validator(mode="after")
    def _msg(self):
        if not (self.template_id or self.message_body):
            raise ValueError("Choose a template or write a message")
        return self


class RuleUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    location_id: uuid.UUID | None = None
    channel: Channel | None = None
    template_id: uuid.UUID | None = None
    message_body: str | None = Field(None, max_length=1500)
    delay_minutes: int | None = Field(None, ge=0, le=10080)
    quiet_hours: QuietHours | None = None
    cooldown_days: int | None = Field(None, ge=0, le=365)
    enabled: bool | None = None

    @field_validator("message_body")
    @classmethod
    def _body(cls, v):
        return _validate_body(v.strip() if v else None)


class RuleOut(ORM):
    id: uuid.UUID
    name: str
    location_id: uuid.UUID | None
    location_name: str | None = None
    channel: str
    template_id: uuid.UUID | None
    template_name: str | None = None
    message_body: str | None
    delay_minutes: int
    quiet_hours: dict
    cooldown_days: int
    enabled: bool
    created_at: datetime
    updated_at: datetime
    stats: dict = {}


async def _rule_stats(db, ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not ids:
        return {}
    since = now() - timedelta(days=7)
    rows = (
        await db.execute(
            select(
                VisitEvent.rule_id, func.count().filter(VisitEvent.created_at >= since), func.count().filter(VisitEvent.status == "sent", VisitEvent.created_at >= since),
                func.count().filter(VisitEvent.status == "skipped", VisitEvent.created_at >= since), func.count().filter(VisitEvent.status == "failed", VisitEvent.created_at >= since),
                func.count().filter(VisitEvent.status == "scheduled"),
            ).where(VisitEvent.rule_id.in_(ids)).group_by(VisitEvent.rule_id)
        )
    ).all()
    out = {r[0]: {"visits_7d": r[1], "sent_7d": r[2], "skipped_7d": r[3], "failed_7d": r[4], "scheduled": r[5]} for r in rows}
    empty = {"visits_7d": 0, "sent_7d": 0, "skipped_7d": 0, "failed_7d": 0, "scheduled": 0}
    return {i: out.get(i, empty) for i in ids}


async def _rule_out(db, rules: list[AutomationRule]) -> list[RuleOut]:
    stats = await _rule_stats(db, [r.id for r in rules])
    loc_ids = {r.location_id for r in rules if r.location_id}
    tpl_ids = {r.template_id for r in rules if r.template_id}
    locs = dict((await db.execute(select(Location.id, Location.name).where(Location.id.in_(loc_ids)))).all()) if loc_ids else {}
    tpls = dict((await db.execute(select(CampaignTemplate.id, CampaignTemplate.name).where(CampaignTemplate.id.in_(tpl_ids)))).all()) if tpl_ids else {}
    return [
        RuleOut.model_validate(r).model_copy(update={"location_name": locs.get(r.location_id), "template_name": tpls.get(r.template_id), "stats": stats.get(r.id, {})})
        for r in rules
    ]


async def _get_rule(db, ctx: OrgContext, rule_id: uuid.UUID) -> AutomationRule:
    rule = await db.get(AutomationRule, rule_id)
    if rule is None or rule.organization_id != ctx.org_id:
        raise NotFound("Rule not found")
    if rule.location_id is None and ctx.location_ids is not None:
        raise Forbidden("Only members with access to all locations can change organization-wide rules.", code="location_forbidden")
    if rule.location_id:
        ctx.ensure_location(rule.location_id)
    return rule


async def _validate_rule(db, ctx: OrgContext, *, location_id, channel: str, template_id, check_plan: bool = True) -> None:
    if location_id:
        await get_location(db, ctx, location_id)
    elif ctx.location_ids is not None:
        raise Forbidden("Choose one of your locations — organization-wide rules need access to all locations.", code="location_forbidden")
    if channel == "whatsapp" and check_plan:
        await require_entitlement(db, ctx.org_id, "whatsapp_campaigns", "WhatsApp review requests")
    if template_id:
        tpl = await db.get(CampaignTemplate, template_id)
        if tpl is None or tpl.deleted_at is not None or tpl.organization_id not in (None, ctx.org_id):
            raise AppError("Invalid template", code="invalid_template")
        if channel != "auto" and tpl.channel != channel:
            raise AppError(f"That template is for {tpl.channel}; pick a {channel} template.", code="template_channel_mismatch")


@router.get("/rules", response_model=list[RuleOut])
async def list_rules(db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    rows = (
        await db.scalars(
            select(AutomationRule)
            .where(AutomationRule.organization_id == ctx.org_id, or_(AutomationRule.location_id.is_(None), scoped_location_filter(ctx, AutomationRule.location_id)))
            .order_by(AutomationRule.location_id.is_(None), AutomationRule.created_at)
        )
    ).all()
    return await _rule_out(db, list(rows))


@router.post("/rules", response_model=RuleOut, status_code=201)
async def create_rule(data: RuleIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    await _validate_rule(db, ctx, location_id=data.location_id, channel=data.channel, template_id=data.template_id)
    rule = AutomationRule(
        organization_id=ctx.org_id, created_by_id=ctx.user.id, trigger="visit", **data.model_dump(exclude={"quiet_hours"}),
        quiet_hours=data.quiet_hours.model_dump() if data.quiet_hours else {},
    )
    db.add(rule)
    await db.flush()
    await audit.record(db, "automation_rule.created", actor=ctx.user, organization_id=ctx.org_id, target_type="automation_rule", target_id=rule.id, request=request, meta={"channel": rule.channel, "location_id": str(rule.location_id) if rule.location_id else None})
    await db.commit()
    await db.refresh(rule)
    return (await _rule_out(db, [rule]))[0]


@router.patch("/rules/{rule_id}", response_model=RuleOut)
async def update_rule(rule_id: uuid.UUID, data: RuleUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    rule = await _get_rule(db, ctx, rule_id)
    changes = data.model_dump(exclude_unset=True)

    def pick(k):
        return changes[k] if k in changes else getattr(rule, k)

    def pick_required(k):
        return getattr(rule, k) if changes.get(k) is None else changes[k]

    merged = {
        "name": pick_required("name"), "channel": pick_required("channel"), "delay_minutes": pick_required("delay_minutes"),
        "cooldown_days": pick_required("cooldown_days"), "enabled": pick_required("enabled"),
        "location_id": pick("location_id"), "template_id": pick("template_id"), "message_body": pick("message_body"),
        "quiet_hours": (changes["quiet_hours"] or {}) if "quiet_hours" in changes else rule.quiet_hours,
    }
    if not (merged["template_id"] or merged["message_body"]):
        raise AppError("Choose a template or write a message", code="validation_error", status_code=422)
    await _validate_rule(
        db, ctx, location_id=merged["location_id"], channel=merged["channel"], template_id=merged["template_id"],
        check_plan=merged["enabled"] and (merged["channel"] != rule.channel or not rule.enabled or "channel" in changes),
    )
    for k, v in merged.items():
        setattr(rule, k, v)
    await audit.record(db, "automation_rule.updated", actor=ctx.user, organization_id=ctx.org_id, target_type="automation_rule", target_id=rule.id, request=request, meta={"fields": sorted(data.model_dump(exclude_unset=True))})
    await db.commit()
    await db.refresh(rule)
    return (await _rule_out(db, [rule]))[0]


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CAMPAIGNS_MANAGE))):
    rule = await _get_rule(db, ctx, rule_id)
    await audit.record(db, "automation_rule.deleted", actor=ctx.user, organization_id=ctx.org_id, target_type="automation_rule", target_id=rule.id, request=request, meta={"name": rule.name})
    await db.delete(rule)
    await db.commit()


# ================================================================== Shopify


class ShopifyIn(BaseModel):
    webhook_secret: str | None = Field(None, min_length=16, max_length=256)
    location_id: uuid.UUID
    shop_domain: str | None = Field(None, max_length=255, pattern=r"^[a-z0-9][a-z0-9-]*\.myshopify\.com$")


def _webhook_url(org: Organization) -> str:
    return f"{settings.backend_url}/api/v1/automations/webhooks/shopify/{org.slug}"


async def _shopify_cred(db, org_id: uuid.UUID) -> IntegrationCredential | None:
    return await db.scalar(select(IntegrationCredential).where(IntegrationCredential.organization_id == org_id, IntegrationCredential.provider == "shopify"))


async def _shopify_out(db, ctx: OrgContext, cred: IntegrationCredential | None) -> dict:
    loc = await db.get(Location, uuid.UUID(cred.config["location_id"])) if cred and cred.config.get("location_id") else None
    secret = decrypt_json(cred.secrets_enc).get("webhook_secret") if cred else None
    return {
        "configured": bool(cred and secret),
        # "connected" only after Shopify delivered a correctly signed webhook.
        "status": cred.status if cred else IntegrationStatus.NOT_CONNECTED,
        "location_id": str(loc.id) if loc and loc.deleted_at is None else None,
        "location_name": loc.name if loc and loc.deleted_at is None else None,
        "shop_domain": cred.config.get("shop_domain") if cred else None,
        "secret_hint": mask(secret),
        "last_verified_at": cred.last_verified_at if cred else None,
        "last_error": cred.last_error if cred else None,
        "webhook_url": _webhook_url(ctx.organization),
        "topics": sorted(SHOPIFY_TOPICS),
    }


@router.get("/shopify")
async def get_shopify(db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    return await _shopify_out(db, ctx, await _shopify_cred(db, ctx.org_id))


@router.put("/shopify")
async def save_shopify(data: ShopifyIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    await get_location(db, ctx, data.location_id)
    cred = await _shopify_cred(db, ctx.org_id)
    secrets_ = decrypt_json(cred.secrets_enc) if cred else {}
    if not data.webhook_secret and not secrets_.get("webhook_secret"):
        raise AppError("Paste the webhook signing secret from Shopify.", code="secret_required", status_code=422)
    if cred is None:
        cred = IntegrationCredential(organization_id=ctx.org_id, provider="shopify", status=IntegrationStatus.PENDING, config={})
        db.add(cred)
    if data.webhook_secret and data.webhook_secret != secrets_.get("webhook_secret"):
        cred.secrets_enc = encrypt_json({"webhook_secret": data.webhook_secret.strip()})
        cred.status, cred.last_verified_at = IntegrationStatus.PENDING, None  # must be re-proven by a signed webhook
    cred.config = {"location_id": str(data.location_id), "shop_domain": data.shop_domain}
    cred.last_error = None
    await db.flush()
    await audit.record(db, "integration.shopify_saved", actor=ctx.user, organization_id=ctx.org_id, target_type="integration", target_id=cred.id, request=request, meta={"secret_changed": bool(data.webhook_secret), "location_id": str(data.location_id)})
    await db.commit()
    return await _shopify_out(db, ctx, cred)


@router.delete("/shopify", status_code=204)
async def delete_shopify(request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.INTEGRATIONS_MANAGE))):
    cred = await _shopify_cred(db, ctx.org_id)
    if cred is not None:
        await audit.record(db, "integration.shopify_removed", actor=ctx.user, organization_id=ctx.org_id, target_type="integration", target_id=cred.id, request=request)
        await db.delete(cred)
        await db.commit()


def _parse_time(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.post("/webhooks/shopify/{org_slug}")
async def shopify_webhook(org_slug: str, request: Request, db: DB):
    """Shopify order webhook (orders/paid, orders/fulfilled), verified with X-Shopify-Hmac-Sha256."""
    allowed, _ = await ratelimit.hit(f"shopify_webhook:{ratelimit.client_ip(request)}", 600, 60)
    if not allowed:
        raise RateLimited("Too many requests.")
    body = await request.body()
    org = await db.scalar(select(Organization).where(Organization.slug == org_slug[:80], Organization.deleted_at.is_(None)))
    cred = await _shopify_cred(db, org.id) if org else None
    secret = decrypt_json(cred.secrets_enc).get("webhook_secret") if cred else None
    # Unknown shop, missing config and bad signatures are indistinguishable to the caller.
    if not (org and secret and svc.verify_shopify_hmac(secret, body, request.headers.get("x-shopify-hmac-sha256"))):
        raise Unauthorized("Invalid webhook signature", code="invalid_signature")
    cred.status, cred.last_verified_at = IntegrationStatus.CONNECTED, now()
    topic = (request.headers.get("x-shopify-topic") or "").lower()
    if topic not in SHOPIFY_TOPICS:
        await db.commit()
        return {"ok": True, "ignored": "topic"}
    if org.status == OrgStatus.SUSPENDED:
        await db.commit()
        return {"ok": True, "ignored": "org_suspended"}
    try:
        order = json.loads(body)
    except ValueError:
        raise AppError("Invalid JSON", code="invalid_payload")
    if not isinstance(order, dict) or not order.get("id"):
        raise AppError("Order id missing", code="invalid_payload")
    loc_id = (cred.config or {}).get("location_id")
    location = await db.get(Location, uuid.UUID(loc_id)) if loc_id else None
    if location is None or location.deleted_at is not None or location.organization_id != org.id:
        cred.last_error = "Choose a location for Shopify orders in Automations → Connect."
        await db.commit()
        return {"ok": True, "ignored": "no_location"}
    cred.last_error = None

    info = svc.shopify_customer(order)
    try:
        phone = normalize_phone(info["phone"], location.country) if info["phone"] else None
    except ValueError:
        phone = None
    email = info["email"] if info["email"] and _EMAIL_RE.match(str(info["email"])) else None
    granted, revoked, evidence = svc.shopify_consent(order)
    evidence.update({"topic": topic, "shop_domain": request.headers.get("x-shopify-shop-domain"), "webhook_id": request.headers.get("x-shopify-webhook-id")})
    consent = svc.ConsentData(channels=granted, revoked=revoked, source="shopify", evidence=evidence) if (granted or revoked) else None
    occurred = _parse_time(order.get("processed_at")) or _parse_time(order.get("created_at")) or now()
    event, created = await svc.ingest_visit(
        db, org=org, location=location, source="shopify", external_id=str(order["id"])[:160], occurred_at=occurred,
        customer_data=svc.CustomerData(name=info["name"], phone=phone, email=email, language=info["language"]),
        consent=consent, payload={"topic": topic, "order_name": order.get("name"), "shop_domain": request.headers.get("x-shopify-shop-domain")},
    )
    await db.commit()
    await _after_ingest(event, created)
    return {"ok": True, "visit_id": str(event.id), "status": event.status, "skip_reason": event.skip_reason, "duplicate": not created}
