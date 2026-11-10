"""Weekly AI intelligence digest.

`build()` assembles a structured, fully data-backed digest for the 7 days ending `week_end`
(inclusive, in the organization's timezone) and compares it with the 7 days before.
Every number comes from stored rows; the narrative is either written by OpenAI from those
numbers (metered through the AI service, number-checked) or produced by a deterministic
offline heuristic that is labelled as such.

`send_org_digest()` / `send_weekly_digests()` deliver it by email + in-app notification,
at most once per organization per ISO week (recorded in organizations.settings["digest"]).
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.permissions import Perm, has_permission
from app.core.security import now
from app.models import (
    AIGeneration,
    Location,
    LocationMember,
    Notification,
    NotificationPreference,
    Organization,
    OrganizationMember,
    QRCode,
    QRScan,
    Review,
    ReviewRequest,
    User,
)
from app.models.enums import OrgRole, OrgStatus, ResponseStatus, UserStatus
from app.models.growth import AutomationRule, RecoveryCase, VisitEvent
from app.providers.ai import TOPIC_LABELS, get_llm, heuristic_sentiment
from app.providers.email import get_email_provider
from app.services import ai as ai_svc
from app.services import email_templates
from app.services.organizations import effective_plan

log = logging.getLogger("reviewpilot.digest")

NOTIFICATION_TYPE = "digest.weekly"
WINDOW_DAYS = 7
THEME_SAMPLE_LIMIT = 1500
DEFAULT_EMAIL_ROLES = {OrgRole.OWNER, OrgRole.ADMIN}
OPEN_CASE_STATUSES = ("open", "in_progress", "contacted")
ALLOWED_LINKS = ("/app/reviews", "/app/reviews?status=pending", "/app/recovery", "/app/campaigns", "/app/automations", "/app/qr-codes", "/app/analytics", "/app/ai-assistant")

DEFINITIONS = {
    "new_reviews": "Reviews whose platform creation date falls inside the 7-day window.",
    "average_rating": "Mean star rating of the reviews created in the window.",
    "response_rate": "Reviews from the window that have an owner reply or were marked handled ÷ reviews in the window.",
    "pending_replies": "Reviews from the window still awaiting a reply. The backlog counts every pending review created up to the end of the window.",
    "themes": "Topics tagged on reviews; when a review has no tags, topics are detected from its text with ReviewPilot's keyword model.",
    "recovery": "Service-recovery cases opened, resolved, or whose response deadline passed without a first response during the window.",
    "requests_sent": "Review requests accepted by a messaging provider during the window.",
    "google_clicks": "Customers who clicked “Review on Google” during the window. A click is intent; ReviewPilot cannot confirm a review was posted.",
    "visits": "Visits, orders or appointments reported by integrations or the team during the window.",
    "qr_scans": "Scans of ReviewPilot QR codes counted by the first-party redirect.",
}

DIGEST_SYSTEM = """You write a short weekly briefing for a local business owner about their customer reviews.
Rules:
- Use ONLY the numbers and facts in the JSON you are given. Never invent, estimate or round numbers differently.
- Write 2-3 plain sentences (no markdown, no emoji). Mention the most important change versus the previous week.
- Then give exactly 3 recommended actions grounded in the facts. Each action: a short imperative title (max 8 words)
  and a one-sentence detail. Pick "link" for each action from allowed_links (or null).
Return JSON: {"narrative": str, "actions": [{"title": str, "detail": str, "link": str|null}]}"""


# ------------------------------------------------------------------ time windows


def org_tz(org: Organization) -> ZoneInfo:
    try:
        return ZoneInfo(org.timezone or "Asia/Kolkata")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("Asia/Kolkata")


def today_for(org: Organization, at: datetime | None = None) -> date:
    return (at or now()).astimezone(org_tz(org)).date()


def last_complete_week_end(org: Organization, at: datetime | None = None) -> date:
    """The most recent Sunday strictly before today (org timezone): a full Monday–Sunday week."""
    today = today_for(org, at)
    return today - timedelta(days=((today.weekday() + 1) % 7) or 7)


def window(org: Organization, week_end: date) -> tuple[datetime, datetime]:
    """[start, end) in UTC for the 7 local days ending `week_end` inclusive."""
    tz = org_tz(org)
    start = datetime.combine(week_end - timedelta(days=WINDOW_DAYS - 1), time.min, tz)
    end = datetime.combine(week_end + timedelta(days=1), time.min, tz)
    return start, end


def week_key(week_end: date) -> str:
    y, w, _ = week_end.isocalendar()
    return f"{y}-W{w:02d}"


def week_label(week_end: date) -> str:
    start = week_end - timedelta(days=WINDOW_DAYS - 1)
    if start.month == week_end.month:
        return f"{start.day}–{week_end.day} {week_end:%b %Y}"
    if start.year == week_end.year:
        return f"{start.day} {start:%b} – {week_end.day} {week_end:%b %Y}"
    return f"{start.day} {start:%b %Y} – {week_end.day} {week_end:%b %Y}"


def available_weeks(org: Organization, count: int = 8) -> list[dict]:
    today = today_for(org)
    out = [{"week_end": today.isoformat(), "label": "Last 7 days", "range": week_label(today), "is_partial": True}]
    sunday = last_complete_week_end(org)
    for i in range(count):
        we = sunday - timedelta(days=7 * i)
        out.append({"week_end": we.isoformat(), "label": "Last week" if i == 0 else f"Week ending {we.day} {we:%b}", "range": week_label(we), "is_partial": False})
    return out


def clamp_week_end(org: Organization, week_end: date | None) -> date:
    today = today_for(org)
    if week_end is None or week_end > today:
        return today
    return max(week_end, today - timedelta(days=366))


# ------------------------------------------------------------------ helpers


def _loc_conds(column, location_ids: set[uuid.UUID] | None, location_id: uuid.UUID | None) -> list:
    conds: list = []
    if location_ids is not None:
        conds.append(column.in_(location_ids or [uuid.UUID(int=0)]))
    if location_id is not None:
        conds.append(column == location_id)
    return conds


def short_name(name: str | None) -> str:
    """First name + last initial only (never full names in digests)."""
    parts = [p for p in re.split(r"\s+", (name or "").strip()) if p]
    if not parts:
        return "A customer"
    first = parts[0][:24]
    if len(parts) > 1 and parts[-1][:1].isalpha():
        return f"{first} {parts[-1][0].upper()}."
    return first


def excerpt(text: str, limit: int = 180) -> str:
    t = re.sub(r"\s+", " ", text or "").strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0].rstrip(",.;:-– ")
    return f"{cut}…"


def _rate(num: int, den: int) -> float | None:
    return round(num / den, 4) if den else None


def _diff(cur, prev, digits: int = 2):
    if cur is None or prev is None:
        return None
    return round(cur - prev, digits)


def _pct_change(cur: int, prev: int) -> float | None:
    return round((cur - prev) / prev, 4) if prev else None


def _topic_label(topic: str) -> str:
    return TOPIC_LABELS.get(topic) or topic.replace("_", " ").strip().lower()


def _plural(n: int, word: str, plural: str | None = None) -> str:
    return f"{n} {word if n == 1 else (plural or word + 's')}"


# ------------------------------------------------------------------ data assembly


async def _review_stats(db: AsyncSession, org_id: uuid.UUID, loc: list, start: datetime, end: datetime) -> dict:
    conds = [Review.organization_id == org_id, *loc, Review.review_created_at >= start, Review.review_created_at < end]
    n, avg, responded, pending = (
        await db.execute(
            select(
                func.count(),
                func.avg(Review.rating),
                func.count().filter(or_(Review.response_status != ResponseStatus.PENDING, Review.platform_reply.is_not(None))),
                func.count().filter(Review.response_status == ResponseStatus.PENDING, Review.platform_reply.is_(None)),
            ).where(*conds)
        )
    ).one()
    mix = dict((await db.execute(select(Review.rating, func.count()).where(*conds).group_by(Review.rating))).all())
    return {"n": n or 0, "avg": round(float(avg), 2) if avg is not None else None, "responded": responded or 0, "pending": pending or 0, "mix": mix}


async def _location_breakdown(db: AsyncSession, org_id: uuid.UUID, location_ids, location_id, cur: tuple, prev: tuple) -> list[dict]:
    locs = (
        await db.execute(
            select(Location.id, Location.name)
            .where(Location.organization_id == org_id, Location.deleted_at.is_(None), *_loc_conds(Location.id, location_ids, location_id))
            .order_by(Location.name)
        )
    ).all()
    if not locs:
        return []

    async def per(start, end):
        rows = (
            await db.execute(
                select(
                    Review.location_id, func.count(), func.avg(Review.rating),
                    func.count().filter(or_(Review.response_status != ResponseStatus.PENDING, Review.platform_reply.is_not(None))),
                    func.count().filter(Review.response_status == ResponseStatus.PENDING, Review.platform_reply.is_(None)),
                )
                .where(Review.organization_id == org_id, Review.location_id.in_([i for i, _ in locs]), Review.review_created_at >= start, Review.review_created_at < end)
                .group_by(Review.location_id)
            )
        ).all()
        return {lid: (n, float(a) if a is not None else None, r, p) for lid, n, a, r, p in rows}

    c, p = await per(*cur), await per(*prev)
    out = []
    for lid, name in locs:
        n, avg, resp, pend = c.get(lid, (0, None, 0, 0))
        pn, pavg, _, _ = p.get(lid, (0, None, 0, 0))
        out.append({
            "location_id": str(lid), "name": name, "new_reviews": n, "previous_new_reviews": pn,
            "average_rating": round(avg, 2) if avg is not None else None, "rating_delta": _diff(avg, pavg),
            "response_rate": _rate(resp, n), "pending_replies": pend,
        })
    return out


async def build(
    db: AsyncSession, org: Organization, week_end: date, location_id: uuid.UUID | None = None, *,
    location_ids: set[uuid.UUID] | None = None, narrative: bool = True, user_id: uuid.UUID | None = None,
) -> dict:
    """Structured digest for the 7 days ending `week_end` vs the 7 days before.

    `location_ids` is the caller's location allow-list (None = whole organization);
    `location_id` narrows to one location (callers must check it is allowed).
    """
    start, end = window(org, week_end)
    pstart, pend = start - timedelta(days=WINDOW_DAYS), start
    as_of = min(end, now())
    org_id = org.id

    rloc = _loc_conds(Review.location_id, location_ids, location_id)
    cur = await _review_stats(db, org_id, rloc, start, end)
    prev = await _review_stats(db, org_id, rloc, pstart, pend)
    backlog = await db.scalar(
        select(func.count()).select_from(Review).where(
            Review.organization_id == org_id, *rloc, Review.review_created_at < end,
            Review.response_status == ResponseStatus.PENDING, Review.platform_reply.is_(None),
        )
    ) or 0
    total_mix = sum(cur["mix"].values())
    rating_mix = [{"rating": s, "count": cur["mix"].get(s, 0), "share": _rate(cur["mix"].get(s, 0), total_mix) or 0.0} for s in (5, 4, 3, 2, 1)]

    # Themes + highlights from the window's actual review rows.
    loc_names = dict((await db.execute(select(Location.id, Location.name).where(Location.organization_id == org_id))).all())
    rows = (
        await db.execute(
            select(Review.id, Review.location_id, Review.rating, Review.comment, Review.reviewer_name, Review.review_created_at, Review.topics)
            .where(Review.organization_id == org_id, *rloc, Review.review_created_at >= start, Review.review_created_at < end)
            .order_by(Review.review_created_at.desc())
            .limit(THEME_SAMPLE_LIMIT)
        )
    ).all()
    mentions: Counter = Counter()
    ratings: dict[str, list[int]] = defaultdict(list)
    negative: Counter = Counter()
    positive: Counter = Counter()
    tagged = keyword = 0
    praise: list[dict] = []
    complaints: list[dict] = []
    for rid, lid, rating, comment, reviewer, created, topics in rows:
        label, _, detected = heuristic_sentiment(comment, rating)
        if topics:
            tps, tagged = list(dict.fromkeys(topics)), tagged + 1
        else:
            tps = detected
            keyword += 1 if tps else 0
        for t in tps:
            mentions[t] += 1
            ratings[t].append(rating)
            if rating <= 3:
                negative[t] += 1
            else:
                positive[t] += 1
        text = (comment or "").strip()
        if len(text) < 12:
            continue
        item = {
            "review_id": str(rid), "excerpt": excerpt(text), "reviewer": short_name(reviewer), "rating": rating,
            "date": created.astimezone(org_tz(org)).date().isoformat(), "location_name": loc_names.get(lid),
        }
        if rating >= 4 and len(praise) < 2:
            praise.append(item)
        elif (rating <= 2 or (rating == 3 and label in ("negative", "mixed"))) and len(complaints) < 2:
            complaints.append(item)
    themes = [
        {"topic": t, "label": _topic_label(t), "mentions": m, "avg_rating": round(sum(ratings[t]) / len(ratings[t]), 2), "negative": negative[t], "positive": positive[t]}
        for t, m in mentions.most_common(6)
    ]
    themes_source = "none" if not mentions else "tagged" if not keyword else "keyword" if not tagged else "mixed"

    # Service recovery.
    cloc = _loc_conds(RecoveryCase.location_id, location_ids, location_id)
    rc = [RecoveryCase.organization_id == org_id, *cloc]
    opened = await db.scalar(select(func.count()).select_from(RecoveryCase).where(*rc, RecoveryCase.created_at >= start, RecoveryCase.created_at < end)) or 0
    prev_opened = await db.scalar(select(func.count()).select_from(RecoveryCase).where(*rc, RecoveryCase.created_at >= pstart, RecoveryCase.created_at < pend)) or 0
    resolved = await db.scalar(select(func.count()).select_from(RecoveryCase).where(*rc, RecoveryCase.resolved_at >= start, RecoveryCase.resolved_at < end)) or 0
    breached = await db.scalar(
        select(func.count()).select_from(RecoveryCase).where(
            *rc, RecoveryCase.due_at >= start, RecoveryCase.due_at < as_of,
            or_(RecoveryCase.first_response_at.is_(None), RecoveryCase.first_response_at > RecoveryCase.due_at),
            or_(RecoveryCase.resolved_at.is_(None), RecoveryCase.resolved_at > RecoveryCase.due_at),
        )
    ) or 0
    open_now = await db.scalar(select(func.count()).select_from(RecoveryCase).where(*rc, RecoveryCase.status.in_(OPEN_CASE_STATUSES))) or 0

    # Review requests (QR scans are counted separately).
    qloc = _loc_conds(ReviewRequest.location_id, location_ids, location_id)
    rq = [ReviewRequest.organization_id == org_id, *qloc]

    async def _count_req(col, s, e):
        return await db.scalar(select(func.count()).select_from(ReviewRequest).where(*rq, col >= s, col < e)) or 0

    sent, prev_sent = await _count_req(ReviewRequest.sent_at, start, end), await _count_req(ReviewRequest.sent_at, pstart, pend)
    gclicks, prev_gclicks = await _count_req(ReviewRequest.google_clicked_at, start, end), await _count_req(ReviewRequest.google_clicked_at, pstart, pend)
    opens = await _count_req(ReviewRequest.clicked_at, start, end)

    # Post-visit automation.
    vloc = _loc_conds(VisitEvent.location_id, location_ids, location_id)
    vq = [VisitEvent.organization_id == org_id, *vloc]
    visits, v_sent, v_skipped, v_failed = (
        await db.execute(
            select(
                func.count(), func.count().filter(VisitEvent.status == "sent"),
                func.count().filter(VisitEvent.status == "skipped"), func.count().filter(VisitEvent.status == "failed"),
            ).where(*vq, VisitEvent.occurred_at >= start, VisitEvent.occurred_at < end)
        )
    ).one()
    prev_visits = await db.scalar(select(func.count()).select_from(VisitEvent).where(*vq, VisitEvent.occurred_at >= pstart, VisitEvent.occurred_at < pend)) or 0
    rule_conds = [AutomationRule.organization_id == org_id, AutomationRule.enabled.is_(True)]
    if location_id is not None:
        rule_conds.append(or_(AutomationRule.location_id.is_(None), AutomationRule.location_id == location_id))
    elif location_ids is not None:
        rule_conds.append(or_(AutomationRule.location_id.is_(None), AutomationRule.location_id.in_(location_ids or [uuid.UUID(int=0)])))
    active_rules = await db.scalar(select(func.count()).select_from(AutomationRule).where(*rule_conds)) or 0

    # QR scans (joined through the QR code's location).
    sq = [QRScan.organization_id == org_id, *_loc_conds(QRCode.location_id, location_ids, location_id)]

    async def _scans(s, e):
        return await db.scalar(select(func.count()).select_from(QRScan).join(QRCode, QRCode.id == QRScan.qr_code_id).where(*sq, QRScan.scanned_at >= s, QRScan.scanned_at < e)) or 0

    scans, prev_scans = await _scans(start, end), await _scans(pstart, pend)

    location_name = loc_names.get(location_id) if location_id else None
    locations = await _location_breakdown(db, org_id, location_ids, location_id, (start, end), (pstart, pend))

    data: dict[str, Any] = {
        "organization": {"id": str(org.id), "name": org.name},
        "is_demo": bool(org.is_demo),
        "label": "Demo data" if org.is_demo else None,
        "week": {
            "key": week_key(week_end), "week_end": week_end.isoformat(), "start": (week_end - timedelta(days=WINDOW_DAYS - 1)).isoformat(),
            "end": week_end.isoformat(), "label": week_label(week_end), "timezone": str(org_tz(org)),
            "is_partial": week_end >= today_for(org), "previous_label": week_label(week_end - timedelta(days=WINDOW_DAYS)),
        },
        "scope": {
            "location_id": str(location_id) if location_id else None, "location_name": location_name,
            "restricted": location_ids is not None, "label": location_name or ("Your locations" if location_ids is not None else "All locations"),
        },
        "reviews": {
            "new": cur["n"], "previous": prev["n"], "delta": cur["n"] - prev["n"], "delta_pct": _pct_change(cur["n"], prev["n"]),
            "average_rating": cur["avg"], "previous_average_rating": prev["avg"], "rating_delta": _diff(cur["avg"], prev["avg"]),
            "response_rate": _rate(cur["responded"], cur["n"]), "previous_response_rate": _rate(prev["responded"], prev["n"]),
            "response_rate_delta": _diff(_rate(cur["responded"], cur["n"]), _rate(prev["responded"], prev["n"]), 4),
            "responded": cur["responded"], "pending_replies": cur["pending"], "backlog": backlog, "rating_mix": rating_mix,
        },
        "themes": themes,
        "themes_source": themes_source,
        "highlights": {"praise": praise, "complaints": complaints},
        "recovery": {"opened": opened, "previous_opened": prev_opened, "resolved": resolved, "breached": breached, "open_now": open_now},
        "requests": {
            "sent": sent, "previous_sent": prev_sent, "google_clicks": gclicks, "previous_google_clicks": prev_gclicks,
            "page_opens": opens, "click_rate": _rate(gclicks, sent),
        },
        "automation": {"visits": visits or 0, "previous_visits": prev_visits, "requests_sent": v_sent or 0, "skipped": v_skipped or 0, "failed": v_failed or 0, "active_rules": active_rules},
        "qr": {"scans": scans, "previous_scans": prev_scans},
        "locations": locations,
        "definitions": DEFINITIONS,
        "generated_at": now().isoformat(),
    }
    data["has_activity"] = bool(cur["n"] or opened or resolved or sent or gclicks or visits or scans)
    data["actions"] = heuristic_actions(data)
    data["narrative"] = await narrate(db, org, data, user_id) if narrative else heuristic_narrative(data)
    if data["narrative"].get("actions"):
        data["actions"] = data["narrative"].pop("actions")
    return data


# ------------------------------------------------------------------ narrative + actions


def heuristic_narrative(d: dict) -> dict:
    r = d["reviews"]
    n, p = r["new"], r["previous"]
    sentences: list[str] = []
    if n == 0:
        sentences.append("No new reviews arrived this week" + (f", compared with {p} the week before." if p else ", and none the week before."))
    else:
        if p == 0:
            trend = "with none the week before"
        elif n > p:
            trend = f"up from {p} the week before"
        elif n < p:
            trend = f"down from {p} the week before"
        else:
            trend = "the same as the week before"
        s = f"{_plural(n, 'new review')} arrived this week, {trend}"
        if r["average_rating"] is not None:
            s += f", averaging {r['average_rating']:.1f}★"
            if r["rating_delta"] is not None and r["rating_delta"] != 0:
                s += f" ({r['rating_delta']:+.1f} vs the previous week)"
        sentences.append(s + ".")
        s2 = f"{r['responded']} of {n} received a reply"
        if r["pending_replies"]:
            s2 += f" and {r['pending_replies']} still {'awaits' if r['pending_replies'] == 1 else 'await'} a response"
        sentences.append(s2 + ".")
    concern = next((t for t in sorted(d["themes"], key=lambda t: -t["negative"]) if t["negative"]), None)
    if concern:
        sentences.append(f"The most common concern was {concern['label']} ({_plural(concern['negative'], 'lower-rated mention')}).")
    elif d["themes"]:
        t = d["themes"][0]
        sentences.append(f"Customers most often mentioned {t['label']} ({_plural(t['mentions'], 'mention')}).")
    elif d["recovery"]["breached"]:
        sentences.append(f"{_plural(d['recovery']['breached'], 'recovery case')} passed the response deadline.")
    return {
        "text": " ".join(sentences[:3]),
        "provider": "heuristic",
        "model": "offline",
        "label": "Offline heuristic summary — written from the numbers below without an AI model",
    }


def heuristic_actions(d: dict) -> list[dict]:
    r, rec, req, auto = d["reviews"], d["recovery"], d["requests"], d["automation"]
    acts: list[dict] = []
    if r["backlog"]:
        acts.append({
            "kind": "reply", "title": f"Reply to {_plural(r['backlog'], 'review')} awaiting a response",
            "detail": (f"{r['pending_replies']} arrived this week. " if r["pending_replies"] else "") + "Specific, timely replies show future customers you listen.",
            "link": "/app/reviews?status=pending",
        })
    if rec["breached"]:
        acts.append({"kind": "recovery", "title": f"Follow up on {_plural(rec['breached'], 'recovery case')} past deadline", "detail": "These unhappy customers have not heard back within the response SLA.", "link": "/app/recovery"})
    elif rec["open_now"]:
        acts.append({"kind": "recovery", "title": f"Work the {_plural(rec['open_now'], 'open recovery case')}", "detail": "Reaching out quickly is the best chance to turn a bad visit around.", "link": "/app/recovery"})
    concern = next((t for t in sorted(d["themes"], key=lambda t: -t["negative"]) if t["negative"]), None)
    if concern:
        acts.append({"kind": "theme", "title": f"Address {concern['label']}", "detail": f"{_plural(concern['negative'], 'lower-rated review')} this week mentioned {concern['label']}. Brief the team and track it next week.", "link": "/app/analytics"})
    if r["rating_delta"] is not None and r["rating_delta"] <= -0.3:
        acts.append({"kind": "rating", "title": "Read this week's lower ratings", "detail": f"The average rating moved {r['rating_delta']:+.1f} versus the previous week.", "link": "/app/reviews"})
    if req["sent"] == 0:
        acts.append({"kind": "requests", "title": "Ask recent customers for feedback", "detail": "No review requests were sent this week. A steady flow keeps your rating current.", "link": "/app/campaigns"})
    if auto["visits"] == 0 and auto["active_rules"] == 0:
        acts.append({"kind": "automation", "title": "Automate requests after each visit", "detail": "Connect your POS or booking tool so requests go out automatically, with consent and quiet hours.", "link": "/app/automations"})
    if d["qr"]["scans"] == 0:
        acts.append({"kind": "qr", "title": "Put a QR card where customers pay", "detail": "No QR scans were recorded this week.", "link": "/app/qr-codes"})
    praise = next((t for t in sorted(d["themes"], key=lambda t: -t["positive"]) if t["positive"]), None)
    if praise:
        acts.append({"kind": "praise", "title": f"Share praise for {praise['label']} with the team", "detail": f"{_plural(praise['positive'], 'positive mention')} this week.", "link": "/app/reviews"})
    acts.append({"kind": "habit", "title": "Keep replying within a day", "detail": "Consistent replies to every review — positive or negative — build trust.", "link": "/app/reviews"})
    seen, out = set(), []
    for a in acts:
        if a["kind"] in seen:
            continue
        seen.add(a["kind"])
        out.append(a)
    return out[:3]


def _facts(d: dict) -> dict:
    return {
        "business": d["organization"]["name"], "week": d["week"]["label"], "scope": d["scope"]["label"], "reviews": {k: v for k, v in d["reviews"].items()},
        "themes": [{k: t[k] for k in ("label", "mentions", "avg_rating", "negative", "positive")} for t in d["themes"]],
        "praise_excerpts": [h["excerpt"] for h in d["highlights"]["praise"]], "complaint_excerpts": [h["excerpt"] for h in d["highlights"]["complaints"]],
        "recovery": d["recovery"], "requests": d["requests"], "automation": d["automation"], "qr": d["qr"],
    }


def _allowed_numbers(obj: Any, out: set[str]) -> set[str]:
    if isinstance(obj, bool) or obj is None:
        return out
    if isinstance(obj, int | float):
        v = float(obj)
        for x in (v, abs(v)):
            out.update({f"{x:g}", f"{x:.1f}", f"{x:.2f}", str(round(x))})
            if abs(x) <= 1:
                out.update({f"{x * 100:.0f}", f"{x * 100:.1f}"})
    elif isinstance(obj, dict):
        for v in obj.values():
            _allowed_numbers(v, out)
    elif isinstance(obj, list | tuple):
        for v in obj:
            _allowed_numbers(v, out)
    elif isinstance(obj, str):
        out.update(re.findall(r"\d+(?:\.\d+)?", obj))
    return out


def numbers_grounded(text: str, facts: dict) -> bool:
    """True when every number in `text` appears in the facts (guards against invented figures)."""
    allowed = _allowed_numbers(facts, {"1", "2", "3", "7"})
    for num in re.findall(r"\d+(?:\.\d+)?", text):
        if num not in allowed and num.rstrip("0").rstrip(".") not in allowed:
            return False
    return True


async def narrate(db: AsyncSession, org: Organization, d: dict, user_id: uuid.UUID | None) -> dict:
    heuristic = heuristic_narrative(d)
    if get_llm() is None:
        return heuristic
    facts = _facts(d)
    key = hashlib.sha256(json.dumps(facts, sort_keys=True, default=str).encode()).hexdigest()[:32]
    cached = await db.scalar(
        select(AIGeneration).where(
            AIGeneration.organization_id == org.id, AIGeneration.kind == "digest", AIGeneration.success.is_(True),
            AIGeneration.provider == "openai", AIGeneration.input["key"].astext == key,
        ).order_by(AIGeneration.created_at.desc()).limit(1)
    )
    if cached is not None:
        out, model = cached.output, cached.model
    else:
        try:
            out, gen = await ai_svc._run(
                db, org, user_id, "digest", DIGEST_SYSTEM, {"key": key, "facts": facts, "allowed_links": list(ALLOWED_LINKS)},
                lambda: {"narrative": heuristic["text"], "actions": []},
            )
            await db.commit()
        except AppError as exc:
            log.info("Digest narrative fell back to heuristic for %s: %s", org.id, exc)
            return {**heuristic, "label": "Offline heuristic summary — the AI narrative is unavailable for this plan or right now"}
        if gen.provider != "openai":
            return heuristic
        model = gen.model
    text = out.get("narrative") if isinstance(out, dict) else None
    if not isinstance(text, str) or not (20 <= len(text.strip()) <= 900) or not numbers_grounded(text, facts):
        return {**heuristic, "label": "Offline heuristic summary — the AI draft was discarded because it did not match the data"}
    actions = []
    for a in (out.get("actions") or [])[:3]:
        if isinstance(a, dict) and isinstance(a.get("title"), str) and a["title"].strip():
            detail = str(a.get("detail") or "")[:300]
            if not numbers_grounded(a["title"] + " " + detail, facts):
                continue
            link = a.get("link") if a.get("link") in ALLOWED_LINKS else None
            actions.append({"kind": "ai", "title": a["title"].strip()[:120], "detail": detail, "link": link})
    result = {"text": text.strip(), "provider": "openai", "model": model, "label": "Written by OpenAI from the numbers below"}
    if len(actions) == 3:
        result["actions"] = actions
    return result


# ------------------------------------------------------------------ settings + recipients


def org_digest_settings(org: Organization) -> dict:
    return dict((org.settings or {}).get("digest") or {})


def org_enabled(org: Organization) -> bool:
    return org_digest_settings(org).get("enabled", True) is not False


def _set_org_digest(org: Organization, **values) -> None:
    st = dict(org.settings or {})
    dg = dict(st.get("digest") or {})
    dg.update(values)
    st["digest"] = dg
    org.settings = st  # reassign so SQLAlchemy persists the JSONB change


def set_org_enabled(org: Organization, enabled: bool) -> None:
    _set_org_digest(org, enabled=bool(enabled))


def default_email_for_role(role: str) -> bool:
    return role in DEFAULT_EMAIL_ROLES


def pref_is_explicit(pref: NotificationPreference | None, user: User) -> bool:
    """Registration and seeding create a row for every notification type in the user's own
    transaction (identical timestamps). Only a row the user later created or changed is a choice;
    anything else falls back to the role default (email ON for owner/admin, OFF for others)."""
    if pref is None:
        return False
    return pref.updated_at > pref.created_at or pref.created_at > user.created_at


def effective_preference(pref: NotificationPreference | None, user: User, role: str) -> dict:
    explicit = pref_is_explicit(pref, user)
    return {
        "email_enabled": pref.email if explicit else default_email_for_role(role),
        "in_app_enabled": pref.in_app if pref is not None else True,
        "is_default": not explicit,
    }


async def _pref_row(db: AsyncSession, user_id: uuid.UUID) -> NotificationPreference | None:
    return await db.scalar(select(NotificationPreference).where(NotificationPreference.user_id == user_id, NotificationPreference.type == NOTIFICATION_TYPE))


async def user_preference(db: AsyncSession, user: User, role: str) -> dict:
    return effective_preference(await _pref_row(db, user.id), user, role)


async def set_user_preference(db: AsyncSession, user: User, *, role: str, email: bool | None = None, in_app: bool | None = None) -> None:
    pref = await _pref_row(db, user.id)
    current = effective_preference(pref, user, role)
    if pref is None:
        pref = NotificationPreference(user_id=user.id, type=NOTIFICATION_TYPE, in_app=True, email=current["email_enabled"])
        db.add(pref)
    else:
        pref.email = current["email_enabled"]
    if email is not None:
        pref.email = email
    if in_app is not None:
        pref.in_app = in_app
    # Mark the row as an explicit choice even when the value is unchanged.
    pref.updated_at = func.clock_timestamp()


@dataclass
class Recipient:
    user: User
    member: OrganizationMember
    email: bool
    in_app: bool
    location_ids: set[uuid.UUID] | None


async def recipients(db: AsyncSession, org: Organization) -> list[Recipient]:
    """Members with analytics.read. Email: explicit preference, else ON for owner/admin only."""
    rows = (
        await db.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == org.id, User.deleted_at.is_(None), User.status == UserStatus.ACTIVE)
            .order_by(OrganizationMember.created_at)
        )
    ).all()
    eligible = [(m, u) for m, u in rows if has_permission(m.role, Perm.ANALYTICS_READ)]
    if not eligible:
        return []
    prefs = {
        p.user_id: p
        for p in (await db.scalars(select(NotificationPreference).where(NotificationPreference.type == NOTIFICATION_TYPE, NotificationPreference.user_id.in_([u.id for _, u in eligible])))).all()
    }
    out = []
    for m, u in eligible:
        pref = effective_preference(prefs.get(u.id), u, m.role)
        loc_ids = None
        if m.restrict_to_locations:
            loc_ids = set((await db.scalars(select(LocationMember.location_id).where(LocationMember.member_id == m.id))).all())
        out.append(Recipient(user=u, member=m, email=pref["email_enabled"], in_app=pref["in_app_enabled"], location_ids=loc_ids))
    return out


# ------------------------------------------------------------------ rendering + delivery


async def _branding(db: AsyncSession, org: Organization) -> dict:
    try:
        from app.services import white_label
    except ImportError:  # pragma: no cover - module optional
        return {"brand": "ReviewPilot AI", "sender": None, "footer": None, "hide_attribution": False}
    wl = await white_label.effective(db, org)
    sender = None
    if wl.get("sender_name"):
        from email.utils import formataddr, parseaddr

        sender = formataddr((wl["sender_name"][:70], parseaddr(settings.email_from)[1]))
    brand = wl.get("sender_name") or (org.name if wl.get("hide_attribution") else "ReviewPilot AI")
    return {"brand": brand, "sender": sender, "footer": wl.get("footer_text"), "hide_attribution": bool(wl.get("hide_attribution"))}


async def render_email(db: AsyncSession, org: Organization, d: dict, *, test: bool = False) -> tuple[str, str, str, str | None]:
    """(subject, html, text, sender) for a built digest."""
    b = await _branding(db, org)
    subject, html, text = email_templates.weekly_digest(d, brand=b["brand"], footer=b["footer"], hide_attribution=b["hide_attribution"], test=test)
    return subject, html, text, b["sender"]


async def send_to_user(db: AsyncSession, org: Organization, d: dict, email: str, *, test: bool = False) -> bool:
    subject, html, text, sender = await render_email(db, org, d, test=test)
    res = await get_email_provider().send(to=email, subject=subject, html=html, text=text, sender=sender)
    if not res.ok:
        log.warning("Digest email to %s failed: %s", email, res.error)
    return res.ok


async def is_org_eligible(db: AsyncSession, org: Organization) -> bool:
    if org.deleted_at is not None or org.status == OrgStatus.SUSPENDED or not org_enabled(org):
        return False
    return await effective_plan(db, org.id) is not None


async def send_org_digest(db: AsyncSession, org_id: uuid.UUID, week_end: date | None = None) -> dict:
    """Deliver one organization's digest for the ISO week of `week_end` — at most once per week."""
    org = await db.scalar(select(Organization).where(Organization.id == org_id).with_for_update().execution_options(populate_existing=True))
    if org is None:
        return {"skipped": "not_found"}
    if not await is_org_eligible(db, org):
        await db.rollback()
        return {"skipped": "ineligible"}
    week_end = week_end or last_complete_week_end(org)
    key = week_key(week_end)
    if org_digest_settings(org).get("last_sent_week") == key:
        await db.rollback()
        return {"skipped": "already_sent", "week": key}
    # Claim the week before sending so a concurrent or repeated run cannot double-send.
    _set_org_digest(org, last_sent_week=key, last_sent_at=now().isoformat())
    await db.commit()

    recips = await recipients(db, org)
    built: dict[frozenset | None, dict] = {}
    emailed = notified = failed = 0
    for rcp in recips:
        if not (rcp.email or rcp.in_app):
            continue
        scope = frozenset(rcp.location_ids) if rcp.location_ids is not None else None
        if scope not in built:
            built[scope] = await build(db, org, week_end, location_ids=rcp.location_ids)
        d = built[scope]
        if rcp.in_app:
            db.add(Notification(
                user_id=rcp.user.id, organization_id=org.id, type=NOTIFICATION_TYPE,
                title=f"Weekly digest · {d['week']['label']}", body=d["narrative"]["text"][:500],
                link=f"/app/digest?week_end={week_end.isoformat()}", data={"week": key, "is_demo": d["is_demo"]},
            ))
            notified += 1
        if rcp.email:
            if await send_to_user(db, org, d, rcp.user.email):
                emailed += 1
            else:
                failed += 1
    org = await db.get(Organization, org_id)
    _set_org_digest(org, last_recipients=emailed, last_notified=notified, last_failed=failed)
    await db.commit()
    return {"week": key, "emailed": emailed, "notified": notified, "failed": failed}


async def send_weekly_digests(db: AsyncSession, week_end: date | None = None) -> dict:
    org_ids = (
        await db.scalars(select(Organization.id).where(Organization.deleted_at.is_(None), Organization.status != OrgStatus.SUSPENDED).order_by(Organization.created_at))
    ).all()
    totals = {"organizations": 0, "sent": 0, "skipped": 0, "emailed": 0, "notified": 0, "failed": 0}
    for oid in org_ids:
        totals["organizations"] += 1
        try:
            res = await send_org_digest(db, oid, week_end)
        except Exception:  # noqa: BLE001 - one org must not stop the run
            log.exception("Weekly digest failed for organization %s", oid)
            await db.rollback()
            totals["failed"] += 1
            continue
        if "skipped" in res:
            totals["skipped"] += 1
        else:
            totals["sent"] += 1
            for k in ("emailed", "notified", "failed"):
                totals[k] += res[k]
    return totals
