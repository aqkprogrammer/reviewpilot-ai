"""Analytics computed directly from stored records. Every metric ships with its definition."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import OrgContext
from app.models import Campaign, FeedbackSubmission, Location, QRScan, Review, ReviewRequest
from app.models.enums import RequestStatus, ResponseStatus
from app.services.locations import scoped_location_filter

DEFINITIONS = {
    "total_reviews": "All reviews stored for the selected locations (Google-synchronised, or demo data in demo organisations).",
    "average_rating": "Mean star rating of reviews created in the period.",
    "new_reviews": "Reviews whose platform creation date falls in the period.",
    "requests_sent": "Review requests accepted by the messaging provider in the period (QR scans excluded).",
    "conversion_rate": "Google click-through rate: requests where the customer clicked “Review on Google” ÷ requests sent. "
    "A click is measurable intent; ReviewPilot cannot confirm a review was posted.",
    "response_rate": "Reviews created in the period that have an owner reply (published via ReviewPilot or already on the platform) ÷ reviews in the period.",
    "qr_scans": "Scans of ReviewPilot QR codes, counted by our first-party redirect (rapid duplicate scans de-duplicated).",
}


class Range:
    def __init__(self, start: datetime, end: datetime):
        self.start, self.end = start, end

    @property
    def days(self) -> int:
        return max(1, (self.end - self.start).days)

    def previous(self) -> "Range":
        span = self.end - self.start
        return Range(self.start - span, self.start)


def resolve_range(period: str | None, date_from: date | None, date_to: date | None) -> Range:
    now = datetime.now(UTC)
    if date_from and date_to:
        return Range(datetime.combine(date_from, time.min, UTC), datetime.combine(date_to, time.max, UTC))
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period or "30d", 30)
    return Range(now - timedelta(days=days), now)


def _review_conds(ctx: OrgContext, location_id: uuid.UUID | None):
    conds = [Review.organization_id == ctx.org_id, scoped_location_filter(ctx, Review.location_id)]
    if location_id:
        conds.append(Review.location_id == location_id)
    return conds


def _req_conds(ctx: OrgContext, location_id: uuid.UUID | None, campaign_id: uuid.UUID | None = None, channel: str | None = None):
    conds = [ReviewRequest.organization_id == ctx.org_id, scoped_location_filter(ctx, ReviewRequest.location_id)]
    if location_id:
        conds.append(ReviewRequest.location_id == location_id)
    if campaign_id:
        conds.append(ReviewRequest.campaign_id == campaign_id)
    if channel:
        conds.append(ReviewRequest.channel == channel)
    return conds


async def _kpis_for(db: AsyncSession, ctx: OrgContext, r: Range, location_id, campaign_id=None, channel=None) -> dict:
    rc = _review_conds(ctx, location_id)
    in_period = [*rc, Review.review_created_at >= r.start, Review.review_created_at <= r.end]
    row = (
        await db.execute(
            select(
                func.count(),
                func.avg(Review.rating),
                func.count().filter(Review.platform_reply.is_not(None)),
            ).where(*in_period)
        )
    ).one()
    total = await db.scalar(select(func.count()).select_from(Review).where(*rc, Review.review_created_at <= r.end))
    overall_avg = await db.scalar(select(func.avg(Review.rating)).where(*rc, Review.review_created_at <= r.end))
    q = _req_conds(ctx, location_id, campaign_id, channel)
    req = (
        await db.execute(
            select(
                func.count().filter(ReviewRequest.sent_at.is_not(None)),
                func.count().filter(ReviewRequest.google_clicked_at.is_not(None)),
                func.count().filter(ReviewRequest.delivered_at.is_not(None)),
                func.count().filter(ReviewRequest.status == RequestStatus.FAILED),
                func.count().filter(ReviewRequest.clicked_at.is_not(None)),
            ).where(*q, ReviewRequest.created_at >= r.start, ReviewRequest.created_at <= r.end)
        )
    ).one()
    scans_q = select(func.count()).select_from(QRScan).where(QRScan.organization_id == ctx.org_id, QRScan.scanned_at >= r.start, QRScan.scanned_at <= r.end)
    scans = await db.scalar(scans_q)
    n, avg, replied = row
    sent, gclicks, delivered, failed, clicks = req
    return {
        "total_reviews": total or 0,
        "average_rating": round(float(overall_avg), 2) if overall_avg else None,
        "period_average_rating": round(float(avg), 2) if avg else None,
        "new_reviews": n,
        "requests_sent": sent,
        "requests_delivered": delivered,
        "requests_failed": failed,
        "page_opens": clicks,
        "google_clicks": gclicks,
        "conversion_rate": round(gclicks / sent, 4) if sent else None,
        "response_rate": round(replied / n, 4) if n else None,
        "qr_scans": scans or 0,
    }


def _delta(cur, prev):
    if cur is None or prev in (None, 0):
        return None
    return round((cur - prev) / prev, 4)


async def overview(db: AsyncSession, ctx: OrgContext, r: Range, location_id: uuid.UUID | None) -> dict:
    cur = await _kpis_for(db, ctx, r, location_id)
    prev = await _kpis_for(db, ctx, r.previous(), location_id)
    deltas = {k: _delta(cur.get(k), prev.get(k)) for k in cur}
    return {
        "kpis": cur,
        "previous": prev,
        "deltas": deltas,
        "definitions": DEFINITIONS,
        "is_demo": ctx.organization.is_demo,
        "range": {"start": r.start.isoformat(), "end": r.end.isoformat()},
    }


async def review_series(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    bucket = "week" if r.days > 120 else "day"
    b = func.date_trunc(bucket, Review.review_created_at)
    rows = (
        await db.execute(
            select(b, func.count(), func.avg(Review.rating), func.count().filter(Review.rating >= 4), func.count().filter(Review.rating <= 2))
            .where(*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end)
            .group_by(b).order_by(b)
        )
    ).all()
    base = await db.scalar(select(func.count()).select_from(Review).where(*_review_conds(ctx, location_id), Review.review_created_at < r.start)) or 0
    by_key = {d.date(): (n, avg, pos, neg) for d, n, avg, pos, neg in rows}
    out, cumulative = [], base
    step = timedelta(days=7 if bucket == "week" else 1)
    cursor = r.start.date() if bucket == "day" else (r.start - timedelta(days=r.start.weekday())).date()
    while cursor <= r.end.date():
        n, avg, pos, neg = by_key.get(cursor, (0, None, 0, 0))
        cumulative += n
        out.append({"date": cursor.isoformat(), "reviews": n, "avg_rating": round(float(avg), 2) if avg else None, "positive": pos, "negative": neg, "cumulative": cumulative})
        cursor += step
    return out


async def rating_distribution(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    rows = dict((await db.execute(select(Review.rating, func.count()).where(*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end).group_by(Review.rating))).all())
    total = sum(rows.values()) or 1
    return [{"rating": s, "count": rows.get(s, 0), "share": round(rows.get(s, 0) / total, 4)} for s in (5, 4, 3, 2, 1)]


async def sentiment_breakdown(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    rows = (await db.execute(select(func.coalesce(Review.sentiment, "unclassified"), func.count()).where(*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end).group_by(Review.sentiment))).all()
    return [{"sentiment": s, "count": n} for s, n in rows]


async def topic_breakdown(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    t = func.unnest(Review.topics).label("topic")
    sub = select(t, Review.rating).where(*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end).subquery()
    rows = (await db.execute(select(sub.c.topic, func.count(), func.avg(sub.c.rating)).group_by(sub.c.topic).order_by(func.count().desc()).limit(10))).all()
    return [{"topic": tp, "mentions": n, "avg_rating": round(float(a), 2)} for tp, n, a in rows]


async def source_distribution(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    rows = (await db.execute(select(Review.source, func.count()).where(*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end).group_by(Review.source))).all()
    fb = await db.scalar(select(func.count()).select_from(FeedbackSubmission).where(FeedbackSubmission.organization_id == ctx.org_id, FeedbackSubmission.created_at >= r.start, FeedbackSubmission.created_at <= r.end))
    out = [{"source": s, "label": "Google (synced)" if s == "google" else "Demo data", "count": n} for s, n in rows]
    out.append({"source": "private_feedback", "label": "Private feedback (not public)", "count": fb or 0})
    return out


async def location_performance(db: AsyncSession, ctx: OrgContext, r: Range) -> list[dict]:
    rows = (
        await db.execute(
            select(
                Location.id, Location.name, func.count(Review.id), func.avg(Review.rating),
                func.count(Review.id).filter(Review.response_status != ResponseStatus.PENDING),
            )
            .outerjoin(Review, (Review.location_id == Location.id) & (Review.review_created_at >= r.start) & (Review.review_created_at <= r.end))
            .where(Location.organization_id == ctx.org_id, Location.deleted_at.is_(None), scoped_location_filter(ctx, Location.id))
            .group_by(Location.id, Location.name)
            .order_by(Location.name)
        )
    ).all()
    req = dict(
        (await db.execute(select(ReviewRequest.location_id, func.count().filter(ReviewRequest.sent_at.is_not(None))).where(ReviewRequest.organization_id == ctx.org_id, ReviewRequest.created_at >= r.start).group_by(ReviewRequest.location_id))).all()
    )
    return [
        {"location_id": str(i), "name": n, "reviews": c, "avg_rating": round(float(a), 2) if a else None, "response_rate": round(resp / c, 4) if c else None, "requests_sent": req.get(i, 0)}
        for i, n, c, a, resp in rows
    ]


async def campaign_performance(db: AsyncSession, ctx: OrgContext, r: Range, location_id, limit: int = 8) -> list[dict]:
    stmt = (
        select(
            Campaign.id, Campaign.name, Campaign.channel, Campaign.status,
            func.count(ReviewRequest.id).filter(ReviewRequest.sent_at.is_not(None)),
            func.count(ReviewRequest.id).filter(ReviewRequest.delivered_at.is_not(None)),
            func.count(ReviewRequest.id).filter(ReviewRequest.status == RequestStatus.FAILED),
            func.count(ReviewRequest.id).filter(ReviewRequest.clicked_at.is_not(None)),
            func.count(ReviewRequest.id).filter(ReviewRequest.google_clicked_at.is_not(None)),
        )
        .outerjoin(ReviewRequest, ReviewRequest.campaign_id == Campaign.id)
        .where(Campaign.organization_id == ctx.org_id, Campaign.deleted_at.is_(None), Campaign.created_at <= r.end, scoped_location_filter(ctx, Campaign.location_id))
        .group_by(Campaign.id)
        .order_by(Campaign.created_at.desc())
        .limit(limit)
    )
    if location_id:
        stmt = stmt.where(Campaign.location_id == location_id)
    rows = (await db.execute(stmt)).all()
    return [
        {"campaign_id": str(i), "name": n, "channel": ch, "status": st, "sent": s, "delivered": d, "failed": f, "clicks": c, "google_clicks": g, "conversion_rate": round(g / s, 4) if s else None}
        for i, n, ch, st, s, d, f, c, g in rows
    ]


async def channel_delivery(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> list[dict]:
    rows = (
        await db.execute(
            select(
                ReviewRequest.channel, func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.delivered_at.is_not(None)),
                func.count().filter(ReviewRequest.status == RequestStatus.FAILED), func.count().filter(ReviewRequest.status == RequestStatus.SKIPPED),
                func.count().filter(ReviewRequest.google_clicked_at.is_not(None)),
            ).where(*_req_conds(ctx, location_id), ReviewRequest.created_at >= r.start, ReviewRequest.created_at <= r.end).group_by(ReviewRequest.channel)
        )
    ).all()
    return [{"channel": ch, "sent": s, "delivered": d, "failed": f, "skipped": sk, "google_clicks": g} for ch, s, d, f, sk, g in rows]


async def response_stats(db: AsyncSession, ctx: OrgContext, r: Range, location_id) -> dict:
    conds = [*_review_conds(ctx, location_id), Review.review_created_at >= r.start, Review.review_created_at <= r.end]
    row = (
        await db.execute(
            select(
                func.count().filter(Review.response_status == ResponseStatus.PENDING),
                func.count().filter(Review.response_status == ResponseStatus.RESPONDED),
                func.count().filter(Review.response_status == ResponseStatus.HANDLED),
                func.avg(case((Review.platform_reply_at.is_not(None), func.extract("epoch", Review.platform_reply_at - Review.review_created_at) / 3600))),
            ).where(*conds)
        )
    ).one()
    return {"pending": row[0], "responded": row[1], "handled": row[2], "avg_response_hours": round(float(row[3]), 1) if row[3] else None}


async def monthly_report(db: AsyncSession, ctx: OrgContext, months: int = 6) -> list[dict]:
    m = func.date_trunc("month", Review.review_created_at)
    start = (datetime.now(UTC).replace(day=1) - timedelta(days=31 * (months - 1))).replace(day=1)
    rows = (await db.execute(select(m, func.count(), func.avg(Review.rating), func.count().filter(Review.platform_reply.is_not(None))).where(*_review_conds(ctx, None), Review.review_created_at >= start).group_by(m).order_by(m))).all()
    rm = func.date_trunc("month", ReviewRequest.created_at)
    reqs = {d.date(): (s, g) for d, s, g in (await db.execute(select(rm, func.count().filter(ReviewRequest.sent_at.is_not(None)), func.count().filter(ReviewRequest.google_clicked_at.is_not(None))).where(*_req_conds(ctx, None), ReviewRequest.created_at >= start).group_by(rm))).all()}
    return [
        {"month": d.strftime("%Y-%m"), "reviews": n, "avg_rating": round(float(a), 2) if a else None, "response_rate": round(rep / n, 4) if n else None, "requests_sent": reqs.get(d.date(), (0, 0))[0], "google_clicks": reqs.get(d.date(), (0, 0))[1]}
        for d, n, a, rep in rows
    ]
