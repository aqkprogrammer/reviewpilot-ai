"""Background tasks. Each takes (ctx, **kwargs); `run_tracked` records status in background_jobs."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Campaign, GoogleConnection
from app.models.enums import CampaignStatus, IntegrationStatus
from app.services import ai as ai_svc
from app.services import auto_reply, billing, campaigns, google_sync, retention

log = logging.getLogger("reviewpilot.worker")


async def process_campaign(ctx, campaign_id: str) -> dict:
    async with SessionLocal() as db:
        return await campaigns.process_campaign(db, uuid.UUID(campaign_id))


async def start_scheduled_campaign(ctx, campaign_id: str) -> dict:
    async with SessionLocal() as db:
        c = await db.get(Campaign, uuid.UUID(campaign_id))
        if c is None or c.status != CampaignStatus.SCHEDULED:
            return {"skipped": True}
        c.status = CampaignStatus.ACTIVE
        c.launched_at = datetime.now(UTC)
        await db.commit()
        return await campaigns.process_campaign(db, c.id)


async def send_review_request(ctx, request_id: str, is_reminder: bool = False) -> dict:
    try:
        async with SessionLocal() as db:
            ok = await campaigns.send_review_request(db, uuid.UUID(request_id), is_reminder=is_reminder)
            return {"ok": ok}
    except Exception as exc:
        # Never leave a request stuck in "queued": record the failure, then re-raise for job tracking.
        async with SessionLocal() as db:
            from app.models import ReviewRequest
            from app.models.enums import RequestStatus

            req = await db.get(ReviewRequest, uuid.UUID(request_id))
            if req and req.status == RequestStatus.QUEUED:
                req.status, req.failed_reason, req.next_reminder_at = RequestStatus.FAILED, f"internal_error: {type(exc).__name__}", None
                await db.commit()
        raise


async def send_due_reminders(ctx) -> dict:
    async with SessionLocal() as db:
        ids = await campaigns.due_reminders(db)
        sent = 0
        for rid in ids:
            sent += int(await campaigns.send_review_request(db, rid, is_reminder=True))
        return {"due": len(ids), "sent": sent}


async def sync_google_reviews(ctx, connection_id: str) -> dict:
    async with SessionLocal() as db:
        return await google_sync.sync_connection(db, uuid.UUID(connection_id))


async def sync_all_google(ctx) -> dict:
    async with SessionLocal() as db:
        ids = (await db.scalars(select(GoogleConnection.id).where(GoogleConnection.status == IntegrationStatus.CONNECTED))).all()
    results = {}
    for cid in ids:
        try:
            async with SessionLocal() as db:
                results[str(cid)] = await google_sync.sync_connection(db, cid)
        except Exception as exc:  # noqa: BLE001 — one tenant's failure must not stop others
            results[str(cid)] = {"error": str(exc)[:200]}
    return {"connections": len(ids)}


async def publish_review_reply(ctx, reply_id: str) -> dict:
    async with SessionLocal() as db:
        return {"published": await google_sync.publish_reply(db, uuid.UUID(reply_id))}


async def generate_ai_insights(ctx, org_id: str) -> dict:
    async with SessionLocal() as db:
        return {"insights": await ai_svc.refresh_insights(db, uuid.UUID(org_id))}


async def subscription_maintenance(ctx) -> dict:
    async with SessionLocal() as db:
        return await billing.run_maintenance(db)


async def purge_deleted_organizations(ctx) -> dict:
    async with SessionLocal() as db:
        return await retention.purge_deleted_organizations(db)


async def auto_reply_review(ctx, review_id: str) -> dict:
    async with SessionLocal() as db:
        return await auto_reply.auto_reply(db, uuid.UUID(review_id))


TASKS = {
    f.__name__: f
    for f in (
        process_campaign, start_scheduled_campaign, send_review_request, send_due_reminders, sync_google_reviews,
        sync_all_google, publish_review_reply, generate_ai_insights, subscription_maintenance,
        purge_deleted_organizations, auto_reply_review,
    )
}
