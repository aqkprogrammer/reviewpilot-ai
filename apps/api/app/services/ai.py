"""AI review assistant: prompt templates, generation, usage metering and insights."""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ratelimit
from app.core.config import settings
from app.core.errors import AppError, PlanLimitExceeded, RateLimited
from app.core.security import now
from app.models import AIGeneration, AIInsight, AIUsage, Organization, Review
from app.providers.ai import TOPIC_LABELS, AIProviderError, AIResult, HeuristicProvider, get_llm, heuristic_sentiment
from app.services.notify import notify_org
from app.services.organizations import effective_plan

log = logging.getLogger("reviewpilot.ai")
PROMPT_VERSION = "2026-11-v1"

LANG_NAMES = {"en": "English", "hi": "Hindi (Devanagari script)", "hinglish": "Hinglish (Hindi written in Latin script, mixed with English)"}

REPLY_SYSTEM = """You write public owner replies to online reviews for local businesses.
Rules:
- Be genuine, specific to what the reviewer said, and 2-4 sentences.
- Never argue, blame the customer, or reveal private details (visit dates, treatments, bills, staff surnames, health info).
- For negative reviews: acknowledge, apologise sincerely, and invite the customer to continue the conversation privately. No excuses.
- Never offer discounts, gifts or incentives in exchange for reviews or review changes.
- Do not invent facts that are not in the review.
- Write in the requested language and tone.
Return JSON: {"reply": str, "explanation": str, "sentiment": "positive|neutral|negative|mixed", "keywords": [str], "follow_up": str}"""

SENTIMENT_SYSTEM = """Classify customer feedback. Return JSON:
{"sentiment": "positive|neutral|negative|mixed", "score": number between -1 and 1, "topics": [short snake_case topics], "summary": one sentence}"""

SUMMARY_SYSTEM = """You analyse batches of customer reviews for a local business owner.
Only use what is in the reviews. Quantify where possible ("12 of 40 reviews mention...").
Return JSON: {"summary": str, "recurring_complaints": [{"title": str, "detail": str, "count": int}],
"positive_highlights": [{"title": str, "detail": str, "count": int}], "recommendations": [{"title": str, "detail": str}]}"""

TEMPLATE_SYSTEM = """You write short, compliant customer messages for local businesses.
Review requests must ask for honest feedback (never only positive reviews), must not offer incentives,
must include the placeholder {{link}}, and should be under 320 characters for WhatsApp/SMS.
Return JSON: {"subject": str|null, "body": str, "notes": str}"""


async def _check_limits(db: AsyncSession, org_id: uuid.UUID) -> None:
    allowed, _ = await ratelimit.hit(f"ai:{org_id}", 30, 60)
    if not allowed:
        raise RateLimited("AI rate limit reached (30 requests/minute). Please wait a moment.")
    plan = await effective_plan(db, org_id)
    if plan is None:
        raise PlanLimitExceeded("Your subscription is inactive. Choose a plan to use the AI assistant.")
    if not plan.entitlements.get("ai_replies"):
        raise PlanLimitExceeded(f"AI features are not included in the {plan.name} plan. Upgrade to Growth to unlock them.", details={"entitlement": "ai_replies"})
    usage = await db.scalar(select(AIUsage).where(AIUsage.organization_id == org_id, AIUsage.period == now().strftime("%Y-%m")))
    if usage and usage.requests >= plan.ai_requests_per_month:
        raise PlanLimitExceeded(f"You've used all {plan.ai_requests_per_month} AI requests this month.", details={"limit": plan.ai_requests_per_month})


async def _meter(db: AsyncSession, org_id: uuid.UUID, result: AIResult | None, success: bool) -> None:
    period = now().strftime("%Y-%m")
    model = result.model if result else "unknown"
    stmt = insert(AIUsage).values(
        id=uuid.uuid4(), organization_id=org_id, period=period, requests=1, failed_requests=0 if success else 1,
        prompt_tokens=result.prompt_tokens if result else 0, completion_tokens=result.completion_tokens if result else 0,
        cost_usd=result.cost_usd if result else 0, by_model={model: 1},
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_ai_usage_period",
        set_={
            "requests": AIUsage.requests + 1,
            "failed_requests": AIUsage.failed_requests + (0 if success else 1),
            "prompt_tokens": AIUsage.prompt_tokens + stmt.excluded.prompt_tokens,
            "completion_tokens": AIUsage.completion_tokens + stmt.excluded.completion_tokens,
            "cost_usd": AIUsage.cost_usd + stmt.excluded.cost_usd,
            "updated_at": now(),
        },
    )
    await db.execute(stmt)
    plan = await effective_plan(db, org_id)
    usage = await db.scalar(select(AIUsage).where(AIUsage.organization_id == org_id, AIUsage.period == period))
    if plan and usage:
        # Track per-model counts in Python (JSONB merge) and warn at 90%.
        by_model = dict(usage.by_model or {})
        by_model[model] = by_model.get(model, 0) + (0 if usage.requests == 1 else 1)
        usage.by_model = by_model
        if usage.requests == int(plan.ai_requests_per_month * 0.9):
            await notify_org(db, org_id, "ai.usage_limit", "AI usage at 90%", f"{usage.requests} of {plan.ai_requests_per_month} AI requests used this month.", link="/app/subscription")


async def _run(
    db: AsyncSession, org: Organization, user_id: uuid.UUID | None, kind: str, system: str, prompt: dict,
    fallback, review_id: uuid.UUID | None = None, *, enforce: bool = True,
) -> tuple[dict, AIGeneration]:
    if enforce:
        await _check_limits(db, org.id)
    llm = get_llm()
    result: AIResult | None = None
    error: str | None = None
    if llm is not None:
        try:
            result = await llm.complete_json(system, json.dumps(prompt, ensure_ascii=False))
        except AIProviderError as exc:
            error = str(exc)
            log.warning("AI %s failed: %s", kind, exc)
    if result is None:
        if llm is not None and settings.is_production:
            await _meter(db, org.id, None, False)
            db.add(AIGeneration(organization_id=org.id, user_id=user_id, review_id=review_id, kind=kind, provider="openai", model=settings.openai_model,
                                prompt_version=PROMPT_VERSION, input=prompt, output={}, success=False, error=error))
            await db.commit()
            raise AppError("The AI service is temporarily unavailable. Please try again.", code="ai_unavailable", status_code=503)
        result = AIResult(data=fallback(), provider=HeuristicProvider.name, model=HeuristicProvider.model)
    await _meter(db, org.id, result, True)
    gen = AIGeneration(
        organization_id=org.id, user_id=user_id, review_id=review_id, kind=kind, provider=result.provider, model=result.model,
        prompt_version=PROMPT_VERSION, input=prompt, output=result.data, prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens, cost_usd=result.cost_usd, latency_ms=result.latency_ms, success=True,
        error=error,
    )
    db.add(gen)
    await db.flush()
    return result.data, gen


async def generate_reply(
    db: AsyncSession, org: Organization, user_id: uuid.UUID | None, *, review_text: str | None, rating: int,
    reviewer_name: str | None, tone: str, language: str, review_id: uuid.UUID | None = None,
) -> tuple[dict, AIGeneration]:
    prompt = {
        "business_name": org.name, "industry": org.industry, "brand_tone": org.brand_tone, "requested_tone": tone,
        "language": LANG_NAMES.get(language, "English"), "rating": rating, "reviewer_first_name": (reviewer_name or "").split(" ")[0] or None,
        "review_text": review_text or "(no text, rating only)",
    }
    heur = HeuristicProvider()
    data, gen = await _run(
        db, org, user_id, "reply", REPLY_SYSTEM, prompt,
        lambda: heur.reply(review_text=review_text, rating=rating, reviewer=reviewer_name, business=org.name, tone=tone, language=language),
        review_id,
    )
    data.setdefault("keywords", [])
    data["provider"] = gen.provider
    data["generation_id"] = str(gen.id)
    return data, gen


async def analyze_sentiment(db: AsyncSession, org: Organization, user_id: uuid.UUID | None, text: str, rating: int | None) -> dict:
    def fb():
        label, score, topics = heuristic_sentiment(text, rating)
        return {"sentiment": label, "score": score, "topics": topics, "summary": f"Feedback is {label}" + (f", mentioning {', '.join(TOPIC_LABELS[t] for t in topics)}" if topics else "") + "."}

    data, gen = await _run(db, org, user_id, "sentiment", SENTIMENT_SYSTEM, {"text": text, "rating": rating}, fb)
    data["provider"] = gen.provider
    return data


def _heuristic_summary(reviews: list[Review]) -> dict:
    if not reviews:
        return {"summary": "No reviews in this period yet.", "recurring_complaints": [], "positive_highlights": [], "recommendations": []}
    neg_topics: Counter = Counter()
    pos_topics: Counter = Counter()
    for r in reviews:
        label, _, topics = heuristic_sentiment(r.comment, r.rating)
        for t in topics:
            (neg_topics if r.rating <= 3 else pos_topics)[t] += 1
    avg = sum(r.rating for r in reviews) / len(reviews)
    n = len(reviews)
    complaints = [{"title": f"Customers mention {TOPIC_LABELS[t]}", "detail": f"{c} of {n} lower-rated reviews reference {TOPIC_LABELS[t]}.", "count": c} for t, c in neg_topics.most_common(4)]
    highlights = [{"title": f"Praise for {TOPIC_LABELS[t]}", "detail": f"{c} positive reviews call out {TOPIC_LABELS[t]}.", "count": c} for t, c in pos_topics.most_common(4)]
    recs = [{"title": f"Address {TOPIC_LABELS[t]}", "detail": f"Investigate root causes behind {TOPIC_LABELS[t]} complaints and brief the team."} for t, _ in neg_topics.most_common(2)]
    return {
        "summary": f"{n} reviews analysed with an average rating of {avg:.1f}. "
        + (f"The most common concern is {TOPIC_LABELS[neg_topics.most_common(1)[0][0]]}. " if neg_topics else "")
        + (f"Customers most often praise {TOPIC_LABELS[pos_topics.most_common(1)[0][0]]}." if pos_topics else ""),
        "recurring_complaints": complaints,
        "positive_highlights": highlights,
        "recommendations": recs,
    }


async def _recent_reviews(db: AsyncSession, org_id: uuid.UUID, days: int, location_id: uuid.UUID | None = None, limit: int = 200) -> list[Review]:
    stmt = select(Review).where(Review.organization_id == org_id, Review.review_created_at >= now() - timedelta(days=days))
    if location_id:
        stmt = stmt.where(Review.location_id == location_id)
    return list((await db.scalars(stmt.order_by(Review.review_created_at.desc()).limit(limit))).all())


async def summarize(db: AsyncSession, org: Organization, user_id: uuid.UUID | None, days: int, location_id: uuid.UUID | None) -> dict:
    reviews = await _recent_reviews(db, org.id, days, location_id)
    prompt = {"business": org.name, "industry": org.industry, "period_days": days, "reviews": [{"rating": r.rating, "text": (r.comment or "")[:600], "date": r.review_created_at.date().isoformat()} for r in reviews]}
    data, gen = await _run(db, org, user_id, "summary", SUMMARY_SYSTEM, prompt, lambda: _heuristic_summary(reviews))
    data["provider"] = gen.provider
    data["review_count"] = len(reviews)
    return data


async def generate_template(db: AsyncSession, org: Organization, user_id: uuid.UUID | None, *, purpose: str, channel: str, language: str, tone: str) -> dict:
    def fb():
        if language == "hi":
            body = f"नमस्ते {{{{name}}}}, {org.name} आने के लिए धन्यवाद! आपका अनुभव कैसा रहा? अपनी ईमानदार राय यहाँ साझा करें: {{{{link}}}}"
        elif language == "hinglish":
            body = f"Hi {{{{name}}}}, {org.name} visit karne ke liye thank you! Aapka experience kaisa raha? Apna honest feedback yahan share kijiye: {{{{link}}}}"
        else:
            body = f"Hi {{{{name}}}}, thanks for visiting {org.name}! We'd love your honest feedback on your experience — it only takes a minute: {{{{link}}}}"
        return {"subject": f"How was your visit to {org.name}?" if channel == "email" else None, "body": body, "notes": "Template generated offline. Placeholders: {{name}}, {{link}}."}

    data, gen = await _run(db, org, user_id, "template", TEMPLATE_SYSTEM, {"business": org.name, "industry": org.industry, "purpose": purpose, "channel": channel, "language": LANG_NAMES.get(language, "English"), "tone": tone}, fb)
    data["provider"] = gen.provider
    return data


async def refresh_insights(db: AsyncSession, org_id: uuid.UUID, days: int = 90) -> int:
    """Regenerate insights from actual review text. Runs in the worker (no plan check: system job)."""
    org = await db.get(Organization, org_id)
    if org is None:
        return 0
    reviews = await _recent_reviews(db, org_id, days, limit=400)
    for old in (await db.scalars(select(AIInsight).where(AIInsight.organization_id == org_id, AIInsight.is_dismissed.is_(False)))).all():
        await db.delete(old)
    if not reviews:
        await db.commit()
        return 0
    insights: list[dict[str, Any]] = []
    generated_by = "heuristic"
    llm = get_llm()
    if llm is not None:
        try:
            prompt = {"business": org.name, "industry": org.industry, "reviews": [{"id": str(r.id), "rating": r.rating, "text": (r.comment or "")[:400], "weekday": r.review_created_at.strftime("%A")} for r in reviews[:150]]}
            res = await llm.complete_json(SUMMARY_SYSTEM, json.dumps(prompt, ensure_ascii=False))
            await _meter(db, org_id, res, True)
            generated_by = "openai"
            for c in res.data.get("recurring_complaints", []):
                insights.append({"kind": "complaint", "title": c["title"], "detail": c["detail"], "evidence_count": int(c.get("count") or 0), "severity": "warning"})
            for p in res.data.get("positive_highlights", []):
                insights.append({"kind": "praise", "title": p["title"], "detail": p["detail"], "evidence_count": int(p.get("count") or 0), "severity": "positive"})
            for rec in res.data.get("recommendations", []):
                insights.append({"kind": "recommendation", "title": rec["title"], "detail": rec["detail"], "evidence_count": 0, "severity": "info"})
        except AIProviderError as exc:
            log.warning("Insight generation via OpenAI failed, using heuristic: %s", exc)
    if not insights:
        neg: dict[str, list[Review]] = defaultdict(list)
        pos: dict[str, list[Review]] = defaultdict(list)
        for r in reviews:
            _, _, topics = heuristic_sentiment(r.comment, r.rating)
            for t in topics:
                (neg if r.rating <= 3 else pos)[t].append(r)
        n = len(reviews)
        for t, rs in sorted(neg.items(), key=lambda kv: -len(kv[1]))[:3]:
            if len(rs) >= 2:
                insights.append({"kind": "complaint", "title": f"Customers repeatedly mention {TOPIC_LABELS[t]}", "detail": f"{len(rs)} of {n} reviews in the last {days} days raise concerns about {TOPIC_LABELS[t]}.", "evidence": rs, "severity": "warning"})
        for t, rs in sorted(pos.items(), key=lambda kv: -len(kv[1]))[:3]:
            if len(rs) >= 2:
                insights.append({"kind": "praise", "title": f"{TOPIC_LABELS[t].capitalize()} receives positive feedback", "detail": f"{len(rs)} positive reviews specifically appreciate {TOPIC_LABELS[t]}.", "evidence": rs, "severity": "positive"})
        weekend = [r.rating for r in reviews if r.review_created_at.weekday() >= 5]
        weekday = [r.rating for r in reviews if r.review_created_at.weekday() < 5]
        if len(weekend) >= 3 and len(weekday) >= 3:
            we, wd = sum(weekend) / len(weekend), sum(weekday) / len(weekday)
            if wd - we >= 0.3:
                insights.append({"kind": "trend", "title": "Weekend experiences receive lower ratings", "detail": f"Weekend reviews average {we:.1f}★ vs {wd:.1f}★ on weekdays ({len(weekend)} vs {len(weekday)} reviews).", "severity": "warning", "evidence": []})
        if neg:
            top = max(neg.items(), key=lambda kv: len(kv[1]))[0]
            insights.append({"kind": "recommendation", "title": f"Prioritise {TOPIC_LABELS[top]}", "detail": f"Addressing {TOPIC_LABELS[top]} would resolve the most frequent complaint theme. Brief staff and track it for 30 days.", "severity": "info", "evidence": []})
    for ins in insights:
        evidence = ins.pop("evidence", None)
        db.add(AIInsight(
            organization_id=org_id, period_start=now() - timedelta(days=days), period_end=now(), generated_by=generated_by,
            evidence_count=ins.pop("evidence_count", len(evidence) if evidence else 0),
            evidence_review_ids=[str(r.id) for r in (evidence or [])][:20], **ins,
        ))
    await db.commit()
    return len(insights)
