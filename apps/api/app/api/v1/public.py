"""Unauthenticated endpoints: public feedback page, tracking, unsubscribe, contact form, plans.

Policy: the Google review option is shown to *every* visitor regardless of rating or feedback
(no review gating), and nothing here incentivises reviews."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, select

from app.core.deps import DB
from app.core.errors import AppError, NotFound
from app.core.ratelimit import client_ip, hit, limiter
from app.core.security import now
from app.models import ContactMessage, Customer, FeedbackSubmission, Location, Organization, QRCode, ReviewRequest
from app.models.enums import ConsentStatus, ConsentType, OrgStatus, RequestStatus
from app.providers.ai import heuristic_sentiment
from app.schemas.common import Message
from app.services import white_label
from app.services.consent import record_consent
from app.services.locations import review_url
from app.services.notify import notify_org

router = APIRouter(prefix="/public", tags=["public"])

DEFAULT_COPY = {
    "en": {
        "headline": "How was your experience?",
        "subheadline": "Your honest feedback helps us improve. It only takes a minute.",
        "google_cta": "Leave a public review on Google",
        "google_note": "You're welcome to share your experience publicly on Google — positive or negative.",
        "private_title": "Or send feedback directly to the team",
        "private_note": "Private feedback goes only to the business. It is not posted on Google.",
    },
    "hi": {
        "headline": "आपका अनुभव कैसा रहा?",
        "subheadline": "आपकी ईमानदार राय हमें बेहतर बनने में मदद करती है। इसमें केवल एक मिनट लगेगा।",
        "google_cta": "Google पर सार्वजनिक समीक्षा लिखें",
        "google_note": "आप Google पर अपना अनुभव सार्वजनिक रूप से साझा कर सकते हैं — सकारात्मक या नकारात्मक।",
        "private_title": "या सीधे टीम को अपनी राय भेजें",
        "private_note": "निजी प्रतिक्रिया केवल व्यवसाय तक जाती है। यह Google पर पोस्ट नहीं होती।",
    },
}


class PublicLocation(BaseModel):
    business_name: str
    location_name: str
    slug: str
    logo_url: str | None
    brand_color: str
    address: str | None
    phone: str | None
    website: str | None
    industry: str
    has_google_link: bool
    languages: list[str]
    default_language: str
    content: dict[str, dict[str, str]]
    is_demo: bool
    show_attribution: bool = True
    footer_text: str | None = None


async def _location(db, slug: str) -> tuple[Location, Organization]:
    row = (
        await db.execute(
            select(Location, Organization).join(Organization, Organization.id == Location.organization_id).where(
                Location.slug == slug, Location.deleted_at.is_(None), Location.is_active.is_(True), Organization.deleted_at.is_(None), Organization.status == OrgStatus.ACTIVE
            )
        )
    ).first()
    if row is None:
        raise NotFound("This feedback page is not available.")
    return row[0], row[1]


async def _request_for(db, loc: Location, token: str | None) -> ReviewRequest | None:
    if not token:
        return None
    req = await db.scalar(select(ReviewRequest).where(ReviewRequest.tracking_token == token))
    return req if req and req.location_id == loc.id else None


@router.get("/locations/{slug}", response_model=PublicLocation, dependencies=[Depends(limiter("public-loc", 120, 60))])
async def get_public_location(slug: str, db: DB, t: str | None = Query(None, max_length=64)):
    loc, org = await _location(db, slug)
    req = await _request_for(db, loc, t)
    if req and req.clicked_at is None:
        req.clicked_at = now()
        if req.status in (RequestStatus.SENT, RequestStatus.DELIVERED, RequestStatus.QUEUED):
            req.status = RequestStatus.CLICKED
        req.next_reminder_at = None  # they engaged — no reminder
        await db.commit()
    wl = await white_label.effective(db, org)
    custom = loc.feedback_page or {}
    copy = {lang: {**DEFAULT_COPY[lang], **(custom.get("copy", {}).get(lang, {}))} for lang in DEFAULT_COPY}
    address = ", ".join(p for p in [loc.address_line, loc.city, loc.state] if p) or None
    return PublicLocation(
        business_name=org.name, location_name=loc.name, slug=loc.slug, logo_url=org.logo_url, brand_color=org.brand_color, address=address,
        phone=loc.phone or org.phone, website=org.website, industry=org.industry, has_google_link=review_url(loc) is not None,
        languages=["en", "hi"], default_language=org.default_language if org.default_language in ("en", "hi") else "en", content=copy, is_demo=org.is_demo,
        show_attribution=not wl["hide_attribution"], footer_text=wl["footer_text"],
    )


class GoogleClickIn(BaseModel):
    t: str | None = Field(None, max_length=64)
    qr: str | None = Field(None, max_length=16)


@router.post("/locations/{slug}/google-click", dependencies=[Depends(limiter("public-gclick", 30, 60))])
async def google_click(slug: str, data: GoogleClickIn, db: DB):
    """Return the Google review link and count the click (measurable intent, not a confirmed review)."""
    loc, _ = await _location(db, slug)
    url = review_url(loc)
    if not url:
        raise NotFound("This business hasn't added its Google review link yet.")
    req = await _request_for(db, loc, data.t)
    if req and req.google_clicked_at is None:
        req.google_clicked_at = now()
        req.clicked_at = req.clicked_at or now()
        req.next_reminder_at = None
        await db.commit()
    return {"url": url}


class FeedbackIn(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    message: str = Field(min_length=3, max_length=3000)
    name: str | None = Field(None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=32)
    consent_contact: bool = False
    privacy_accepted: bool
    language: str = Field("en", pattern="^(en|hi)$")
    t: str | None = Field(None, max_length=64)
    qr: str | None = Field(None, max_length=16)
    website: str | None = Field(None, max_length=200)  # honeypot: humans never fill this
    elapsed_ms: int | None = Field(None, ge=0)

    @field_validator("privacy_accepted")
    @classmethod
    def _privacy(cls, v):
        if not v:
            raise ValueError("Please accept the privacy notice to send feedback")
        return v


@router.post("/locations/{slug}/feedback", response_model=Message, status_code=201, dependencies=[Depends(limiter("public-feedback", 10, 600))])
async def submit_feedback(slug: str, data: FeedbackIn, request: Request, db: DB):
    loc, org = await _location(db, slug)
    # Spam protection: honeypot, implausibly fast submissions, per-location burst limit.
    if data.website or (data.elapsed_ms is not None and data.elapsed_ms < 2500):
        return Message(message="Thank you for your feedback.")
    allowed, _ = await hit(f"feedback-loc:{loc.id}", 60, 600)
    if not allowed:
        raise AppError("We're receiving a lot of feedback right now. Please try again in a few minutes.", code="rate_limited", status_code=429)
    req = await _request_for(db, loc, data.t)
    qr = await db.scalar(select(QRCode).where(QRCode.code == data.qr, QRCode.location_id == loc.id)) if data.qr else None
    customer = await db.get(Customer, req.customer_id) if req and req.customer_id else None
    phone = None
    if data.phone:
        from app.api.v1.customers import normalize_phone

        try:
            phone = normalize_phone(data.phone)
        except ValueError:
            raise AppError("Enter a valid phone number", code="validation_error", status_code=422)
    if customer is None and (data.email or phone):
        customer = await db.scalar(
            select(Customer).where(Customer.organization_id == org.id, Customer.deleted_at.is_(None), or_(Customer.email == data.email if data.email else False, Customer.phone == phone if phone else False))
        )
        if customer is None:
            customer = Customer(organization_id=org.id, location_id=loc.id, name=data.name, email=data.email, phone=phone, source="feedback", preferred_language=data.language)
            db.add(customer)
            await db.flush()
    if customer is not None and data.consent_contact:
        evidence = {"ip": client_ip(request), "user_agent": (request.headers.get("user-agent") or "")[:300], "text": "I agree to be contacted about my feedback.", "at": now().isoformat()}
        for channel, present in (("email", bool(data.email)), ("whatsapp", bool(phone))):
            if present:
                await record_consent(db, customer, channel, ConsentType.TRANSACTIONAL, ConsentStatus.GRANTED, "feedback_form", evidence)
    sentiment, _, topics = heuristic_sentiment(data.message, data.rating)
    channel = "qr" if qr else (req.channel if req else "direct")
    fb = FeedbackSubmission(
        organization_id=org.id, location_id=loc.id, customer_id=customer.id if customer else None, review_request_id=req.id if req else None,
        qr_code_id=qr.id if qr else None, rating=data.rating, message=data.message.strip(), name=data.name, email=data.email, phone=phone,
        language=data.language, consent_contact=data.consent_contact, sentiment=sentiment, channel=channel, meta={"topics": topics},
    )
    db.add(fb)
    await notify_org(db, org.id, "feedback.new", f"New private feedback — {loc.name}", (f"{data.rating}★ · " if data.rating else "") + data.message[:140], link="/app/reviews?tab=feedback", send_email=(data.rating or 5) <= 2)
    await db.commit()
    return Message(message="Thank you for your feedback.")


class UnsubscribeIn(BaseModel):
    t: str = Field(min_length=8, max_length=64)


@router.post("/unsubscribe", response_model=Message, dependencies=[Depends(limiter("unsubscribe", 20, 600))])
async def unsubscribe(data: UnsubscribeIn, request: Request, db: DB):
    req = await db.scalar(select(ReviewRequest).where(ReviewRequest.tracking_token == data.t))
    if req is None or req.customer_id is None:
        return Message(message="You have been unsubscribed.")
    customer = await db.get(Customer, req.customer_id)
    if customer and customer.opted_out_at is None:
        customer.opted_out_at = now()
        for channel in ("whatsapp", "email", "sms"):
            await record_consent(db, customer, channel, ConsentType.TRANSACTIONAL, ConsentStatus.REVOKED, "opt_out_link", {"ip": client_ip(request)})
        await db.commit()
    return Message(message="You have been unsubscribed.")


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    company: str | None = Field(None, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


@router.post("/contact", response_model=Message, status_code=201, dependencies=[Depends(limiter("contact", 5, 600))])
async def contact(data: ContactIn, request: Request, db: DB):
    db.add(ContactMessage(**data.model_dump(), meta={"ip": client_ip(request), "user_agent": (request.headers.get("user-agent") or "")[:300]}))
    await db.commit()
    return Message(message="Thanks — we'll get back to you within one business day.")


# ------------------------------------------------------------------ authenticated feedback inbox

from app.core.deps import OrgContext, require_perm  # noqa: E402
from app.core.permissions import Perm  # noqa: E402
from app.schemas.common import ORM, Page  # noqa: E402
from app.services.locations import scoped_location_filter  # noqa: E402

inbox = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackOut(ORM):
    id: uuid.UUID
    location_id: uuid.UUID
    rating: int | None
    message: str
    name: str | None
    email: str | None
    phone: str | None
    language: str
    sentiment: str | None
    status: str
    channel: str
    consent_contact: bool
    customer_id: uuid.UUID | None
    created_at: datetime


@inbox.get("", response_model=Page[FeedbackOut])
async def list_feedback(db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)), page: int = Query(1, ge=1), page_size: int = Query(20, le=100), status: str | None = None, location_id: uuid.UUID | None = None):
    from sqlalchemy import func

    conds = [FeedbackSubmission.organization_id == ctx.org_id, scoped_location_filter(ctx, FeedbackSubmission.location_id)]
    if status:
        conds.append(FeedbackSubmission.status == status)
    if location_id:
        conds.append(FeedbackSubmission.location_id == location_id)
    total = await db.scalar(select(func.count()).select_from(FeedbackSubmission).where(*conds))
    rows = (await db.scalars(select(FeedbackSubmission).where(*conds).order_by(FeedbackSubmission.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return Page.build(list(rows), total or 0, page, page_size)


class FeedbackStatusIn(BaseModel):
    status: str = Field(pattern="^(new|in_progress|resolved)$")


@inbox.patch("/{feedback_id}", response_model=FeedbackOut)
async def update_feedback(feedback_id: uuid.UUID, data: FeedbackStatusIn, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    fb = await db.get(FeedbackSubmission, feedback_id)
    if fb is None or fb.organization_id != ctx.org_id:
        raise NotFound("Feedback not found")
    ctx.ensure_location(fb.location_id)
    fb.status = data.status
    await db.commit()
    return fb
