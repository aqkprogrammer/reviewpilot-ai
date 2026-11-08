from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.config import settings
from app.core.deps import DB, OrgContext, require_perm
from app.core.errors import NotFound
from app.core.permissions import Perm
from app.core.security import now
from app.models import AIGeneration, AIInsight, AIUsage
from app.services import ai as ai_svc
from app.services.jobs import enqueue
from app.services.organizations import effective_plan

router = APIRouter(prefix="/ai", tags=["ai"])
AIUser = Depends(require_perm(Perm.AI_USE))


class ReplyIn(BaseModel):
    review_text: str | None = Field(None, max_length=4000)
    rating: int = Field(ge=1, le=5)
    reviewer_name: str | None = Field(None, max_length=200)
    tone: str = Field("professional", pattern="^(professional|friendly|empathetic|appreciative|concise|apologetic)$")
    language: str = Field("en", pattern="^(en|hi|hinglish)$")


class SentimentIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    rating: int | None = Field(None, ge=1, le=5)


class SummaryIn(BaseModel):
    days: int = Field(30, ge=7, le=365)
    location_id: uuid.UUID | None = None


class TemplateGenIn(BaseModel):
    purpose: str = Field("review_request", pattern="^(review_request|follow_up|thank_you|service_recovery)$")
    channel: str = Field("whatsapp", pattern="^(whatsapp|email|sms)$")
    language: str = Field("en", pattern="^(en|hi|hinglish)$")
    tone: str = Field("friendly", max_length=32)


@router.get("/status")
async def status(db: DB, ctx: OrgContext = AIUser):
    plan = await effective_plan(db, ctx.org_id)
    usage = await db.scalar(select(AIUsage).where(AIUsage.organization_id == ctx.org_id, AIUsage.period == now().strftime("%Y-%m")))
    return {
        "provider": "openai" if settings.openai_configured else "heuristic",
        "model": settings.openai_model if settings.openai_configured else "reviewpilot-heuristic-v1",
        "configured": settings.openai_configured,
        "entitled": bool(plan and plan.entitlements.get("ai_replies")),
        "plan": plan.name if plan else None,
        "used": usage.requests if usage else 0,
        "limit": plan.ai_requests_per_month if plan else 0,
        "tokens": (usage.prompt_tokens + usage.completion_tokens) if usage else 0,
    }


@router.post("/reply")
async def reply(data: ReplyIn, db: DB, ctx: OrgContext = AIUser):
    out, _ = await ai_svc.generate_reply(db, ctx.organization, ctx.user.id, review_text=data.review_text, rating=data.rating, reviewer_name=data.reviewer_name, tone=data.tone, language=data.language)
    await db.commit()
    return out


@router.post("/sentiment")
async def sentiment(data: SentimentIn, db: DB, ctx: OrgContext = AIUser):
    out = await ai_svc.analyze_sentiment(db, ctx.organization, ctx.user.id, data.text, data.rating)
    await db.commit()
    return out


@router.post("/summary")
async def summary(data: SummaryIn, db: DB, ctx: OrgContext = AIUser):
    if data.location_id:
        ctx.ensure_location(data.location_id)
    out = await ai_svc.summarize(db, ctx.organization, ctx.user.id, data.days, data.location_id)
    await db.commit()
    return out


@router.post("/templates")
async def templates(data: TemplateGenIn, db: DB, ctx: OrgContext = AIUser):
    out = await ai_svc.generate_template(db, ctx.organization, ctx.user.id, purpose=data.purpose, channel=data.channel, language=data.language, tone=data.tone)
    await db.commit()
    return out


@router.get("/insights")
async def insights(db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ))):
    rows = (await db.scalars(select(AIInsight).where(AIInsight.organization_id == ctx.org_id, AIInsight.is_dismissed.is_(False)).order_by(AIInsight.kind, AIInsight.evidence_count.desc()))).all()
    last = max((r.created_at for r in rows), default=None)
    return {
        "generated_at": last.isoformat() if last else None,
        "items": [{"id": str(r.id), "kind": r.kind, "title": r.title, "detail": r.detail, "severity": r.severity, "evidence_count": r.evidence_count, "evidence_review_ids": r.evidence_review_ids, "generated_by": r.generated_by} for r in rows],
    }


@router.post("/insights/refresh")
async def refresh_insights(db: DB, ctx: OrgContext = AIUser):
    job = await enqueue("generate_ai_insights", organization_id=ctx.org_id, org_id=str(ctx.org_id))
    return {"job_id": str(job), "message": "Insights are being regenerated from your latest reviews."}


@router.post("/insights/{insight_id}/dismiss")
async def dismiss(insight_id: uuid.UUID, db: DB, ctx: OrgContext = AIUser):
    ins = await db.get(AIInsight, insight_id)
    if ins is None or ins.organization_id != ctx.org_id:
        raise NotFound("Insight not found")
    ins.is_dismissed = True
    await db.commit()
    return {"ok": True}


@router.get("/history")
async def history(db: DB, ctx: OrgContext = AIUser, limit: int = Query(20, le=100)):
    rows = (await db.scalars(select(AIGeneration).where(AIGeneration.organization_id == ctx.org_id).order_by(AIGeneration.created_at.desc()).limit(limit))).all()
    return [{"id": str(g.id), "kind": g.kind, "provider": g.provider, "model": g.model, "tokens": g.prompt_tokens + g.completion_tokens, "success": g.success, "created_at": g.created_at.isoformat(), "output": g.output} for g in rows]


@router.get("/usage")
async def usage(db: DB, ctx: OrgContext = AIUser):
    rows = (await db.scalars(select(AIUsage).where(AIUsage.organization_id == ctx.org_id).order_by(AIUsage.period.desc()).limit(12))).all()
    day = func.date_trunc("day", AIGeneration.created_at)
    daily = (await db.execute(select(day, func.count()).where(AIGeneration.organization_id == ctx.org_id, AIGeneration.created_at >= now() - timedelta(days=30)).group_by(day).order_by(day))).all()
    return {
        "months": [{"period": u.period, "requests": u.requests, "failed": u.failed_requests, "tokens": u.prompt_tokens + u.completion_tokens} for u in rows],
        "daily": [{"date": d.date().isoformat(), "requests": n} for d, n in daily],
    }
