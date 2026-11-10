"""Owner-authorised automatic replies.

Runs only when an owner has switched on `auto_publish_replies`. Guard rails:
  * Google-synced reviews only (never demo data);
  * rating >= the organization's `auto_publish_min_rating` (default 4, never below 3);
    1–2★ reviews always wait for a human;
  * review created within the last 7 days (first sync never mass-replies to history);
  * plan entitlement + monthly AI quota enforced by the AI service;
  * no existing owner reply and no draft already in progress.
Every auto-published reply is audited and announced to the team.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import now
from app.models import Organization, Review, ReviewReply
from app.models.enums import ReplyStatus, ResponseStatus, ReviewSource
from app.services import ai as ai_svc
from app.services import audit
from app.services.google_sync import publish_reply
from app.services.notify import notify_org

log = logging.getLogger("reviewpilot.auto_reply")
MAX_AGE = timedelta(days=7)


def eligible(org: Organization, review: Review) -> tuple[bool, str]:
    if not org.auto_publish_replies:
        return False, "disabled"
    if review.source != ReviewSource.GOOGLE:
        return False, "not_google"
    if review.rating < org.auto_publish_min_rating:
        return False, "below_threshold"
    if review.platform_reply or review.response_status != ResponseStatus.PENDING:
        return False, "already_answered"
    if review.review_created_at < now() - MAX_AGE:
        return False, "too_old"
    return True, "ok"


async def auto_reply(db: AsyncSession, review_id: uuid.UUID) -> dict:
    review = await db.get(Review, review_id)
    if review is None:
        return {"skipped": "missing"}
    org = await db.get(Organization, review.organization_id)
    ok, reason = eligible(org, review)
    if not ok:
        return {"skipped": reason}
    existing = await db.scalar(select(ReviewReply).where(ReviewReply.review_id == review.id, ReviewReply.status.in_([ReplyStatus.DRAFT, ReplyStatus.PENDING_PUBLISH])))
    if existing:
        return {"skipped": "draft_in_progress"}
    language = org.default_language if org.default_language in ("en", "hi", "hinglish") else "en"
    try:
        out, gen = await ai_svc.generate_reply(
            db, org, None, review_text=review.comment, rating=review.rating, reviewer_name=review.reviewer_name,
            tone=org.brand_tone or "professional", language=language, review_id=review.id,
        )
    except AppError as exc:  # quota / plan / provider unavailable → leave for a human
        log.info("Auto-reply skipped for %s: %s", review.id, exc.code)
        return {"skipped": exc.code}
    reply = ReviewReply(
        organization_id=org.id, review_id=review.id, body=out["reply"], tone=org.brand_tone, language=language,
        ai_generation_id=gen.id, status=ReplyStatus.PENDING_PUBLISH,
    )
    db.add(reply)
    review.history = [*review.history, {"at": now().isoformat(), "event": "auto_reply_generated", "note": f"Owner-authorised auto-publish (≥{org.auto_publish_min_rating}★)"}]
    await audit.record(db, "review.auto_reply_generated", organization_id=org.id, target_type="review", target_id=review.id, actor_type="system", meta={"rating": review.rating, "provider": gen.provider})
    await db.commit()
    published = await publish_reply(db, reply.id)
    if published:
        await notify_org(db, org.id, "review.new", f"Auto-replied to a {review.rating}★ Google review", (out["reply"] or "")[:160], link="/app/reviews", send_email=False)
        await db.commit()
    return {"published": published}
