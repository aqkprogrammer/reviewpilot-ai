from __future__ import annotations

import uuid
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select

from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.errors import AppError, NotFound
from app.core.permissions import Perm
from app.core.security import now
from app.models import GoogleConnection, Location, Review, ReviewReply
from app.models.enums import IntegrationStatus, ReplyStatus, ResponseStatus, ReviewSource
from app.schemas.common import Page
from app.schemas.review import ReplyDraftIn, ReplyOut, ReviewDetail, ReviewOut, ReviewStats, SuggestIn, SuggestOut
from app.services import ai as ai_svc
from app.services import audit
from app.services.jobs import enqueue
from app.services.locations import scoped_location_filter

router = APIRouter(prefix="/reviews", tags=["reviews"])


async def _get_review(db, ctx: OrgContext, review_id: uuid.UUID) -> Review:
    review = await db.get(Review, review_id)
    if review is None or review.organization_id != ctx.org_id:
        raise NotFound("Review not found")
    ctx.ensure_location(review.location_id)
    return review


def _filters(ctx: OrgContext, *, rating, location_id, status, source, date_from, date_to, q, sentiment):
    conds = [Review.organization_id == ctx.org_id, scoped_location_filter(ctx, Review.location_id)]
    if rating:
        conds.append(Review.rating.in_(rating))
    if location_id:
        conds.append(Review.location_id == location_id)
    if status:
        conds.append(Review.response_status == status)
    if source:
        conds.append(Review.source == source)
    if sentiment:
        conds.append(Review.sentiment == sentiment)
    if date_from:
        conds.append(Review.review_created_at >= datetime.combine(date_from, time.min).astimezone())
    if date_to:
        conds.append(Review.review_created_at <= datetime.combine(date_to, time.max).astimezone())
    if q:
        like = f"%{q.strip()}%"
        conds.append(or_(Review.comment.ilike(like), Review.reviewer_name.ilike(like)))
    return conds


@router.get("", response_model=Page[ReviewOut])
async def list_reviews(
    db: DB,
    ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    rating: list[int] | None = Query(None),
    location_id: uuid.UUID | None = None,
    status: str | None = Query(None, pattern="^(pending|responded|handled)$"),
    source: str | None = None,
    sentiment: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = Query(None, max_length=200),
    sort: str = Query("newest", pattern="^(newest|oldest|rating_high|rating_low)$"),
):
    conds = _filters(ctx, rating=rating, location_id=location_id, status=status, source=source, date_from=date_from, date_to=date_to, q=q, sentiment=sentiment)
    total = await db.scalar(select(func.count()).select_from(Review).where(*conds))
    order = {
        "newest": Review.review_created_at.desc(),
        "oldest": Review.review_created_at.asc(),
        "rating_high": Review.rating.desc(),
        "rating_low": Review.rating.asc(),
    }[sort]
    rows = (
        await db.execute(
            select(Review, Location.name)
            .join(Location, Location.id == Review.location_id)
            .where(*conds)
            .order_by(order, Review.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [ReviewOut.model_validate(r).model_copy(update={"location_name": name}) for r, name in rows]
    return Page.build(items, total or 0, page, page_size)


@router.get("/stats", response_model=ReviewStats)
async def review_stats(db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ)), location_id: uuid.UUID | None = None):
    conds = [Review.organization_id == ctx.org_id, scoped_location_filter(ctx, Review.location_id)]
    if location_id:
        conds.append(Review.location_id == location_id)
    row = (
        await db.execute(
            select(
                func.count(),
                func.avg(Review.rating),
                func.count().filter(Review.response_status == ResponseStatus.PENDING),
                func.count().filter(Review.response_status == ResponseStatus.RESPONDED),
                func.count().filter(Review.response_status == ResponseStatus.PENDING, Review.rating <= 2),
            ).where(*conds)
        )
    ).one()
    return ReviewStats(total=row[0], average_rating=round(float(row[1]), 2) if row[1] else None, pending=row[2], responded=row[3], negative_pending=row[4])


async def _detail(db, ctx: OrgContext, review: Review) -> ReviewDetail:
    replies = (await db.scalars(select(ReviewReply).where(ReviewReply.review_id == review.id).order_by(ReviewReply.created_at.desc()))).all()
    loc = await db.get(Location, review.location_id)
    mode, can = "demo", True
    if review.source == ReviewSource.GOOGLE:
        conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
        can = bool(conn and conn.status == IntegrationStatus.CONNECTED)
        mode = "google" if can else "unavailable"
    detail = ReviewDetail.model_validate(review).model_copy(
        update={"location_name": loc.name if loc else None, "replies": [ReplyOut.model_validate(r) for r in replies], "publish_mode": mode, "can_publish": can and ctx.can(Perm.REVIEWS_REPLY)}
    )
    return detail


@router.get("/{review_id}", response_model=ReviewDetail)
async def get_review(review_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_READ))):
    return await _detail(db, ctx, await _get_review(db, ctx, review_id))


@router.post("/{review_id}/suggest", response_model=SuggestOut)
async def suggest_reply(review_id: uuid.UUID, data: SuggestIn, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    review = await _get_review(db, ctx, review_id)
    out, _ = await ai_svc.generate_reply(
        db, ctx.organization, ctx.user.id, review_text=review.comment, rating=review.rating, reviewer_name=review.reviewer_name,
        tone=data.tone, language=data.language, review_id=review.id,
    )
    await db.commit()
    return SuggestOut(**{k: out.get(k) for k in ("reply", "explanation", "sentiment", "follow_up", "provider", "generation_id")}, keywords=out.get("keywords") or [])


@router.put("/{review_id}/reply", response_model=ReviewDetail)
async def save_draft(review_id: uuid.UUID, data: ReplyDraftIn, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    """Create or update the single editable draft for this review."""
    review = await _get_review(db, ctx, review_id)
    draft = await db.scalar(select(ReviewReply).where(ReviewReply.review_id == review.id, ReviewReply.status.in_([ReplyStatus.DRAFT, ReplyStatus.FAILED])))
    if draft is None:
        draft = ReviewReply(organization_id=ctx.org_id, review_id=review.id, author_id=ctx.user.id, body=data.body)
        db.add(draft)
    draft.body, draft.tone, draft.language, draft.status = data.body, data.tone, data.language, ReplyStatus.DRAFT
    if data.ai_generation_id:
        draft.ai_generation_id = data.ai_generation_id
    review.history = [*review.history, {"at": now().isoformat(), "by": ctx.user.full_name, "event": "draft_saved"}]
    await db.commit()
    return await _detail(db, ctx, review)


@router.post("/{review_id}/reply/publish", response_model=ReviewDetail)
async def publish_reply(review_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    """Publish the owner-approved draft. This explicit call is the human approval step."""
    review = await _get_review(db, ctx, review_id)
    draft = await db.scalar(select(ReviewReply).where(ReviewReply.review_id == review.id, ReviewReply.status.in_([ReplyStatus.DRAFT, ReplyStatus.FAILED])))
    if draft is None:
        raise AppError("Save a reply draft before publishing.", code="no_draft")
    draft.approved_by_id = ctx.user.id
    if review.source == ReviewSource.DEMO:
        # Demo reviews are not on Google — record the publish locally, clearly labelled.
        draft.status = ReplyStatus.PUBLISHED
        draft.published_at = now()
        review.platform_reply, review.platform_reply_at = draft.body, now()
        review.response_status = ResponseStatus.RESPONDED
        review.history = [*review.history, {"at": now().isoformat(), "by": ctx.user.full_name, "event": "reply_published_demo", "note": "Demo data — not sent to Google"}]
    else:
        conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
        if not conn or conn.status != IntegrationStatus.CONNECTED:
            raise AppError("Connect Google Business Profile to publish replies to Google.", code="google_not_connected", status_code=409)
        draft.status = ReplyStatus.PENDING_PUBLISH
        review.history = [*review.history, {"at": now().isoformat(), "by": ctx.user.full_name, "event": "reply_queued_for_google"}]
    await audit.record(db, "review.reply_published", actor=ctx.user, organization_id=ctx.org_id, target_type="review", target_id=review.id, request=request, meta={"source": review.source})
    await db.commit()
    if draft.status == ReplyStatus.PENDING_PUBLISH:
        await enqueue("publish_review_reply", organization_id=ctx.org_id, reply_id=str(draft.id))
    return await _detail(db, ctx, review)


@router.post("/{review_id}/handled", response_model=ReviewDetail)
async def mark_handled(review_id: uuid.UUID, request: Request, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    review = await _get_review(db, ctx, review_id)
    review.response_status = ResponseStatus.HANDLED
    review.handled_at, review.handled_by_id = now(), ctx.user.id
    review.history = [*review.history, {"at": now().isoformat(), "by": ctx.user.full_name, "event": "marked_handled"}]
    await audit.record(db, "review.marked_handled", actor=ctx.user, organization_id=ctx.org_id, target_type="review", target_id=review.id, request=request)
    await db.commit()
    return await _detail(db, ctx, review)


@router.post("/{review_id}/reopen", response_model=ReviewDetail)
async def reopen(review_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    review = await _get_review(db, ctx, review_id)
    review.response_status = ResponseStatus.RESPONDED if review.platform_reply else ResponseStatus.PENDING
    review.handled_at = None
    review.history = [*review.history, {"at": now().isoformat(), "by": ctx.user.full_name, "event": "reopened"}]
    await db.commit()
    return await _detail(db, ctx, review)


@router.post("/{review_id}/flag", response_model=ReviewDetail)
async def toggle_flag(review_id: uuid.UUID, db: DB, ctx: OrgContext = Depends(require_perm(Perm.REVIEWS_REPLY))):
    review = await _get_review(db, ctx, review_id)
    review.is_flagged = not review.is_flagged
    await db.commit()
    return await _detail(db, ctx, review)


@router.get("/{review_id}/replies", response_model=list[ReplyOut])
async def list_replies(review_id: uuid.UUID, db: DB, ctx: Org):
    review = await _get_review(db, ctx, review_id)
    rows = await db.scalars(select(ReviewReply).where(ReviewReply.review_id == review.id).order_by(ReviewReply.created_at.desc()))
    return rows.all()
