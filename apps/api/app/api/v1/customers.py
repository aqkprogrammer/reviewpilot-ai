from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, or_, select

from app.core.deps import DB, OrgContext, require_perm
from app.core.errors import AppError, NotFound
from app.core.permissions import Perm
from app.core.security import now
from app.models import Customer, CustomerConsent, FeedbackSubmission, Location, MessageDelivery, ReviewRequest
from app.models.enums import ConsentStatus, ConsentType
from app.schemas.common import ORM, Page
from app.services import audit
from app.services.consent import consent_map, record_consent
from app.services.locations import scoped_location_filter

router = APIRouter(prefix="/customers", tags=["customers"])
PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def normalize_phone(value: str | None, country: str = "IN") -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^\d+]", "", value)
    if not digits.startswith("+"):
        digits = digits.lstrip("0")
        if country == "IN" and len(digits) == 10:
            digits = "+91" + digits
        else:
            digits = "+" + digits
    if not PHONE_RE.match(digits):
        raise ValueError("Enter a valid phone number with country code")
    return digits


class ConsentIn(BaseModel):
    whatsapp: bool = False
    email: bool = False
    sms: bool = False
    marketing: bool = False
    source: str = Field("manual", max_length=64)
    note: str | None = Field(None, max_length=500)


class CustomerIn(BaseModel):
    name: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    location_id: uuid.UUID | None = None
    tags: list[str] = []
    notes: str | None = Field(None, max_length=5000)
    preferred_language: str = Field("en", pattern="^(en|hi|hinglish)$")
    consent: ConsentIn | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_phone(v)

    @field_validator("tags")
    @classmethod
    def _tags(cls, v):
        return sorted({t.strip().lower()[:48] for t in v if t.strip()})[:20]


class CustomerUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = None
    location_id: uuid.UUID | None = None
    tags: list[str] | None = None
    notes: str | None = Field(None, max_length=5000)
    preferred_language: str | None = Field(None, pattern="^(en|hi|hinglish)$")

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_phone(v)

    @field_validator("tags")
    @classmethod
    def _tags(cls, v):
        return None if v is None else sorted({t.strip().lower()[:48] for t in v if t.strip()})[:20]


class CustomerOut(ORM):
    id: uuid.UUID
    name: str | None
    email: str | None
    phone: str | None
    location_id: uuid.UUID | None
    tags: list[str]
    notes: str | None
    source: str
    preferred_language: str
    opted_out_at: datetime | None
    last_contacted_at: datetime | None
    created_at: datetime
    consents: dict[str, bool] = {}
    request_count: int = 0


class TimelineItem(BaseModel):
    at: datetime
    kind: str
    title: str
    detail: str | None = None
    status: str | None = None


class CustomerDetail(CustomerOut):
    timeline: list[TimelineItem] = []
    consent_history: list[dict] = []


async def _get(db, ctx: OrgContext, customer_id: uuid.UUID) -> Customer:
    c = await db.get(Customer, customer_id)
    if c is None or c.organization_id != ctx.org_id or c.deleted_at is not None:
        raise NotFound("Customer not found")
    if c.location_id:
        ctx.ensure_location(c.location_id)
    return c


async def _validate_location(db, ctx: OrgContext, location_id: uuid.UUID | None) -> None:
    if location_id is None:
        return
    loc = await db.get(Location, location_id)
    if loc is None or loc.organization_id != ctx.org_id or loc.deleted_at is not None:
        raise AppError("Invalid location", code="invalid_location")
    ctx.ensure_location(location_id)


async def _apply_consent(db, ctx: OrgContext, customer: Customer, consent: ConsentIn, request: Request) -> None:
    evidence = {"ip": request.client.host if request.client else None, "recorded_via": "dashboard", "note": consent.note}
    for channel in ("whatsapp", "email", "sms"):
        if getattr(consent, channel):
            await record_consent(db, customer, channel, ConsentType.TRANSACTIONAL, ConsentStatus.GRANTED, consent.source, evidence, ctx.user.id)
            if consent.marketing:
                await record_consent(db, customer, channel, ConsentType.MARKETING, ConsentStatus.GRANTED, consent.source, evidence, ctx.user.id)


@router.get("", response_model=Page[CustomerOut])
async def list_customers(
    db: DB,
    ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    tag: str | None = None,
    location_id: uuid.UUID | None = None,
    consent: str | None = Query(None, pattern="^(whatsapp|email|sms|none)$"),
    opted_out: bool | None = None,
):
    conds = [Customer.organization_id == ctx.org_id, Customer.deleted_at.is_(None)]
    if ctx.location_ids is not None:
        conds.append(or_(Customer.location_id.is_(None), scoped_location_filter(ctx, Customer.location_id)))
    if q:
        like = f"%{q.strip()}%"
        conds.append(or_(Customer.name.ilike(like), Customer.email.ilike(like), Customer.phone.ilike(like)))
    if tag:
        conds.append(Customer.tags.any(tag.lower()))
    if location_id:
        conds.append(Customer.location_id == location_id)
    if opted_out is not None:
        conds.append(Customer.opted_out_at.is_not(None) if opted_out else Customer.opted_out_at.is_(None))
    total = await db.scalar(select(func.count()).select_from(Customer).where(*conds))
    customers = (await db.scalars(select(Customer).where(*conds).order_by(Customer.created_at.desc(), Customer.id).offset((page - 1) * page_size).limit(page_size))).all()
    ids = [c.id for c in customers]
    consents = await consent_map(db, ids)
    req_counts = dict((await db.execute(select(ReviewRequest.customer_id, func.count()).where(ReviewRequest.customer_id.in_(ids)).group_by(ReviewRequest.customer_id))).all()) if ids else {}
    items = []
    for c in customers:
        cm = consents.get(c.id, {})
        if consent == "none" and any(cm.values()):
            continue
        items.append(CustomerOut.model_validate(c).model_copy(update={"consents": cm, "request_count": req_counts.get(c.id, 0)}))
    if consent and consent != "none":
        items = [i for i in items if i.consents.get(consent)]
    return Page.build(items, total or 0, page, page_size)


@router.get("/tags", response_model=list[str])
async def list_tags(db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ))):
    rows = await db.scalars(select(func.unnest(Customer.tags)).where(Customer.organization_id == ctx.org_id, Customer.deleted_at.is_(None)).distinct())
    return sorted(rows.all())


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(data: CustomerIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    if not (data.email or data.phone):
        raise AppError("Provide an email or phone number.", code="contact_required")
    await _validate_location(db, ctx, data.location_id)
    c = Customer(organization_id=ctx.org_id, **data.model_dump(exclude={"consent"}), source="manual")
    db.add(c)
    await db.flush()
    if data.consent:
        await _apply_consent(db, ctx, c, data.consent, request)
    await audit.record(db, "customer.created", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=c.id, request=request)
    await db.commit()
    return CustomerOut.model_validate(c).model_copy(update={"consents": (await consent_map(db, [c.id])).get(c.id, {})})


@router.get("/export")
async def export_csv(request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    customers = (await db.scalars(select(Customer).where(Customer.organization_id == ctx.org_id, Customer.deleted_at.is_(None), or_(Customer.location_id.is_(None), scoped_location_filter(ctx, Customer.location_id))).order_by(Customer.created_at))).all()
    consents = await consent_map(db, [c.id for c in customers])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "email", "phone", "tags", "preferred_language", "consent_whatsapp", "consent_email", "consent_sms", "opted_out", "created_at"])
    for c in customers:
        cm = consents.get(c.id, {})
        w.writerow([c.name or "", c.email or "", c.phone or "", ";".join(c.tags), c.preferred_language, cm.get("whatsapp", False), cm.get("email", False), cm.get("sms", False), bool(c.opted_out_at), c.created_at.isoformat()])
    await audit.record(db, "customer.exported", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"count": len(customers)})
    await db.commit()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="customers-{now().date()}.csv"'})


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]


@router.post("/import", response_model=ImportResult)
async def import_csv(
    request: Request, db: DB, file: UploadFile = File(...), consent_confirmed: bool = Query(False, description="Confirm customers agreed to receive service messages"),
    location_id: uuid.UUID | None = None, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE)),
):
    """Columns: name,email,phone,tags,preferred_language. Consent is recorded only when the importer
    explicitly confirms it was collected — never inferred from contact details alone."""
    await _validate_location(db, ctx, location_id)
    raw = await file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise AppError("CSV must be under 5 MB", code="file_too_large")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppError("CSV must be UTF-8 encoded", code="invalid_csv")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or not ({"email", "phone"} & {f.strip().lower() for f in reader.fieldnames}):
        raise AppError("CSV needs at least an 'email' or 'phone' column.", code="invalid_csv")
    created = updated = skipped = 0
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        if i > 10_001:
            errors.append("Stopped after 10,000 rows")
            break
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        email = row.get("email") or None
        try:
            phone = normalize_phone(row.get("phone")) if row.get("phone") else None
        except ValueError:
            errors.append(f"Row {i}: invalid phone '{row.get('phone')}'")
            skipped += 1
            continue
        if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            errors.append(f"Row {i}: invalid email '{email}'")
            skipped += 1
            continue
        if not email and not phone:
            skipped += 1
            continue
        existing = await db.scalar(
            select(Customer).where(Customer.organization_id == ctx.org_id, Customer.deleted_at.is_(None), or_(Customer.email == email if email else False, Customer.phone == phone if phone else False))
        )
        tags = sorted({t.strip().lower() for t in (row.get("tags") or "").replace(",", ";").split(";") if t.strip()})
        lang = row.get("preferred_language") if row.get("preferred_language") in ("en", "hi", "hinglish") else "en"
        if existing:
            existing.name = existing.name or row.get("name") or None
            existing.tags = sorted(set(existing.tags) | set(tags))
            c = existing
            updated += 1
        else:
            c = Customer(organization_id=ctx.org_id, location_id=location_id, name=row.get("name") or None, email=email, phone=phone, tags=tags, preferred_language=lang, source="csv")
            db.add(c)
            await db.flush()
            created += 1
        if consent_confirmed:
            await _apply_consent(db, ctx, c, ConsentIn(whatsapp=bool(phone), sms=False, email=bool(email), source="csv_import", note=f"Confirmed by {ctx.user.email} at import"), request)
    await audit.record(db, "customer.imported", actor=ctx.user, organization_id=ctx.org_id, request=request, meta={"created": created, "updated": updated, "skipped": skipped, "consent_confirmed": consent_confirmed})
    await db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors[:50])


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(customer_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_READ))):
    c = await _get(db, ctx, customer_id)
    timeline: list[TimelineItem] = [TimelineItem(at=c.created_at, kind="created", title=f"Added via {c.source}")]
    reqs = (await db.scalars(select(ReviewRequest).where(ReviewRequest.customer_id == c.id).order_by(ReviewRequest.created_at.desc()).limit(50))).all()
    for r in reqs:
        timeline.append(TimelineItem(at=r.created_at, kind="review_request", title=f"Review request via {r.channel}", status=r.status, detail=r.failed_reason))
        if r.clicked_at:
            timeline.append(TimelineItem(at=r.clicked_at, kind="click", title="Opened feedback page"))
        if r.google_clicked_at:
            timeline.append(TimelineItem(at=r.google_clicked_at, kind="google_click", title="Clicked “Review on Google”"))
    deliveries = (await db.scalars(select(MessageDelivery).join(ReviewRequest, ReviewRequest.id == MessageDelivery.review_request_id).where(ReviewRequest.customer_id == c.id).order_by(MessageDelivery.created_at.desc()).limit(50))).all()
    for d in deliveries:
        timeline.append(TimelineItem(at=d.created_at, kind="message", title=f"{d.channel.title()} {'reminder' if d.is_reminder else 'message'} — {d.status}", detail=d.error_message, status=d.status))
    feedback = (await db.scalars(select(FeedbackSubmission).where(FeedbackSubmission.customer_id == c.id).order_by(FeedbackSubmission.created_at.desc()).limit(20))).all()
    for f in feedback:
        timeline.append(TimelineItem(at=f.created_at, kind="feedback", title="Left private feedback" + (f" ({f.rating}★)" if f.rating else ""), detail=f.message[:280]))
    if c.opted_out_at:
        timeline.append(TimelineItem(at=c.opted_out_at, kind="opt_out", title="Opted out of messages"))
    history = (await db.scalars(select(CustomerConsent).where(CustomerConsent.customer_id == c.id).order_by(CustomerConsent.created_at.desc()))).all()
    timeline.sort(key=lambda t: t.at, reverse=True)
    return CustomerDetail.model_validate(c).model_copy(
        update={
            "consents": (await consent_map(db, [c.id])).get(c.id, {}),
            "request_count": len(reqs),
            "timeline": timeline,
            "consent_history": [{"channel": h.channel, "type": h.consent_type, "status": h.status, "source": h.source, "at": h.created_at.isoformat()} for h in history],
        }
    )


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: uuid.UUID, data: CustomerUpdate, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    c = await _get(db, ctx, customer_id)
    changes = data.model_dump(exclude_unset=True)
    if "location_id" in changes:
        await _validate_location(db, ctx, changes["location_id"])
    for k, v in changes.items():
        setattr(c, k, v)
    await audit.record(db, "customer.updated", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=c.id, request=request, meta={"fields": list(changes)})
    await db.commit()
    return CustomerOut.model_validate(c).model_copy(update={"consents": (await consent_map(db, [c.id])).get(c.id, {})})


@router.post("/{customer_id}/consent", response_model=CustomerOut)
async def set_consent(customer_id: uuid.UUID, data: ConsentIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    c = await _get(db, ctx, customer_id)
    current = (await consent_map(db, [c.id])).get(c.id, {})
    evidence = {"recorded_via": "dashboard", "note": data.note}
    for channel in ("whatsapp", "email", "sms"):
        want = getattr(data, channel)
        if want != current.get(channel, False):
            await record_consent(db, c, channel, ConsentType.TRANSACTIONAL, ConsentStatus.GRANTED if want else ConsentStatus.REVOKED, data.source, evidence, ctx.user.id)
    await audit.record(db, "customer.consent_updated", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=c.id, request=request)
    await db.commit()
    return CustomerOut.model_validate(c).model_copy(update={"consents": (await consent_map(db, [c.id])).get(c.id, {})})


@router.post("/{customer_id}/opt-out", response_model=CustomerOut)
async def opt_out(customer_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    c = await _get(db, ctx, customer_id)
    c.opted_out_at = c.opted_out_at or now()
    for channel in ("whatsapp", "email", "sms"):
        await record_consent(db, c, channel, ConsentType.TRANSACTIONAL, ConsentStatus.REVOKED, "manual_opt_out", {}, ctx.user.id)
    await audit.record(db, "customer.opted_out", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=c.id, request=request)
    await db.commit()
    return CustomerOut.model_validate(c).model_copy(update={"consents": {}})


@router.get("/{customer_id}/data-export")
async def export_customer_data(customer_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    """Data-subject access request: everything stored about one customer, as JSON."""
    detail = await get_customer(customer_id, db, ctx)
    await audit.record(db, "customer.data_exported", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=customer_id, request=request)
    await db.commit()
    payload = detail.model_dump_json(indent=2)
    return StreamingResponse(iter([payload]), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="customer-{customer_id}.json"'})


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.CUSTOMERS_MANAGE))):
    """Erasure request: PII is scrubbed immediately; aggregate request counts remain anonymous."""
    c = await _get(db, ctx, customer_id)
    c.name = None
    c.email = None
    c.phone = None
    c.notes = None
    c.tags = []
    c.attributes = {}
    c.deleted_at = now()
    for f in (await db.scalars(select(FeedbackSubmission).where(FeedbackSubmission.customer_id == c.id))).all():
        f.name = f.email = f.phone = None
    await audit.record(db, "customer.erased", actor=ctx.user, organization_id=ctx.org_id, target_type="customer", target_id=c.id, request=request)
    await db.commit()
