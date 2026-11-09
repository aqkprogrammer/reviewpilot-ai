"""Seed data.

`seed_reference_data` — plans, system templates, feature flags, settings (safe in every environment).
`seed_demo` — DEVELOPMENT ONLY. Sample organizations, users, reviews, campaigns… all flagged
`is_demo=True` / `source="demo"` / `provider="mock"` so they can never be mistaken for real data.
"""

from __future__ import annotations

import random
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password, hash_token
from app.models import (
    AIUsage,
    Announcement,
    AuditLog,
    BackgroundJob,
    Campaign,
    CampaignTemplate,
    Customer,
    CustomerConsent,
    FeatureFlag,
    FeedbackSubmission,
    Invoice,
    Location,
    MessageDelivery,
    Notification,
    NotificationPreference,
    Organization,
    OrganizationMember,
    Payment,
    QRCode,
    QRScan,
    Review,
    ReviewRequest,
    Subscription,
    SubscriptionPlan,
    SupportMessage,
    SupportTicket,
    SystemSetting,
    User,
)
from app.models.enums import (
    CampaignStatus,
    ConsentStatus,
    ConsentType,
    OrgRole,
    PaymentStatus,
    PlatformRole,
    RequestStatus,
    ResponseStatus,
    ReviewSource,
    SubscriptionStatus,
)
from app.models.notification import NOTIFICATION_TYPES
from app.providers.ai import heuristic_sentiment

PLANS = [
    {
        "code": "starter", "name": "Starter", "sort_order": 1, "price_monthly_minor": 99_900, "price_yearly_minor": 999_000,
        "description": "For a single location getting started with review collection.",
        "max_locations": 1, "max_team_members": 3, "max_organizations": 1, "ai_requests_per_month": 0, "monthly_message_quota": 300,
        "features": ["1 business location", "QR code review collection", "Email review requests", "Basic analytics", "Up to 3 team members"],
        "entitlements": {"qr_codes": True, "email_campaigns": True, "whatsapp_campaigns": False, "ai_replies": False, "advanced_analytics": False, "customer_management": True, "white_label": False},
    },
    {
        "code": "growth", "name": "Growth", "sort_order": 2, "is_popular": True, "price_monthly_minor": 199_900, "price_yearly_minor": 1_999_000,
        "description": "WhatsApp-first collection and AI replies for growing businesses.",
        "max_locations": 3, "max_team_members": 10, "max_organizations": 1, "ai_requests_per_month": 1000, "monthly_message_quota": 2000,
        "features": ["Up to 3 locations", "WhatsApp review campaigns", "AI review responses (EN, HI, Hinglish)", "Advanced analytics & sentiment", "Customer management", "Up to 10 team members"],
        "entitlements": {"qr_codes": True, "email_campaigns": True, "whatsapp_campaigns": True, "ai_replies": True, "advanced_analytics": True, "customer_management": True, "white_label": False},
    },
    {
        "code": "agency", "name": "Agency", "sort_order": 3, "price_monthly_minor": 499_900, "price_yearly_minor": 4_999_000,
        "description": "Manage multiple brands and clients from one workspace.",
        "max_locations": 10, "max_team_members": 50, "max_organizations": 10, "ai_requests_per_month": 5000, "monthly_message_quota": 10000,
        "features": ["Up to 10 locations", "Multi-organization management", "White-label feedback pages", "Team management & roles", "Advanced reporting (PDF/CSV)"],
        "entitlements": {"qr_codes": True, "email_campaigns": True, "whatsapp_campaigns": True, "ai_replies": True, "advanced_analytics": True, "customer_management": True, "white_label": True},
    },
    {
        "code": "enterprise", "name": "Enterprise", "sort_order": 4, "is_custom_pricing": True, "price_monthly_minor": 0, "price_yearly_minor": 0,
        "description": "Custom limits, SSO, data residency and a dedicated success manager.",
        "max_locations": 500, "max_team_members": 1000, "max_organizations": 50, "ai_requests_per_month": 100000, "monthly_message_quota": 200000,
        "features": ["Unlimited-scale locations", "Custom integrations", "Dedicated account manager", "SLA & priority support", "Security review & DPA"],
        "entitlements": {"qr_codes": True, "email_campaigns": True, "whatsapp_campaigns": True, "ai_replies": True, "advanced_analytics": True, "customer_management": True, "white_label": True},
    },
]

TEMPLATES = [
    ("WhatsApp — post-visit (English)", "whatsapp", "en", None, "Hi {{name}}, thank you for visiting {{business}}! How was your experience? We'd value your honest feedback: {{link}}", "review_request_en"),
    ("WhatsApp — post-visit (Hindi)", "whatsapp", "hi", None, "नमस्ते {{name}}, {{business}} आने के लिए धन्यवाद! आपका अनुभव कैसा रहा? अपनी ईमानदार राय यहाँ साझा करें: {{link}}", "review_request_hi"),
    ("WhatsApp — post-visit (Hinglish)", "whatsapp", "hinglish", None, "Hi {{name}}, {{business}} visit karne ke liye thank you! Aapka experience kaisa raha? Apna honest feedback yahan share kijiye: {{link}}", "review_request_hinglish"),
    ("Email — thank you & feedback", "email", "en", "How was your visit to {{business}}?", "Thank you for choosing {{business}}. We'd love to hear about your experience — good or bad. Share your feedback here: {{link}}", None),
    ("SMS — short request", "sms", "en", None, "{{business}}: Thanks for visiting! Share honest feedback: {{link}} Reply STOP to opt out", None),
]

FLAGS = [
    ("ai_insights_v2", "Second-generation AI insights with weekday trend detection", True),
    ("whatsapp_reminders", "Automatic WhatsApp reminder messages", True),
    ("hindi_feedback_page", "Hindi localisation on public feedback pages", True),
    ("sms_campaigns", "SMS campaigns (requires a compliant SMS provider per market)", False),
    ("white_label_domains", "Custom domains for white-label feedback pages", False),
]


async def seed_reference_data(db: AsyncSession) -> None:
    for p in PLANS:
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == p["code"]))
        if plan is None:
            db.add(SubscriptionPlan(currency="INR", **p))
    for name, ch, lang, subject, body, wa in TEMPLATES:
        if not await db.scalar(select(CampaignTemplate).where(CampaignTemplate.name == name, CampaignTemplate.is_system.is_(True))):
            db.add(CampaignTemplate(name=name, channel=ch, language=lang, subject=subject, body=body, provider_template_name=wa, provider_status="requires_approval" if ch == "whatsapp" else None, is_system=True))
    for key, desc, enabled in FLAGS:
        if not await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key)):
            db.add(FeatureFlag(key=key, description=desc, enabled=enabled))
    for key, value, desc in (
        ("platform.support_email", {"value": "support@reviewpilot.ai"}, "Support contact shown to customers"),
        ("billing.gst_rate", {"value": 18}, "GST percentage included in INR prices"),
        ("ai.default_model", {"value": settings.openai_model}, "Default OpenAI model"),
        ("security.session_days", {"value": settings.refresh_token_ttl_days}, "Refresh session lifetime (days)"),
    ):
        if not await db.scalar(select(SystemSetting).where(SystemSetting.key == key)):
            db.add(SystemSetting(key=key, value=value, description=desc))
    await db.commit()


# ------------------------------------------------------------------ demo data

REVIEW_TEXTS = {
    5: [
        "Absolutely loved the food! The butter chicken was delicious and the staff were so friendly. Will definitely come back.",
        "Excellent service and very clean place. Our waiter Rahul was polite and quick. Best biryani in the area.",
        "Great ambience for a family dinner. Food arrived fast and everything was fresh and tasty.",
        "Bahut badhiya khana tha! Staff bhi kaafi helpful tha. Highly recommend the paneer tikka.",
        "खाना बहुत अच्छा था और सेवा भी शानदार थी। परिवार के साथ आने के लिए बढ़िया जगह।",
        "Wonderful experience, the manager personally checked on our table. Clean washrooms and great music.",
        "Perfect place for a birthday celebration. The team was caring and the dessert was amazing.",
        "",
    ],
    4: [
        "Good food and friendly staff. A little noisy on Saturday evening but overall a nice experience.",
        "Tasty food and quick service. Parking was a bit difficult to find.",
        "Nice ambience, the dal makhani was great. Slightly expensive but worth it.",
        "Food accha tha, service thodi slow thi weekend pe but staff polite tha.",
        "Clean place and good quality food. Would like more vegetarian options.",
    ],
    3: [
        "Food was okay, but we waited 40 minutes for our main course. Staff seemed overloaded.",
        "Average experience. Taste was good but the table wasn't clean when we sat down.",
        "Decent food, but overpriced for the portion size.",
        "Weekend pe bahut der lagi order aane mein. Khana theek tha.",
    ],
    2: [
        "Waited almost an hour on Sunday and the food arrived cold. Disappointing.",
        "Staff was rude when we asked about our delayed order. Food quality has dropped.",
        "The place was dirty and the service was slow. Expected better.",
    ],
    1: [
        "Terrible experience. Booking was lost, we waited 45 minutes and the manager was unprofessional.",
        "Worst service ever, cold food and nobody apologised. Very disappointed.",
        "बहुत खराब अनुभव। खाना ठंडा था और बहुत देर लगी।",
    ],
}
FIRST = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Arjun", "Kavya", "Rahul", "Meera", "Ishaan", "Diya", "Kabir", "Neha", "Aditya", "Pooja", "Siddharth", "Riya", "Karan", "Tanvi", "Amit", "Sanya", "Nikhil", "Aisha"]
LAST = ["Sharma", "Patel", "Iyer", "Reddy", "Gupta", "Nair", "Mehta", "Singh", "Kapoor", "Das", "Joshi", "Bose", "Khan", "Menon", "Rao", "Malhotra"]

DEMO_ORGS = [
    {"name": "Spice Route Kitchen", "industry": "restaurant", "plan": "growth", "status": SubscriptionStatus.ACTIVE, "primary": True,
     "locations": [("Bandra West", "Mumbai", "Maharashtra"), ("Koramangala", "Bengaluru", "Karnataka"), ("Connaught Place", "New Delhi", "Delhi")]},
    {"name": "Smile Studio Dental", "industry": "dental", "plan": "starter", "status": SubscriptionStatus.ACTIVE, "locations": [("Jubilee Hills", "Hyderabad", "Telangana")]},
    {"name": "Glow Salon & Spa", "industry": "salon", "plan": "growth", "status": SubscriptionStatus.TRIALING, "locations": [("Anna Nagar", "Chennai", "Tamil Nadu"), ("T. Nagar", "Chennai", "Tamil Nadu")]},
    {"name": "Harbor View Residency", "industry": "hotel", "plan": "agency", "status": SubscriptionStatus.GRACE_PERIOD, "locations": [("Fort Kochi", "Kochi", "Kerala")]},
    {"name": "Northstar Realty", "industry": "real_estate", "plan": "starter", "status": SubscriptionStatus.EXPIRED, "locations": [("Baner", "Pune", "Maharashtra")]},
    {"name": "Brightpath Coaching", "industry": "education", "plan": "growth", "status": SubscriptionStatus.CANCELED, "locations": [("Kota Main Road", "Kota", "Rajasthan")]},
]


def _now() -> datetime:
    return datetime.now(UTC)


async def _user(db: AsyncSession, email: str, name: str, password: str, role: str = PlatformRole.USER) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if user:
        return user
    user = User(email=email, full_name=name, password_hash=hash_password(password), email_verified_at=_now(), platform_role=role, is_seed=True, last_login_at=_now() - timedelta(hours=random.randint(1, 72)))
    db.add(user)
    await db.flush()
    for t in NOTIFICATION_TYPES:
        db.add(NotificationPreference(user_id=user.id, type=t, in_app=True, email=False))
    return user


async def seed_demo(db: AsyncSession) -> dict:
    if settings.is_production:
        raise RuntimeError("Refusing to seed demo data in production")
    rnd = random.Random(42)
    await seed_reference_data(db)
    if await db.scalar(select(Organization).where(Organization.slug == "spice-route-kitchen")):
        await sync_demo_passwords(db)
        return {"status": "already_seeded", "passwords": "synced"}

    plans = {p.code: p for p in (await db.scalars(select(SubscriptionPlan))).all()}
    super_admin = await _user(db, "superadmin@reviewpilot.dev", "Platform Admin", settings.seed_password_super_admin, PlatformRole.SUPER_ADMIN)
    owner = await _user(db, "owner@reviewpilot.dev", "Kunal Malhotra", settings.seed_password_owner)
    admin = await _user(db, "admin@reviewpilot.dev", "Ritika Sen", settings.seed_password_admin)
    staff = await _user(db, "staff@reviewpilot.dev", "Manoj Verma", settings.seed_password_staff)
    wa_tpl = await db.scalar(select(CampaignTemplate).where(CampaignTemplate.provider_template_name == "review_request_en"))
    email_tpl = await db.scalar(select(CampaignTemplate).where(CampaignTemplate.channel == "email", CampaignTemplate.is_system.is_(True)))

    for idx, spec in enumerate(DEMO_ORGS):
        created_at = _now() - timedelta(days=rnd.randint(20, 300) if not spec.get("primary") else 160)
        org_owner = owner if spec.get("primary") else await _user(db, f"owner{idx}@reviewpilot.dev", f"{rnd.choice(FIRST)} {rnd.choice(LAST)}", settings.seed_password_owner)
        slug = spec["name"].lower().replace("&", "and").replace(" ", "-").replace(".", "")
        org = Organization(
            name=spec["name"], slug=slug, industry=spec["industry"], country="IN", timezone="Asia/Kolkata", is_demo=True,
            description=f"{spec['name']} — sample organization for demonstration.", website=f"https://{slug}.example.com", phone="+919800000000",
            email=org_owner.email, onboarding_step=8, onboarding_completed_at=created_at + timedelta(hours=1), brand_color="#0e9aa7", created_at=created_at,
            status="suspended" if spec["name"] == "Northstar Realty" else "active", suspended_reason="Demo: suspended for unpaid invoices" if spec["name"] == "Northstar Realty" else None,
        )
        db.add(org)
        await db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=org_owner.id, role=OrgRole.OWNER))
        if spec.get("primary"):
            db.add(OrganizationMember(organization_id=org.id, user_id=admin.id, role=OrgRole.ADMIN))
            db.add(OrganizationMember(organization_id=org.id, user_id=staff.id, role=OrgRole.STAFF))
        plan = plans[spec["plan"]]
        sub = Subscription(
            organization_id=org.id, plan_id=plan.id, status=spec["status"], interval="monthly", provider="mock" if spec["status"] != SubscriptionStatus.TRIALING else None,
            provider_subscription_id=f"mock_sub_demo_{idx}" if spec["status"] != SubscriptionStatus.TRIALING else None,
            trial_ends_at=_now() + timedelta(days=9) if spec["status"] == SubscriptionStatus.TRIALING else None,
            current_period_start=_now() - timedelta(days=12), current_period_end=_now() + timedelta(days=18),
            grace_period_ends_at=_now() + timedelta(days=4) if spec["status"] == SubscriptionStatus.GRACE_PERIOD else None,
            canceled_at=_now() - timedelta(days=10) if spec["status"] == SubscriptionStatus.CANCELED else None,
        )
        db.add(sub)
        await db.flush()
        # Simulated payment history (provider="mock", clearly not real money).
        if spec["status"] not in (SubscriptionStatus.TRIALING,):
            months = max(1, (_now() - created_at).days // 30)
            for m in range(min(months, 8)):
                failed = spec["status"] == SubscriptionStatus.GRACE_PERIOD and m == 0
                paid = _now() - timedelta(days=30 * m + 12)
                pay = Payment(organization_id=org.id, subscription_id=sub.id, provider="mock", provider_payment_id=f"pay_mock_{org.id.hex[:6]}_{m}", amount_minor=plan.price_monthly_minor,
                              currency="INR", status=PaymentStatus.FAILED if failed else PaymentStatus.SUCCEEDED, failure_reason="Card declined (simulated)" if failed else None,
                              paid_at=None if failed else paid, plan_code=plan.code, created_at=paid)
                db.add(pay)
                await db.flush()
                if not failed:
                    tax = round(plan.price_monthly_minor * 18 / 118)
                    db.add(Invoice(organization_id=org.id, payment_id=pay.id, number=f"RP-DEMO-{org.id.hex[:4].upper()}-{m:03d}", amount_minor=plan.price_monthly_minor, tax_minor=tax, currency="INR",
                                   period_start=paid, period_end=paid + timedelta(days=30), line_items=[{"description": f"ReviewPilot AI — {plan.name} (monthly) [DEMO]", "amount_minor": plan.price_monthly_minor - tax}],
                                   billing_details={"name": org.name, "email": org.email, "country": "IN"}, created_at=paid))
        locations = []
        for li, (area, city, state) in enumerate(spec["locations"]):
            loc = Location(organization_id=org.id, name=f"{area}, {city}" if len(spec["locations"]) > 1 else city, slug=f"{slug}-{area.lower().replace(' ', '-').replace('.', '')}",
                           address_line=f"{rnd.randint(10, 300)}, {area}", city=city, state=state, postal_code=str(400000 + rnd.randint(1, 99999)), country="IN", phone=f"+9198{rnd.randint(10000000, 99999999)}",
                           google_review_url=f"https://search.google.com/local/writereview?placeid=DEMO-{slug}-{li}", created_at=created_at)
            db.add(loc)
            locations.append(loc)
        await db.flush()

        n_reviews = 220 if spec.get("primary") else rnd.randint(25, 70)
        weights = [0.52, 0.22, 0.11, 0.08, 0.07]
        reviews = []
        for _ in range(n_reviews):
            loc = rnd.choice(locations)
            days_ago = rnd.betavariate(1.1, 2.4) * 150
            when = _now() - timedelta(days=days_ago, hours=rnd.randint(0, 23))
            rating = rnd.choices([5, 4, 3, 2, 1], weights=weights)[0]
            if when.weekday() >= 5 and rnd.random() < 0.25 and rating > 2:
                rating -= 1  # weekend dip, so insights have a real pattern to find
            text = rnd.choice(REVIEW_TEXTS[rating])
            sentiment, score, topics = heuristic_sentiment(text, rating)
            responded = rnd.random() < (0.75 if days_ago > 10 else 0.35)
            r = Review(
                organization_id=org.id, location_id=loc.id, source=ReviewSource.DEMO, platform="google", external_id=f"demo-{uuid.uuid4().hex[:12]}",
                reviewer_name=f"{rnd.choice(FIRST)} {rnd.choice(LAST)[0]}.", rating=rating, comment=text or None, review_created_at=when,
                response_status=ResponseStatus.RESPONDED if responded else ResponseStatus.PENDING, sentiment=sentiment, sentiment_score=score, topics=topics,
                platform_reply=("Thank you for your feedback! We appreciate you taking the time to share your experience." if responded else None),
                platform_reply_at=when + timedelta(hours=rnd.randint(2, 60)) if responded else None,
                history=[{"at": when.isoformat(), "event": "demo_seeded", "note": "Sample review — not from Google"}],
            )
            db.add(r)
            reviews.append(r)

        customers = []
        for ci in range(70 if spec.get("primary") else 15):
            fn, ln = rnd.choice(FIRST), rnd.choice(LAST)
            c = Customer(organization_id=org.id, location_id=rnd.choice(locations).id, name=f"{fn} {ln}", email=f"{fn.lower()}.{ln.lower()}{ci}@example.com",
                         phone=f"+9199{rnd.randint(10000000, 99999999)}" if ci % 13 else "+919900000000", tags=rnd.sample(["regular", "vip", "family", "corporate", "first-visit", "weekend"], k=rnd.randint(0, 2)),
                         source="demo", preferred_language=rnd.choice(["en", "en", "hi", "hinglish"]), created_at=_now() - timedelta(days=rnd.randint(1, 140)),
                         opted_out_at=_now() - timedelta(days=3) if ci % 29 == 5 else None)
            db.add(c)
            customers.append(c)
        await db.flush()
        for i, c in enumerate(customers):
            if i % 7 == 6:
                continue  # some customers have no consent → campaigns skip them
            for ch in ("whatsapp", "email"):
                db.add(CustomerConsent(organization_id=org.id, customer_id=c.id, channel=ch, consent_type=ConsentType.TRANSACTIONAL, status=ConsentStatus.GRANTED, source="demo_seed", evidence={"note": "Demo consent record"}))

        if spec.get("primary"):
            camp_specs = [
                ("Weekend diners — WhatsApp", "whatsapp", CampaignStatus.COMPLETED, 40, wa_tpl.id if wa_tpl else None),
                ("Monthly regulars — Email", "email", CampaignStatus.ACTIVE, 22, email_tpl.id if email_tpl else None),
                ("Diwali visitors follow-up", "whatsapp", CampaignStatus.PAUSED, 18, wa_tpl.id if wa_tpl else None),
                ("Table-card QR — Bandra", "qr", CampaignStatus.ACTIVE, 0, None),
                ("New menu feedback (draft)", "whatsapp", CampaignStatus.DRAFT, 0, wa_tpl.id if wa_tpl else None),
            ]
            qr_campaign = None
            for name, ch, status, n, tpl_id in camp_specs:
                launched = _now() - timedelta(days=rnd.randint(5, 50))
                camp = Campaign(organization_id=org.id, location_id=locations[0].id, template_id=tpl_id, created_by_id=owner.id, name=name, channel=ch, status=status,
                                audience={"tags": []}, reminder_enabled=ch == "whatsapp", launched_at=launched if status != CampaignStatus.DRAFT else None,
                                completed_at=launched + timedelta(days=3) if status == CampaignStatus.COMPLETED else None, created_at=launched - timedelta(days=1))
                db.add(camp)
                await db.flush()
                if ch == "qr":
                    qr_campaign = camp
                for c in rnd.sample(customers, k=min(n, len(customers))):
                    sent = launched + timedelta(minutes=rnd.randint(1, 600))
                    fail = c.phone == "+919900000000" and ch == "whatsapp"
                    clicked = not fail and rnd.random() < 0.46
                    g = clicked and rnd.random() < 0.62
                    req = ReviewRequest(organization_id=org.id, location_id=camp.location_id, campaign_id=camp.id, customer_id=c.id, channel=ch, tracking_token=secrets.token_urlsafe(18),
                                        status=RequestStatus.FAILED if fail else (RequestStatus.CLICKED if clicked else RequestStatus.DELIVERED), sent_at=None if fail else sent,
                                        delivered_at=None if fail else sent + timedelta(seconds=5), clicked_at=sent + timedelta(hours=2) if clicked else None,
                                        google_clicked_at=sent + timedelta(hours=2, minutes=1) if g else None, failed_reason="Simulated failure (numbers ending in 0000)" if fail else None, created_at=sent)
                    db.add(req)
                    await db.flush()
                    db.add(MessageDelivery(organization_id=org.id, review_request_id=req.id, channel=ch, provider="mock", provider_message_id=f"mock_{uuid.uuid4().hex[:10]}",
                                           recipient=c.phone if ch != "email" else c.email, status="failed" if fail else "delivered", error_message=req.failed_reason, created_at=sent,
                                           events=[{"at": sent.isoformat(), "status": "failed" if fail else "delivered", "simulated": True}]))
            for li, loc in enumerate(locations):
                qr = QRCode(organization_id=org.id, location_id=loc.id, campaign_id=qr_campaign.id if (qr_campaign and li == 0) else None, name=f"Table card — {loc.name}", code=f"demo{li}{secrets.token_hex(2)}", template=["classic", "bold", "minimal"][li % 3],
                            card_headline="How was your meal?", card_subtext="Scan to share honest feedback")
                db.add(qr)
                await db.flush()
                scans = rnd.randint(60, 240)
                for _ in range(scans):
                    db.add(QRScan(qr_code_id=qr.id, organization_id=org.id, scanned_at=_now() - timedelta(days=rnd.betavariate(1, 2) * 60), device=rnd.choice(["android", "android", "ios", "desktop"]), ip_hash=secrets.token_hex(8)))
                qr.scan_count, qr.last_scanned_at = scans, _now() - timedelta(hours=rnd.randint(1, 30))
            for _ in range(18):
                rating = rnd.choice([1, 2, 3, 4, 5, 5])
                text = rnd.choice(REVIEW_TEXTS[rating]) or "Thanks for the great evening!"
                s, _, _ = heuristic_sentiment(text, rating)
                db.add(FeedbackSubmission(organization_id=org.id, location_id=rnd.choice(locations).id, rating=rating, message=text, name=f"{rnd.choice(FIRST)} {rnd.choice(LAST)}",
                                          email=None, language="en", sentiment=s, channel=rnd.choice(["qr", "whatsapp", "direct"]), status=rnd.choice(["new", "new", "in_progress", "resolved"]),
                                          created_at=_now() - timedelta(days=rnd.randint(0, 30))))
            for i, (t, title, body, link) in enumerate((
                ("review.new", "New 2★ review — Bandra West", "Waited almost an hour on Sunday and the food arrived cold.", "/app/reviews"),
                ("feedback.new", "New private feedback — Koramangala", "5★ · Lovely evening, the staff were very caring.", "/app/reviews?tab=feedback"),
                ("campaign.completed", "Campaign “Weekend diners — WhatsApp” completed", "40 sent, 6 skipped (no consent or opted out).", "/app/campaigns"),
                ("billing.payment_succeeded", "Payment received", "Your Growth plan payment was successful (simulated in demo mode).", "/app/subscription"),
                ("system.announcement", "New: Hinglish AI replies", "Generate natural Hinglish replies from the review drawer.", None),
            )):
                for u in (owner, admin):
                    db.add(Notification(user_id=u.id, organization_id=org.id, type=t, title=title, body=body, link=link, created_at=_now() - timedelta(hours=i * 7 + 1), read_at=None if i < 3 else _now()))
            ai_month = _now().strftime("%Y-%m")
            db.add(AIUsage(organization_id=org.id, period=ai_month, requests=142, prompt_tokens=0, completion_tokens=0, cost_usd=0, by_model={"reviewpilot-heuristic-v1": 142}))
            t = SupportTicket(organization_id=org.id, requester_id=owner.id, subject="WhatsApp template approval taking long", category="integrations", priority="normal", status="open")
            db.add(t)
            await db.flush()
            db.add(SupportMessage(ticket_id=t.id, author_id=owner.id, body="Our review_request_hi template has been pending approval for 3 days. Is there anything we can do?"))
        else:
            if rnd.random() < 0.8:
                db.add(AIUsage(organization_id=org.id, period=_now().strftime("%Y-%m"), requests=rnd.randint(5, 90), by_model={"reviewpilot-heuristic-v1": 1}))
            if idx % 2 == 0:
                t = SupportTicket(organization_id=org.id, requester_id=org_owner.id, subject=rnd.choice(["Unable to download QR PDF", "Invoice GST number change", "How do I add a second location?"]),
                                  category=rnd.choice(["technical", "billing", "general"]), priority=rnd.choice(["low", "normal", "high"]), status=rnd.choice(["open", "pending", "resolved"]))
                db.add(t)
                await db.flush()
                db.add(SupportMessage(ticket_id=t.id, author_id=org_owner.id, body="Hello team, could you help with this? Thanks!"))
        await db.flush()

    db.add(Announcement(title="Scheduled maintenance — 16 Nov, 2:00–2:30 AM IST", body="Review sync and campaigns will pause briefly during database maintenance.", level="warning", audience="all", published_at=_now() - timedelta(days=1), created_by_id=super_admin.id))
    for action in ("auth.login", "organization.updated", "campaign.launched", "team.invited", "billing.subscription_activated"):
        db.add(AuditLog(actor_id=owner.id, actor_email=owner.email, action=action, actor_type="user", meta={"demo": True}))
    for name, status in (("process_campaign", "succeeded"), ("generate_ai_insights", "succeeded"), ("sync_all_google", "succeeded"), ("send_review_request", "failed")):
        db.add(BackgroundJob(name=name, status=status, runner="inline", error="Simulated failure (numbers ending in 0000)" if status == "failed" else None, finished_at=_now()))
    await db.commit()

    from app.services.ai import refresh_insights

    primary = await db.scalar(select(Organization).where(Organization.slug == "spice-route-kitchen"))
    await refresh_insights(db, primary.id)
    return {"status": "seeded", "organization": str(primary.id)}


SEED_ACCOUNTS = {
    "superadmin@reviewpilot.dev": "seed_password_super_admin",
    "owner@reviewpilot.dev": "seed_password_owner",
    "admin@reviewpilot.dev": "seed_password_admin",
    "staff@reviewpilot.dev": "seed_password_staff",
}


async def sync_demo_passwords(db: AsyncSession) -> None:
    """Keep seeded demo accounts' passwords equal to the configured SEED_PASSWORD_* values.
    Only touches rows created by the seed (is_seed=True); never runs in production."""
    if settings.is_production:
        return
    for email, attr in SEED_ACCOUNTS.items():
        user = await db.scalar(select(User).where(User.email == email, User.is_seed.is_(True)))
        if user is not None:
            user.password_hash = hash_password(getattr(settings, attr))
            user.status = "active"
    await db.commit()


async def bootstrap_super_admin(db: AsyncSession, email: str, name: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email.lower(), User.deleted_at.is_(None)))
    if user is None:
        user = User(email=email.lower(), full_name=name, password_hash=hash_password(password), email_verified_at=_now())
        db.add(user)
    user.platform_role = PlatformRole.SUPER_ADMIN
    await db.flush()
    db.add(AuditLog(actor_id=user.id, actor_email=user.email, actor_type="system", action="admin.super_admin_bootstrapped", target_type="user", target_id=str(user.id), meta={"via": "cli"}))
    await db.commit()
    _ = hash_token  # keep import used for future token-based bootstrap
    return user
