from __future__ import annotations

import csv
import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import select

from app.core.deps import DB, Org, OrgContext, require_perm
from app.core.permissions import Perm
from app.models import AIInsight, Review
from app.services import analytics as a
from app.services.locations import scoped_location_filter

router = APIRouter(prefix="/analytics", tags=["analytics"])

RangeQ = Query("30d", pattern="^(7d|30d|90d|365d|custom)$")


@router.get("/overview")
async def overview(ctx: Org, db: DB, period: str = RangeQ, date_from: date | None = None, date_to: date | None = None, location_id: uuid.UUID | None = None):
    """Dashboard payload. Available to every member (dashboard is the landing page)."""
    r = a.resolve_range(period, date_from, date_to)
    data = await a.overview(db, ctx, r, location_id)
    data["series"] = await a.review_series(db, ctx, r, location_id)
    data["ratings"] = await a.rating_distribution(db, ctx, r, location_id)
    data["sentiment"] = await a.sentiment_breakdown(db, ctx, r, location_id)
    data["locations"] = await a.location_performance(db, ctx, r)
    data["campaigns"] = await a.campaign_performance(db, ctx, r, location_id, limit=5)
    insights = (await db.scalars(select(AIInsight).where(AIInsight.organization_id == ctx.org_id, AIInsight.is_dismissed.is_(False)).order_by(AIInsight.created_at.desc()).limit(6))).all()
    data["insights"] = [{"id": str(i.id), "kind": i.kind, "title": i.title, "detail": i.detail, "severity": i.severity, "evidence_count": i.evidence_count, "generated_by": i.generated_by} for i in insights]
    recent = (
        await db.scalars(select(Review).where(Review.organization_id == ctx.org_id, scoped_location_filter(ctx, Review.location_id)).order_by(Review.review_created_at.desc()).limit(6))
    ).all()
    data["recent_reviews"] = [
        {"id": str(x.id), "reviewer_name": x.reviewer_name, "rating": x.rating, "comment": x.comment, "review_created_at": x.review_created_at.isoformat(), "response_status": x.response_status, "source": x.source, "location_id": str(x.location_id)}
        for x in recent
    ]
    return data


@router.get("/detailed")
async def detailed(
    db: DB, ctx: OrgContext = Depends(require_perm(Perm.ANALYTICS_READ)), period: str = RangeQ, date_from: date | None = None, date_to: date | None = None,
    location_id: uuid.UUID | None = None, campaign_id: uuid.UUID | None = None, channel: str | None = None,
):
    r = a.resolve_range(period, date_from, date_to)
    data = await a.overview(db, ctx, r, location_id)
    data["series"] = await a.review_series(db, ctx, r, location_id)
    data["ratings"] = await a.rating_distribution(db, ctx, r, location_id)
    data["sentiment"] = await a.sentiment_breakdown(db, ctx, r, location_id)
    data["topics"] = await a.topic_breakdown(db, ctx, r, location_id)
    data["sources"] = await a.source_distribution(db, ctx, r, location_id)
    data["locations"] = await a.location_performance(db, ctx, r)
    data["campaigns"] = await a.campaign_performance(db, ctx, r, location_id, limit=12)
    data["channels"] = await a.channel_delivery(db, ctx, r, location_id)
    data["responses"] = await a.response_stats(db, ctx, r, location_id)
    data["monthly"] = await a.monthly_report(db, ctx)
    if campaign_id or channel:
        data["filtered_kpis"] = await a._kpis_for(db, ctx, r, location_id, campaign_id, channel)
    return data


@router.get("/export.csv")
async def export_csv(db: DB, ctx: OrgContext = Depends(require_perm(Perm.ANALYTICS_READ)), period: str = RangeQ, date_from: date | None = None, date_to: date | None = None, location_id: uuid.UUID | None = None):
    r = a.resolve_range(period, date_from, date_to)
    series = await a.review_series(db, ctx, r, location_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# ReviewPilot AI analytics export", ctx.organization.name, "DEMO DATA" if ctx.organization.is_demo else "", r.start.date(), r.end.date()])
    w.writerow(["date", "new_reviews", "avg_rating", "positive_reviews", "negative_reviews", "cumulative_reviews"])
    for row in series:
        w.writerow([row["date"], row["reviews"], row["avg_rating"] or "", row["positive"], row["negative"], row["cumulative"]])
    w.writerow([])
    w.writerow(["location", "reviews", "avg_rating", "response_rate", "requests_sent"])
    for loc in await a.location_performance(db, ctx, r):
        w.writerow([loc["name"], loc["reviews"], loc["avg_rating"] or "", loc["response_rate"] if loc["response_rate"] is not None else "", loc["requests_sent"]])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="analytics-{r.start.date()}-{r.end.date()}.csv"'})


@router.get("/report.pdf")
async def report_pdf(db: DB, ctx: OrgContext = Depends(require_perm(Perm.ANALYTICS_READ)), period: str = RangeQ, date_from: date | None = None, date_to: date | None = None, location_id: uuid.UUID | None = None):
    r = a.resolve_range(period, date_from, date_to)
    ov = await a.overview(db, ctx, r, location_id)
    ratings = await a.rating_distribution(db, ctx, r, location_id)
    locs = await a.location_performance(db, ctx, r)
    monthly = await a.monthly_report(db, ctx)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    ink, muted, accent = HexColor("#0b1218"), HexColor("#52616c"), HexColor(ctx.organization.brand_color or "#0e9aa7")
    c.setFillColor(accent)
    c.rect(0, h - 8, w, 8, stroke=0, fill=1)
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, h - 60, f"{ctx.organization.name} — Reputation report")
    c.setFont("Helvetica", 10)
    c.setFillColor(muted)
    c.drawString(40, h - 78, f"{r.start.date():%d %b %Y} – {r.end.date():%d %b %Y}" + ("   ·   DEMO DATA (sample records, not real reviews)" if ctx.organization.is_demo else ""))
    k = ov["kpis"]
    tiles = [
        ("Total reviews", f"{k['total_reviews']}"), ("Average rating", f"{k['average_rating'] or '—'}"), ("New reviews", f"{k['new_reviews']}"),
        ("Requests sent", f"{k['requests_sent']}"), ("Google click-through", f"{(k['conversion_rate'] or 0) * 100:.1f}%"), ("Response rate", f"{(k['response_rate'] or 0) * 100:.1f}%"),
    ]
    y = h - 130
    for i, (label, value) in enumerate(tiles):
        x = 40 + (i % 3) * 175
        yy = y - (i // 3) * 70
        c.setStrokeColor(HexColor("#dde5e9"))
        c.roundRect(x, yy - 40, 160, 56, 8, stroke=1, fill=0)
        c.setFillColor(muted)
        c.setFont("Helvetica", 8.5)
        c.drawString(x + 12, yy, label.upper())
        c.setFillColor(ink)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(x + 12, yy - 26, value)
    y = h - 300
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Rating distribution")
    y -= 20
    total = sum(x["count"] for x in ratings) or 1
    for row in ratings:
        c.setFont("Helvetica", 9)
        c.setFillColor(ink)
        c.drawString(40, y, f"{row['rating']}★")
        c.setFillColor(HexColor("#edf2f4"))
        c.rect(70, y - 2, 300, 9, stroke=0, fill=1)
        c.setFillColor(accent)
        c.rect(70, y - 2, 300 * row["count"] / total, 9, stroke=0, fill=1)
        c.setFillColor(muted)
        c.drawString(380, y, f"{row['count']}")
        y -= 16
    y -= 16
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Locations")
    y -= 18
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(muted)
    for x, t in ((40, "LOCATION"), (260, "REVIEWS"), (330, "AVG"), (390, "RESPONSE"), (470, "REQUESTS")):
        c.drawString(x, y, t)
    y -= 14
    c.setFont("Helvetica", 9.5)
    c.setFillColor(ink)
    for loc in locs[:12]:
        c.drawString(40, y, loc["name"][:38])
        c.drawString(260, y, str(loc["reviews"]))
        c.drawString(330, y, str(loc["avg_rating"] or "—"))
        c.drawString(390, y, f"{(loc['response_rate'] or 0) * 100:.0f}%")
        c.drawString(470, y, str(loc["requests_sent"]))
        y -= 14
    y -= 16
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Monthly trend")
    y -= 18
    c.setFont("Helvetica", 9.5)
    for m in monthly[-6:]:
        c.drawString(40, y, f"{m['month']}   {m['reviews']} reviews   avg {m['avg_rating'] or '—'}   {m['requests_sent']} requests   {m['google_clicks']} Google clicks")
        y -= 14
    c.setFont("Helvetica", 7.5)
    c.setFillColor(muted)
    c.drawString(40, 40, "Google click-through measures clicks on “Review on Google”; ReviewPilot cannot confirm whether a review was posted.")
    c.showPage()
    c.save()
    return Response(buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="report-{r.start.date()}-{r.end.date()}.pdf"'})
