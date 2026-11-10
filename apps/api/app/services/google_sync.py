"""Google Business Profile synchronisation + reply publishing (runs in the worker)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt, encrypt
from app.core.security import now
from app.models import GoogleAccount, GoogleConnection, Location, Organization, Review, ReviewReply
from app.models.enums import IntegrationStatus, ReplyStatus, ResponseStatus, ReviewSource
from app.providers import google_business as gbp
from app.providers.ai import heuristic_sentiment
from app.services.notify import notify_org

log = logging.getLogger("reviewpilot.google")
DAILY_QUOTA = 5000  # conservative per-connection budget; Google's default is per project


def _count_quota(conn: GoogleConnection, n: int = 1) -> None:
    today = now().strftime("%Y-%m-%d")
    if conn.quota_day != today:
        conn.quota_day, conn.quota_used_today = today, 0
    conn.quota_used_today += n
    if conn.quota_used_today > DAILY_QUOTA:
        raise gbp.GoogleAPIError("Daily API budget reached; sync will resume tomorrow.", 429)


async def valid_access_token(db: AsyncSession, conn: GoogleConnection) -> str:
    token = decrypt(conn.access_token_enc)
    if token and conn.token_expires_at and conn.token_expires_at > now():
        return token
    refresh = decrypt(conn.refresh_token_enc)
    if not refresh:
        conn.status = IntegrationStatus.TOKEN_EXPIRED
        raise gbp.GoogleAPIError("No refresh token; reconnect Google", reauth=True)
    try:
        data = await gbp.refresh_access_token(refresh)
    except gbp.GoogleAPIError as exc:
        conn.status = IntegrationStatus.TOKEN_EXPIRED if exc.reauth else IntegrationStatus.ERROR
        conn.last_error = str(exc)
        if exc.reauth:
            await notify_org(db, conn.organization_id, "integration.disconnected", "Google Business Profile disconnected", "Your Google authorization expired. Reconnect to keep syncing reviews.", link="/app/integrations")
        await db.commit()
        raise
    conn.access_token_enc = encrypt(data["access_token"])
    conn.token_expires_at = gbp.expiry(data)
    return data["access_token"]


async def discover(db: AsyncSession, conn: GoogleConnection) -> int:
    client = gbp.GBPClient(await valid_access_token(db, conn))
    accounts = await client.list_accounts()
    _count_quota(conn, 1 + len(accounts))
    for acc in accounts:
        locations = await client.list_locations(acc["name"])
        row = await db.scalar(select(GoogleAccount).where(GoogleAccount.organization_id == conn.organization_id, GoogleAccount.account_name == acc["name"]))
        if row is None:
            row = GoogleAccount(organization_id=conn.organization_id, connection_id=conn.id, account_name=acc["name"])
            db.add(row)
        row.display_name = acc.get("accountName")
        row.account_type = acc.get("type")
        row.discovered_locations = [
            {"name": l["name"], "title": l.get("title"), "address": ", ".join((l.get("storefrontAddress") or {}).get("addressLines", [])), "place_id": (l.get("metadata") or {}).get("placeId"), "review_url": (l.get("metadata") or {}).get("newReviewUri")}
            for l in locations
        ]
    conn.status = IntegrationStatus.CONNECTED
    conn.last_error = None
    await db.commit()
    return len(accounts)


async def sync_connection(db: AsyncSession, connection_id: uuid.UUID) -> dict:
    conn = await db.get(GoogleConnection, connection_id)
    if conn is None or conn.status not in (IntegrationStatus.CONNECTED, IntegrationStatus.ERROR):
        return {"skipped": True}
    try:
        client = gbp.GBPClient(await valid_access_token(db, conn))
        locations = (await db.scalars(select(Location).where(Location.organization_id == conn.organization_id, Location.google_location_name.is_not(None), Location.deleted_at.is_(None)))).all()
        created = updated = 0
        new_review_ids: list[uuid.UUID] = []
        for loc in locations:
            account = await db.get(GoogleAccount, loc.google_account_id) if loc.google_account_id else None
            if account is None:
                continue
            raw_reviews = await client.list_reviews(account.account_name, loc.google_location_name)
            _count_quota(conn, max(1, len(raw_reviews) // 50 + 1))
            for raw in raw_reviews:
                data = gbp.parse_review(raw)
                if not data["external_id"] or not data["rating"]:
                    continue
                review = await db.scalar(select(Review).where(Review.location_id == loc.id, Review.source == ReviewSource.GOOGLE, Review.external_id == data["external_id"]))
                sentiment, score, topics = heuristic_sentiment(data["comment"], data["rating"])
                if review is None:
                    review = Review(organization_id=conn.organization_id, location_id=loc.id, source=ReviewSource.GOOGLE, platform="google", sentiment=sentiment, sentiment_score=score, topics=topics, history=[{"at": now().isoformat(), "event": "synced_from_google"}], **data)
                    review.response_status = ResponseStatus.RESPONDED if data["platform_reply"] else ResponseStatus.PENDING
                    db.add(review)
                    await db.flush()
                    new_review_ids.append(review.id)
                    created += 1
                    if review.response_status == ResponseStatus.PENDING:
                        await notify_org(db, conn.organization_id, "review.new", f"New {data['rating']}★ Google review — {loc.name}", (data["comment"] or "")[:160], link="/app/reviews", send_email=data["rating"] <= 2)
                else:
                    for k, v in data.items():
                        setattr(review, k, v)
                    if data["platform_reply"] and review.response_status == ResponseStatus.PENDING:
                        review.response_status = ResponseStatus.RESPONDED
                    review.sentiment, review.sentiment_score, review.topics = sentiment, score, topics
                    updated += 1
        conn.last_synced_at = now()
        conn.status = IntegrationStatus.CONNECTED
        conn.last_error = None
        conn.error_count = 0
        await db.commit()
        org = await db.get(Organization, conn.organization_id)
        if org is not None and org.auto_publish_replies and new_review_ids:
            from app.services.jobs import enqueue

            for rid in new_review_ids:
                await enqueue("auto_reply_review", organization_id=org.id, review_id=str(rid))
        return {"created": created, "updated": updated, "auto_reply_queued": len(new_review_ids) if org and org.auto_publish_replies else 0}
    except gbp.GoogleAPIError as exc:
        conn.error_count += 1
        conn.last_error = str(exc)
        if exc.reauth:
            conn.status = IntegrationStatus.TOKEN_EXPIRED
        elif conn.error_count >= 3:
            conn.status = IntegrationStatus.ERROR
        await db.commit()
        raise


async def publish_reply(db: AsyncSession, reply_id: uuid.UUID) -> bool:
    reply = await db.get(ReviewReply, reply_id)
    if reply is None or reply.status != ReplyStatus.PENDING_PUBLISH:
        return False
    review = await db.get(Review, reply.review_id)
    conn = await db.scalar(select(GoogleConnection).where(GoogleConnection.organization_id == reply.organization_id))
    reply.attempts += 1
    if review is None or conn is None or conn.status != IntegrationStatus.CONNECTED:
        reply.status, reply.publish_error = ReplyStatus.FAILED, "Google Business Profile is not connected"
        await db.commit()
        return False
    try:
        client = gbp.GBPClient(await valid_access_token(db, conn))
        _count_quota(conn)
        await client.put_reply(review.external_id, reply.body)
    except gbp.GoogleAPIError as exc:
        reply.status, reply.publish_error = ReplyStatus.FAILED, str(exc)
        review.history = [*review.history, {"at": now().isoformat(), "event": "reply_publish_failed", "error": str(exc)[:200]}]
        await db.commit()
        return False
    reply.status, reply.published_at, reply.publish_error = ReplyStatus.PUBLISHED, now(), None
    review.platform_reply, review.platform_reply_at = reply.body, now()
    review.response_status = ResponseStatus.RESPONDED
    review.history = [*review.history, {"at": now().isoformat(), "event": "reply_published_google"}]
    await db.commit()
    return True
