"""Service recovery: auto-open cases for unhappy customers, alert the team, track a response SLA.

Rules (per organization, stored in ``organizations.settings["recovery"]``):

- A case opens automatically for a *Google* review rated <= ``review_max_rating`` or private
  feedback rated <= ``feedback_max_rating`` / classified negative. Demo-source reviews never
  auto-open (seeded demo cases are created explicitly by the seed and labelled).
- One case per review / feedback (unique columns + an explicit check).
- Severity: 1★ → critical, 2★ or negative → high, anything else → medium.
- ``due_at`` = opened + SLA hours for the severity. The SLA measures time to first outreach.
- Alerts (in-app/email + optional WhatsApp to owner numbers) run as a background job after the
  case row is committed, so request latency is unaffected. The SLA cron is also a backstop for
  alerts that were never dispatched.

Policy: recovery is about making things right. Nothing ReviewPilot generates (alerts, suggested
outreach messages) and nothing a team member logs may ask a customer to change or remove a
review, or offer anything in exchange for one.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.permissions import Perm, has_permission
from app.core.security import now
from app.models import (
    FeedbackSubmission,
    Location,
    LocationMember,
    Organization,
    OrganizationMember,
    RecoveryCase,
    Review,
)
from app.models.enums import ReviewSource
from app.services.notify import notify_user

log = logging.getLogger("reviewpilot.recovery")

ACTIVE_STATUSES = ("open", "in_progress", "contacted")
CLOCK_STATUSES = ("open", "in_progress")  # the first-response SLA clock is running
CLOSED_STATUSES = ("resolved", "closed")
SEVERITIES = ("critical", "high", "medium")
RESOLUTIONS = ("resolved_happy", "resolved_neutral", "unreachable", "not_actionable")
CONTACT_CHANNELS = ("call", "whatsapp", "email", "sms")
CONTACT_OUTCOMES = ("reached", "no_answer", "left_message", "message_sent")

DEFAULT_SETTINGS: dict[str, Any] = {
    "enabled": True,
    "review_max_rating": 2,
    "feedback_max_rating": 2,
    "feedback_negative": True,
    "review_max_age_days": 7,  # a first Google sync imports history; don't open cases for old reviews
    "sla_hours": {"critical": 4, "high": 24, "medium": 48},
    "alert_whatsapp": [],
    "whatsapp_template": "recovery_alert",
}

POLICY_MESSAGE = (
    "Recovery outreach must never ask a customer to change or remove a review, or offer anything in "
    "exchange for one. Rephrase this so it focuses on understanding and fixing the experience."
)

# Asks to change/remove a review, or incentives tied to a review/rating.
_REVIEW_WORD = r"(?:review|rating|stars?|feedback\s+on\s+google)"
_POLICY_PATTERNS = [
    re.compile(rf"\b(?:remove|delete|change|edit|update|revise|retract|withdraw|take\s+down|modify|upgrade)\s+(?:your|ur)\s+(?:google\s+)?{_REVIEW_WORD}", re.I),
    re.compile(rf"\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:remove|delete|change|edit|update|revise|retract|withdraw|take\s+down|modify)\s+(?:the|this|that|it|your)\b[^.!?\n]{{0,20}}{_REVIEW_WORD}", re.I),
    re.compile(rf"\b(?:raise|increase|bump|up)\s+(?:your|the|ur)\s+{_REVIEW_WORD}", re.I),
    re.compile(r"\b(?:give|leave|post|write)\s+(?:us\s+)?(?:a\s+)?(?:5|five)[\s-]*stars?\b", re.I),
    re.compile(r"\bin\s+exchange\s+for\b", re.I),
    re.compile(rf"\b(?:discount|coupon|voucher|free|gift|refund|cashback|cash\s+back|reward|credit|complimentary)\b[^.!?\n]{{0,60}}\b(?:if|when|once|after|for)\b[^.!?\n]{{0,40}}{_REVIEW_WORD}", re.I),
    re.compile(rf"{_REVIEW_WORD}[^.!?\n]{{0,40}}\b(?:and|then|to)\b[^.!?\n]{{0,30}}\b(?:get|receive|earn|win)\b[^.!?\n]{{0,30}}\b(?:discount|coupon|voucher|free|gift|refund|cashback|reward|credit)\b", re.I),
]


def policy_violation(text: str | None) -> bool:
    """True when the text asks for a review change/removal or ties an incentive to a review."""
    if not text:
        return False
    return any(p.search(text) for p in _POLICY_PATTERNS)


def assert_policy_safe(text: str | None) -> None:
    from app.core.errors import AppError

    if policy_violation(text):
        raise AppError(POLICY_MESSAGE, code="recovery_policy", status_code=422)


# ------------------------------------------------------------------ settings


def get_settings(org: Organization) -> dict[str, Any]:
    raw = dict((org.settings or {}).get("recovery") or {})
    merged = {**DEFAULT_SETTINGS, **{k: v for k, v in raw.items() if k in DEFAULT_SETTINGS}}
    merged["sla_hours"] = {**DEFAULT_SETTINGS["sla_hours"], **(raw.get("sla_hours") or {})}
    merged["alert_whatsapp"] = list(merged.get("alert_whatsapp") or [])
    return merged


def sla_hours_for(cfg: dict[str, Any], severity: str) -> int:
    return int(cfg["sla_hours"].get(severity) or DEFAULT_SETTINGS["sla_hours"][severity])


def severity_for(rating: int | None, sentiment: str | None = None) -> str:
    if rating == 1:
        return "critical"
    if rating == 2 or (sentiment == "negative" and (rating is None or rating <= 3)):
        return "high"
    return "medium"


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}•••••{phone[-4:]}" if len(phone) > 7 else "•••"


def timeline_entry(event_name: str, *, by: str = "System", by_id: uuid.UUID | None = None, note: str | None = None, **extra: Any) -> dict[str, Any]:
    entry: dict[str, Any] = {"at": now().isoformat(), "by": by, "event": event_name, "note": note}
    if by_id:
        entry["by_id"] = str(by_id)
    entry.update({k: v for k, v in extra.items() if v is not None})
    return entry


def append_timeline(case: RecoveryCase, entry: dict[str, Any]) -> None:
    # Re-assign so SQLAlchemy sees the JSONB change.
    case.timeline = [*(case.timeline or []), entry]


def sla_missed(case: RecoveryCase) -> bool:
    """The first-response SLA was missed at some point (marked once by the SLA cron)."""
    return any(e.get("event") == "sla_breached" for e in case.timeline or [])


def is_breached(case: RecoveryCase, at: datetime | None = None) -> bool:
    """Currently breached: the clock is running and the case is overdue (or was marked breached
    and still has had no outreach)."""
    if case.status not in CLOCK_STATUSES:
        return False
    overdue = case.due_at is not None and case.due_at < (at or now())
    return overdue or (sla_missed(case) and case.first_response_at is None)


def is_demo_case(case: RecoveryCase, review: Review | None = None) -> bool:
    return bool((review is not None and review.source == ReviewSource.DEMO) or any(e.get("event") == "demo_seeded" for e in case.timeline or []))


# ------------------------------------------------------------------ after-commit alert dispatch

_pending: set[asyncio.Task] = set()


def _schedule_alert_after_commit(db: AsyncSession, case_id: uuid.UUID) -> None:
    """Enqueue the alert job once the surrounding transaction commits (the job reads the row)."""
    sync = db.sync_session
    sync.info.setdefault("recovery_alert_ids", []).append(case_id)
    if sync.info.get("recovery_alert_hook"):
        return
    sync.info["recovery_alert_hook"] = True  # listeners live as long as this (short-lived) session
    event.listen(sync, "after_commit", _after_commit)
    event.listen(sync, "after_rollback", _after_rollback)


def _after_commit(session) -> None:
    ids = list(session.info.pop("recovery_alert_ids", []))
    if not ids:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:  # no running loop: the SLA cron backstop will alert
        return
    task = loop.create_task(_enqueue_alerts(ids))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


def _after_rollback(session) -> None:
    session.info.pop("recovery_alert_ids", None)  # the cases were never stored


async def _enqueue_alerts(ids: list[uuid.UUID]) -> None:
    from app.services.jobs import enqueue

    for cid in ids:
        try:
            async with _session() as db:
                org_id = await db.scalar(select(RecoveryCase.organization_id).where(RecoveryCase.id == cid))
            if org_id is not None:
                await enqueue("send_recovery_alert", organization_id=org_id, case_id=str(cid))
        except Exception:  # noqa: BLE001 — the SLA cron re-dispatches un-alerted cases
            log.exception("Could not enqueue recovery alert for %s", cid)


def _session():
    from app.core.db import SessionLocal

    return SessionLocal()


async def drain_pending_alerts(timeout: float = 10) -> None:
    """Test helper: wait until after-commit alert dispatch has enqueued its jobs."""
    if _pending:
        await asyncio.wait(list(_pending), timeout=timeout)


# ------------------------------------------------------------------ opening cases


async def _existing_case(db: AsyncSession, *, review_id: uuid.UUID | None = None, feedback_id: uuid.UUID | None = None) -> RecoveryCase | None:
    if review_id:
        return await db.scalar(select(RecoveryCase).where(RecoveryCase.review_id == review_id))
    if feedback_id:
        return await db.scalar(select(RecoveryCase).where(RecoveryCase.feedback_id == feedback_id))
    return None


def _clip(text: str | None, n: int) -> str | None:
    if not text:
        return None
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


async def _new_case(
    db: AsyncSession, org: Organization, *, source: str, location_id: uuid.UUID | None, title: str, summary: str | None,
    severity: str, review_id: uuid.UUID | None = None, feedback_id: uuid.UUID | None = None, customer_id: uuid.UUID | None = None,
    opened: dict[str, Any], assignee_id: uuid.UUID | None = None, opened_at: datetime | None = None,
) -> RecoveryCase:
    cfg = get_settings(org)
    at = opened_at or now()
    case = RecoveryCase(
        organization_id=org.id, location_id=location_id, source=source, review_id=review_id, feedback_id=feedback_id,
        customer_id=customer_id, title=title[:255], summary=summary, severity=severity, status="open", assignee_id=assignee_id,
        due_at=at + timedelta(hours=sla_hours_for(cfg, severity)), timeline=[opened],
    )
    db.add(case)
    await db.flush()
    return case


async def auto_open_for_review(db: AsyncSession, review: Review) -> RecoveryCase | None:
    """Hook for newly synced Google reviews. Returns the new case, or None when no case is due."""
    if review.source != ReviewSource.GOOGLE:
        return None  # demo/sample reviews never open cases at runtime
    org = await db.get(Organization, review.organization_id)
    if org is None:
        return None
    cfg = get_settings(org)
    if not cfg["enabled"] or review.rating is None or review.rating > int(cfg["review_max_rating"]):
        return None
    if review.review_created_at and review.review_created_at < now() - timedelta(days=int(cfg["review_max_age_days"])):
        return None
    if review.id is None:
        await db.flush()
    if await _existing_case(db, review_id=review.id):
        return None
    loc = await db.get(Location, review.location_id)
    severity = severity_for(review.rating, review.sentiment)
    case = await _new_case(
        db, org, source="review", location_id=review.location_id, review_id=review.id, severity=severity,
        title=f"{review.rating}★ Google review — {review.reviewer_name or 'Anonymous reviewer'}" + (f" · {loc.name}" if loc else ""),
        summary=_clip(review.comment, 600),
        opened=timeline_entry("opened", note=f"Auto-opened from a {review.rating}★ Google review (rule: ≤ {cfg['review_max_rating']}★). SLA {sla_hours_for(cfg, severity)}h to first outreach."),
    )
    _schedule_alert_after_commit(db, case.id)
    return case


async def auto_open_for_feedback(db: AsyncSession, fb: FeedbackSubmission) -> RecoveryCase | None:
    """Hook for new private feedback from the public page."""
    org = await db.get(Organization, fb.organization_id)
    if org is None:
        return None
    cfg = get_settings(org)
    low = fb.rating is not None and fb.rating <= int(cfg["feedback_max_rating"])
    negative = bool(cfg["feedback_negative"]) and fb.sentiment == "negative"
    if not cfg["enabled"] or not (low or negative):
        return None
    if fb.id is None:
        await db.flush()
    if await _existing_case(db, feedback_id=fb.id):
        return None
    loc = await db.get(Location, fb.location_id)
    severity = severity_for(fb.rating, fb.sentiment)
    reason = f"a {fb.rating}★ rating (rule: ≤ {cfg['feedback_max_rating']}★)" if low else "negative sentiment"
    case = await _new_case(
        db, org, source="feedback", location_id=fb.location_id, feedback_id=fb.id, customer_id=fb.customer_id, severity=severity,
        title=f"{f'{fb.rating}★ ' if fb.rating else ''}Private feedback — {fb.name or 'Anonymous customer'}" + (f" · {loc.name}" if loc else ""),
        summary=_clip(fb.message, 600),
        opened=timeline_entry("opened", note=f"Auto-opened from private feedback with {reason}. SLA {sla_hours_for(cfg, severity)}h to first outreach."),
    )
    _schedule_alert_after_commit(db, case.id)
    return case


async def open_manual(
    db: AsyncSession, org: Organization, *, actor_name: str, actor_id: uuid.UUID, review: Review | None = None, feedback: FeedbackSubmission | None = None,
    title: str | None = None, summary: str | None = None, location_id: uuid.UUID | None = None, severity: str | None = None,
    assignee_id: uuid.UUID | None = None, note: str | None = None,
) -> RecoveryCase:
    if review is not None:
        loc = await db.get(Location, review.location_id)
        sev = severity or severity_for(review.rating, review.sentiment)
        default_title = f"{review.rating}★ {'demo ' if review.source == ReviewSource.DEMO else 'Google '}review — {review.reviewer_name or 'Anonymous reviewer'}" + (f" · {loc.name}" if loc else "")
        kwargs = {"source": "review", "review_id": review.id, "location_id": review.location_id, "summary": summary or _clip(review.comment, 600)}
    elif feedback is not None:
        loc = await db.get(Location, feedback.location_id)
        sev = severity or severity_for(feedback.rating, feedback.sentiment)
        default_title = f"{f'{feedback.rating}★ ' if feedback.rating else ''}Private feedback — {feedback.name or 'Anonymous customer'}" + (f" · {loc.name}" if loc else "")
        kwargs = {"source": "feedback", "feedback_id": feedback.id, "location_id": feedback.location_id, "customer_id": feedback.customer_id, "summary": summary or _clip(feedback.message, 600)}
    else:
        sev = severity or "high"
        default_title = "Manual recovery case"
        kwargs = {"source": "manual", "location_id": location_id, "summary": summary}
    cfg = get_settings(org)
    case = await _new_case(
        db, org, title=(title or default_title).strip(), severity=sev, assignee_id=assignee_id,
        opened=timeline_entry("opened", by=actor_name, by_id=actor_id, note=note or f"Opened manually. SLA {sla_hours_for(cfg, sev)}h to first outreach."),
        **kwargs,
    )
    _schedule_alert_after_commit(db, case.id)
    return case


# ------------------------------------------------------------------ alert fan-out


async def recipients(db: AsyncSession, org_id: uuid.UUID, location_id: uuid.UUID | None, perm: Perm = Perm.REVIEWS_REPLY) -> list[uuid.UUID]:
    """Members who may act on the case — location-restricted members only for their locations."""
    members = (await db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org_id))).all()
    restricted = [m.id for m in members if m.restrict_to_locations]
    allowed: dict[uuid.UUID, set[uuid.UUID]] = {}
    if restricted:
        for mid, lid in (await db.execute(select(LocationMember.member_id, LocationMember.location_id).where(LocationMember.member_id.in_(restricted)))).all():
            allowed.setdefault(mid, set()).add(lid)
    out = []
    for m in members:
        if not has_permission(m.role, perm):
            continue
        if m.restrict_to_locations and (location_id is None or location_id not in allowed.get(m.id, set())):
            continue
        out.append(m.user_id)
    return out


async def member_can_be_assigned(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, location_id: uuid.UUID | None) -> tuple[bool, str | None]:
    m = await db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id))
    if m is None:
        return False, "assignee_not_member"
    if m.restrict_to_locations:
        ok = location_id is not None and await db.scalar(select(LocationMember.id).where(LocationMember.member_id == m.id, LocationMember.location_id == location_id))
        if not ok:
            return False, "assignee_no_location_access"
    return True, None


async def _notify_case(db: AsyncSession, case: RecoveryCase, type_: str, title: str, body: str | None, *, exclude: uuid.UUID | None = None) -> int:
    """In-app + email (per user preference) to members who can act on this case's location.
    Mirrors notify_org but respects location scoping."""
    count = 0
    for uid in await recipients(db, case.organization_id, case.location_id):
        if uid == exclude:
            continue
        await notify_user(db, uid, type_, title, body, organization_id=case.organization_id, link=f"/app/recovery?case={case.id}", data={"case_id": str(case.id), "severity": case.severity})
        count += 1
    return count


def _alert_text(case: RecoveryCase, loc_name: str | None, cfg: dict[str, Any]) -> tuple[str, str]:
    hours = sla_hours_for(cfg, case.severity)
    title = f"Recovery case opened · {case.severity.upper()} — {loc_name or 'All locations'}"
    body = f"{case.title}. Respond within {hours}h." + (f" “{_clip(case.summary, 140)}”" if case.summary else "")
    return title, body


async def send_alert(db: AsyncSession, case_id: uuid.UUID) -> dict[str, Any]:
    """Background job body: alert the team once per case. Never claims a WhatsApp send that didn't happen."""
    from app.providers.messaging import MockAdapter
    from app.services.campaigns import _adapter

    case = await db.scalar(select(RecoveryCase).where(RecoveryCase.id == case_id).with_for_update(skip_locked=True))
    if case is None:
        return {"skipped": "not_found"}
    if case.alerted_at is not None:
        return {"skipped": "already_alerted"}
    org = await db.get(Organization, case.organization_id)
    if org is None:
        return {"skipped": "no_org"}
    cfg = get_settings(org)
    loc = await db.get(Location, case.location_id) if case.location_id else None
    title, body = _alert_text(case, loc.name if loc else None, cfg)
    assert not policy_violation(body)  # generated text is policy-checked
    exclude = None
    first = (case.timeline or [{}])[0]
    if first.get("by_id"):
        exclude = uuid.UUID(first["by_id"])  # the person who opened it manually already knows
    notified = await _notify_case(db, case, "recovery.case_opened", title, body, exclude=exclude)
    append_timeline(case, timeline_entry("alert_sent", note=f"In-app alert to {notified} team member{'s' if notified != 1 else ''} (email per each member's notification preferences)."))

    result: dict[str, Any] = {"notified": notified, "whatsapp": {}}
    numbers = list(cfg["alert_whatsapp"])
    if not numbers:
        append_timeline(case, timeline_entry("whatsapp_alert_skipped", note="No WhatsApp alert numbers configured in recovery settings."))
        result["whatsapp"] = {"status": "skipped", "reason": "no_numbers"}
    else:
        adapter = await _adapter(db, org.id, "whatsapp")
        if adapter is None:
            append_timeline(case, timeline_entry("whatsapp_alert_skipped", note="WhatsApp isn't connected — connect it in Integrations to alert owners on WhatsApp. Nothing was sent."))
            result["whatsapp"] = {"status": "skipped", "reason": "not_configured"}
        else:
            template = {
                "name": cfg["whatsapp_template"], "language": "en",
                "params": [case.severity.upper(), loc.name if loc else org.name, _clip(case.title, 80) or "", f"{sla_hours_for(cfg, case.severity)}h", f"{app_settings.frontend_url}/app/recovery?case={case.id}"],
            }
            simulated = isinstance(adapter, MockAdapter)
            sent, failed = [], []
            for number in numbers:
                res = await adapter.send(to=number, body=f"{title}\n{body}", template=template)
                (sent if res.ok else failed).append((number, res))
            masked_ok = ", ".join(mask_phone(n) for n, _ in sent)
            if simulated:
                if sent:
                    append_timeline(case, timeline_entry("whatsapp_alert_simulated", note=f"Demo mode — WhatsApp alert simulated for {masked_ok} (template “{cfg['whatsapp_template']}”). Nothing was sent."))
            elif sent:
                append_timeline(case, timeline_entry("whatsapp_alert_sent", note=f"WhatsApp alert accepted by {adapter.name} for {masked_ok} (template “{cfg['whatsapp_template']}”)."))
            for number, res in failed:
                append_timeline(case, timeline_entry("whatsapp_alert_failed", note=f"WhatsApp alert to {mask_phone(number)} failed: {res.error_message or res.error_code}{' (simulated)' if simulated else ''}."))
            result["whatsapp"] = {"status": "simulated" if simulated else "sent", "ok": len(sent), "failed": len(failed)}
    case.alerted_at = now()
    await db.commit()
    return result


# ------------------------------------------------------------------ SLA


async def check_sla(db: AsyncSession, *, at: datetime | None = None) -> dict[str, int]:
    """Mark overdue open/in-progress cases as breached (once) and notify once per case."""
    at = at or now()
    rows = (
        await db.scalars(
            select(RecoveryCase)
            .where(RecoveryCase.status.in_(CLOCK_STATUSES), RecoveryCase.due_at.is_not(None), RecoveryCase.due_at < at, ~RecoveryCase.timeline.contains([{"event": "sla_breached"}]))
            .order_by(RecoveryCase.due_at)
            .limit(500)
            .with_for_update(skip_locked=True)
        )
    ).all()
    breached = 0
    for case in rows:
        org = await db.get(Organization, case.organization_id)
        hours = sla_hours_for(get_settings(org), case.severity) if org else None
        overdue = int((at - case.due_at).total_seconds() // 60)
        append_timeline(case, timeline_entry("sla_breached", note=f"First-response SLA{f' ({hours}h)' if hours else ''} missed — overdue by {overdue // 60}h {overdue % 60}m."))
        is_demo = is_demo_case(case)
        if not is_demo:
            loc = await db.get(Location, case.location_id) if case.location_id else None
            await _notify_case(db, case, "recovery.sla_breached", f"SLA breached · {case.severity.upper()} — {loc.name if loc else 'Recovery'}", f"{case.title} has had no outreach yet.")
        breached += 1
    await db.commit()
    return {"breached": breached}


async def unalerted_case_ids(db: AsyncSession, *, older_than_seconds: int = 120, limit: int = 100) -> list[uuid.UUID]:
    cutoff = now() - timedelta(seconds=older_than_seconds)
    return list((await db.scalars(select(RecoveryCase.id).where(RecoveryCase.alerted_at.is_(None), RecoveryCase.created_at < cutoff).order_by(RecoveryCase.created_at).limit(limit))).all())


# ------------------------------------------------------------------ demo seed


async def seed_demo_cases(db: AsyncSession, org: Organization) -> int:
    """Idempotently create clearly-labelled demo cases from existing negative demo data.
    Alerts are not dispatched for seeded cases (alerted_at is set)."""
    if not org.is_demo:
        return 0
    if await db.scalar(select(RecoveryCase.id).where(RecoveryCase.organization_id == org.id).limit(1)):
        return 0
    from app.models import User

    cfg = get_settings(org)
    members = (await db.execute(select(User.id, User.full_name, OrganizationMember.role).join(OrganizationMember, OrganizationMember.user_id == User.id).where(OrganizationMember.organization_id == org.id).order_by(OrganizationMember.created_at))).all()
    owner = next((m for m in members if m.role == "owner"), members[0] if members else None)
    reviews = (
        await db.scalars(
            select(Review).where(Review.organization_id == org.id, Review.source == ReviewSource.DEMO, Review.rating <= 2, Review.comment.is_not(None)).order_by(Review.review_created_at.desc()).limit(5)
        )
    ).all()
    feedback = (
        await db.scalars(
            select(FeedbackSubmission).where(FeedbackSubmission.organization_id == org.id, (FeedbackSubmission.rating <= 2) | (FeedbackSubmission.sentiment == "negative")).order_by(FeedbackSubmission.created_at.desc()).limit(2)
        )
    ).all()
    # Spread the demo cases across the SLA lifecycle so the console has something to show.
    plans = [
        {"age_h": 1.5, "status": "open"},
        {"age_h": 30, "status": "open", "breach": True},
        {"age_h": 6, "status": "in_progress", "assign": True},
        {"age_h": 20, "status": "contacted", "assign": True, "contact": ("call", "reached", "Apologised for the long wait; customer appreciated the call.")},
        {"age_h": 70, "status": "resolved", "assign": True, "contact": ("whatsapp", "message_sent", "Shared what we changed in the weekend kitchen roster."), "resolve": ("resolved_happy", "Customer thanked us for following up.")},
        {"age_h": 3, "status": "open"},
        {"age_h": 26, "status": "in_progress", "breach": True},
    ]
    sources: list[tuple[str, Any]] = [("review", r) for r in reviews] + [("feedback", f) for f in feedback]
    created = 0
    for (kind, obj), plan in zip(sources, plans, strict=False):
        rating = obj.rating
        severity = severity_for(rating, obj.sentiment)
        sla = sla_hours_for(cfg, severity)
        # Breached examples are opened just past their SLA; others stay inside it.
        age_h = sla + 2.5 if plan.get("breach") else (plan["age_h"] if plan["status"] in ("contacted", "resolved") else min(plan["age_h"], sla * 0.7))
        opened_at = now() - timedelta(hours=age_h)
        loc = await db.get(Location, obj.location_id)
        name = (obj.reviewer_name if kind == "review" else obj.name) or ("Anonymous reviewer" if kind == "review" else "Anonymous customer")
        title = (f"{rating}★ demo review — {name}" if kind == "review" else f"{f'{rating}★ ' if rating else ''}Private feedback — {name}") + (f" · {loc.name}" if loc else "")
        text = obj.comment if kind == "review" else obj.message
        tl = [{"at": opened_at.isoformat(), "by": "System", "event": "demo_seeded", "note": "Sample recovery case created from demo data — not a real customer."},
              {"at": opened_at.isoformat(), "by": "System", "event": "opened", "note": f"Opened from a {rating}★ {'demo review' if kind == 'review' else 'private feedback'}. SLA {sla_hours_for(cfg, severity)}h to first outreach."}]
        case = RecoveryCase(
            organization_id=org.id, location_id=obj.location_id, source=kind, review_id=obj.id if kind == "review" else None,
            feedback_id=obj.id if kind == "feedback" else None, customer_id=getattr(obj, "customer_id", None) if kind == "feedback" else None,
            title=title[:255], summary=_clip(text, 600), severity=severity, status=plan["status"], due_at=opened_at + timedelta(hours=sla_hours_for(cfg, severity)),
            alerted_at=opened_at, created_at=opened_at,
        )
        if plan.get("assign") and owner:
            case.assignee_id = owner[0]
            tl.append({"at": (opened_at + timedelta(minutes=20)).isoformat(), "by": owner[1], "by_id": str(owner[0]), "event": "assigned", "note": f"Assigned to {owner[1]}"})
        if plan["status"] == "in_progress":
            tl.append({"at": (opened_at + timedelta(minutes=25)).isoformat(), "by": owner[1] if owner else "System", "event": "status_changed", "note": "Open → In progress"})
        if plan.get("breach"):
            tl.append({"at": case.due_at.isoformat(), "by": "System", "event": "sla_breached", "note": f"First-response SLA ({sla_hours_for(cfg, severity)}h) missed."})
        if plan.get("contact"):
            ch, outcome, note = plan["contact"]
            at = opened_at + timedelta(hours=min(2.5, sla_hours_for(cfg, severity) * 0.6))
            case.first_response_at = at
            tl.append({"at": at.isoformat(), "by": owner[1] if owner else "System", "event": "contact_logged", "channel": ch, "outcome": outcome, "note": note})
        if plan.get("resolve"):
            res, note = plan["resolve"]
            case.resolution, case.resolved_at = res, opened_at + timedelta(hours=8)
            tl.append({"at": case.resolved_at.isoformat(), "by": owner[1] if owner else "System", "event": "resolved", "resolution": res, "note": note})
        case.timeline = tl
        db.add(case)
        created += 1
    await db.flush()
    return created


def org_today_end(org: Organization, at: datetime | None = None) -> datetime:
    at = at or now()
    try:
        tz = ZoneInfo(org.timezone or "Asia/Kolkata")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("Asia/Kolkata")
    local = at.astimezone(tz)
    return local.replace(hour=23, minute=59, second=59, microsecond=999999)


def suggested_message(*, customer_name: str | None, business: str, channel: str) -> str:
    """A policy-safe opening line for outreach (never asks about the review itself)."""
    first = (customer_name or "").split(" ")[0] or "there"
    text = (
        f"Hi {first}, this is the team at {business}. We're sorry your recent visit wasn't what it should have been. "
        "We'd like to understand what happened and put it right — is now a good time to talk?"
    )
    if channel == "email":
        text = (
            f"Hi {first},\n\nThank you for telling us about your recent visit to {business}. We're sorry it fell short. "
            "We'd like to understand what happened and make it right — could you reply with a good time to reach you?\n\nWarm regards,\n{business}"
        ).replace("{business}", business)
    assert not policy_violation(text)
    return text
