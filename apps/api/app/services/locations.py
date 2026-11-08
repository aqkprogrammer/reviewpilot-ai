from __future__ import annotations

import uuid

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import OrgContext
from app.core.errors import NotFound
from app.models import Campaign, GoogleConnection, Location, QRCode, Review
from app.models.enums import IntegrationStatus, ResponseStatus
from app.schemas.org import LocationOut


def review_url(location: Location) -> str | None:
    if location.google_review_url:
        return location.google_review_url
    if location.google_place_id:
        return f"https://search.google.com/local/writereview?placeid={location.google_place_id}"
    return None


async def get_location(db: AsyncSession, ctx: OrgContext, location_id: uuid.UUID) -> Location:
    loc = await db.get(Location, location_id)
    if loc is None or loc.organization_id != ctx.org_id or loc.deleted_at is not None:
        raise NotFound("Location not found")
    ctx.ensure_location(loc.id)
    return loc


def scoped_location_filter(ctx: OrgContext, column):
    """SQL predicate restricting a location_id column to what the member may access."""
    if ctx.location_ids is None:
        return True
    return column.in_(ctx.location_ids or [uuid.UUID(int=0)])


async def list_with_stats(db: AsyncSession, ctx: OrgContext) -> list[LocationOut]:
    locations = (
        await db.scalars(
            select(Location)
            .where(Location.organization_id == ctx.org_id, Location.deleted_at.is_(None), scoped_location_filter(ctx, Location.id))
            .order_by(Location.created_at)
        )
    ).all()
    if not locations:
        return []
    ids = [l.id for l in locations]
    review_stats = {
        row.location_id: row
        for row in (
            await db.execute(
                select(
                    Review.location_id,
                    func.count().label("n"),
                    func.avg(Review.rating).label("avg"),
                    func.sum(case((Review.response_status == ResponseStatus.PENDING, 1), else_=0)).label("pending"),
                )
                .where(Review.location_id.in_(ids))
                .group_by(Review.location_id)
            )
        ).all()
    }
    qr_counts = dict(
        (await db.execute(select(QRCode.location_id, func.count()).where(QRCode.location_id.in_(ids), QRCode.deleted_at.is_(None)).group_by(QRCode.location_id))).all()
    )
    campaign_counts = dict(
        (await db.execute(select(Campaign.location_id, func.count()).where(Campaign.location_id.in_(ids), Campaign.deleted_at.is_(None)).group_by(Campaign.location_id))).all()
    )
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == ctx.org_id))
    out = []
    for loc in locations:
        s = review_stats.get(loc.id)
        if loc.google_location_name and conn:
            gstatus = conn.status
        elif loc.google_location_name:
            gstatus = IntegrationStatus.TOKEN_EXPIRED
        else:
            gstatus = IntegrationStatus.NOT_CONNECTED
        item = LocationOut.model_validate(loc)
        item.google_status = gstatus
        item.review_count = int(s.n) if s else 0
        item.average_rating = round(float(s.avg), 2) if s and s.avg is not None else None
        item.pending_responses = int(s.pending or 0) if s else 0
        item.qr_count = int(qr_counts.get(loc.id, 0))
        item.campaign_count = int(campaign_counts.get(loc.id, 0))
        item.effective_review_url = review_url(loc)
        out.append(item)
    return out
