"""Branded transactional + review-request email templates (HTML + plain text)."""

from __future__ import annotations

import html as _html

from app.core.config import settings


def _layout(title: str, body_html: str, *, brand: str = "ReviewPilot AI", color: str = "#0e9aa7", footer: str = "") -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f3f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1218">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #dde5e9;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:{color}"></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:600;letter-spacing:-.01em">{_html.escape(brand)}</td></tr>
<tr><td style="padding:8px 32px 28px;font-size:14px;line-height:1.65;color:#26343e">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px;color:#0b1218;letter-spacing:-.02em">{_html.escape(title)}</h1>
{body_html}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #edf2f4;font-size:12px;color:#7d8b95">{footer or "Sent by ReviewPilot AI"}</td></tr>
</table></td></tr></table></body></html>"""


def _button(url: str, label: str, color: str = "#0e9aa7") -> str:
    return (
        f'<p style="margin:24px 0"><a href="{_html.escape(url)}" style="display:inline-block;background:{color};color:#fff;'
        f'text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">{_html.escape(label)}</a></p>'
    )


def verify_email(name: str, token: str) -> tuple[str, str, str]:
    url = f"{settings.frontend_url}/verify-email?token={token}"
    body = f"<p>Hi {_html.escape(name)},</p><p>Confirm your email address to secure your ReviewPilot account.</p>{_button(url, 'Verify email')}<p style='font-size:12px;color:#7d8b95'>This link expires in 24 hours.</p>"
    text = f"Hi {name},\n\nVerify your email: {url}\n\nThis link expires in 24 hours."
    return "Verify your email address", _layout("Verify your email", body), text


def reset_password(name: str, token: str) -> tuple[str, str, str]:
    url = f"{settings.frontend_url}/reset-password?token={token}"
    body = f"<p>Hi {_html.escape(name)},</p><p>We received a request to reset your password. If this wasn't you, you can ignore this email.</p>{_button(url, 'Reset password')}<p style='font-size:12px;color:#7d8b95'>This link expires in 60 minutes.</p>"
    text = f"Hi {name},\n\nReset your password: {url}\n\nThis link expires in 60 minutes. If you didn't request this, ignore this email."
    return "Reset your ReviewPilot password", _layout("Reset your password", body), text


def invitation(org_name: str, inviter: str, role: str, token: str) -> tuple[str, str, str]:
    url = f"{settings.frontend_url}/invite?token={token}"
    body = f"<p>{_html.escape(inviter)} invited you to join <strong>{_html.escape(org_name)}</strong> on ReviewPilot AI as <strong>{_html.escape(role)}</strong>.</p>{_button(url, 'Accept invitation')}<p style='font-size:12px;color:#7d8b95'>This invitation expires in 7 days.</p>"
    text = f"{inviter} invited you to join {org_name} on ReviewPilot AI as {role}.\nAccept: {url}\n\nExpires in 7 days."
    return f"Join {org_name} on ReviewPilot AI", _layout("You're invited", body), text


def review_request(*, business: str, customer_name: str | None, message: str, link: str, unsubscribe_url: str, color: str, extra_footer: str | None = None) -> tuple[str, str]:
    greeting = f"Hi {_html.escape(customer_name)}," if customer_name else "Hello,"
    body = (
        f"<p>{greeting}</p><p>{_html.escape(message)}</p>{_button(link, 'Share your experience', color)}"
        "<p style='font-size:12px;color:#7d8b95'>Your honest feedback — positive or negative — helps us improve.</p>"
    )
    footer = f'You received this because you recently visited {_html.escape(business)}. <a href="{_html.escape(unsubscribe_url)}" style="color:#7d8b95">Unsubscribe</a>'
    if extra_footer:
        footer = f"{_html.escape(extra_footer)}<br>{footer}"
    text = f"{'Hi ' + customer_name + ',' if customer_name else 'Hello,'}\n\n{message}\n\n{link}\n\nUnsubscribe: {unsubscribe_url}"
    return _layout(f"How was your visit to {business}?", body, brand=business, color=color, footer=footer), text


def notification(title: str, body_text: str, link: str | None) -> tuple[str, str]:
    body = f"<p>{_html.escape(body_text)}</p>" + (_button(f"{settings.frontend_url}{link}", "Open ReviewPilot") if link else "")
    return _layout(title, body), f"{title}\n\n{body_text}\n{settings.frontend_url}{link or ''}"


# ------------------------------------------------------------------ weekly digest (digest feature)

_MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
_TEAL, _INK, _TEXT, _MUTED, _LINE, _TRACK = "#0e9aa7", "#0b1218", "#26343e", "#7d8b95", "#edf2f4", "#e6eef1"
_UP, _DOWN, _AMBER = "#0f7f5c", "#b4441c", "#a86b12"


def _micro(text: str, color: str = _MUTED) -> str:
    return f'<span style="font-family:{_MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:{color}">{_html.escape(text)}</span>'


def _section(label: str, inner: str) -> str:
    return (
        f'<tr><td style="padding:22px 0 0">{_micro(label, _TEAL)}</td></tr>'
        f'<tr><td style="padding:8px 0 0">{inner}</td></tr>'
    )


def _delta_html(value, *, kind: str) -> str:
    """kind: count | rating | rate. Returns a small coloured delta line or an em dash."""
    if value is None:
        return f'<span style="color:{_MUTED}">— no prior data</span>'
    if value == 0:
        return f'<span style="color:{_MUTED}">No change vs last week</span>'
    color = _UP if value > 0 else _DOWN
    arrow = "▲" if value > 0 else "▼"
    if kind == "rating":
        txt = f"{value:+.1f}★"
    elif kind == "rate":
        txt = f"{value * 100:+.0f} pts"
    else:
        txt = f"{value:+d}"
    return f'<span style="color:{color};font-family:{_MONO}">{arrow} {txt}</span> <span style="color:{_MUTED}">vs last week</span>'


def _kpi_cell(label: str, value: str, delta: str) -> str:
    return (
        f'<td width="50%" valign="top" style="padding:14px 16px;border:1px solid {_LINE};background:#fafcfc">'
        f'{_micro(label)}<div style="font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-.03em;color:{_INK};padding:6px 0 4px">{_html.escape(value)}</div>'
        f'<div style="font-size:12px">{delta}</div></td>'
    )


def _fmt_rate(v) -> str:
    return "—" if v is None else f"{v * 100:.0f}%"


def _digest_layout(title: str, body_html: str, *, brand: str, footer: str) -> str:
    """Like _layout, but fluid (100% up to 560px) so the digest reads well on phones."""
    return f"""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#f3f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:{_INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #dde5e9;border-radius:16px;overflow:hidden">
<tr><td style="height:4px;background:{_TEAL}"></td></tr>
<tr><td style="padding:24px 24px 6px;font-size:15px;font-weight:600;letter-spacing:-.01em">{_html.escape(brand)}</td></tr>
<tr><td style="padding:6px 24px 26px;font-size:14px;line-height:1.6;color:{_TEXT}">
<h1 style="font-size:21px;line-height:1.3;margin:0 0 10px;color:{_INK};letter-spacing:-.02em">{_html.escape(title)}</h1>
{body_html}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid {_LINE};font-size:12px;line-height:1.6;color:{_MUTED}">{footer}</td></tr>
</table></td></tr></table></body></html>"""


def weekly_digest(d: dict, *, brand: str = "ReviewPilot AI", footer: str | None = None, hide_attribution: bool = False, test: bool = False) -> tuple[str, str, str]:
    """Weekly intelligence digest email: (subject, html, text). Light, table-based, email-client safe."""
    esc = _html.escape
    r, wk, scope = d["reviews"], d["week"], d["scope"]
    org_name = d["organization"]["name"]
    link = f"{settings.frontend_url}/app/digest?week_end={wk['week_end']}"
    manage = f"{settings.frontend_url}/app/digest#settings"
    subject = f"{'[Test] ' if test else ''}{org_name} weekly digest · {wk['label']}"
    if d.get("is_demo"):
        subject += " (demo data)"

    head = (
        f'<p style="margin:0 0 4px">{_micro("Weekly intelligence · " + wk["label"], _TEAL)}</p>'
        f'<p style="margin:0 0 14px;color:{_MUTED};font-size:12px">{esc(org_name)} · {esc(scope["label"])}'
        + (f' · <span style="color:{_AMBER};font-family:{_MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;border:1px solid #f0d9ad;background:#fdf6e9;padding:1px 6px;border-radius:5px">Demo data</span>' if d.get("is_demo") else "")
        + "</p>"
    )
    nar = d["narrative"]
    provider = "OpenAI" if nar.get("provider") == "openai" else "Offline heuristic"
    narrative = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:3px solid {_TEAL};padding:4px 0 4px 14px">'
        f'<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:{_INK}">{esc(nar["text"])}</p>{_micro("Summary · " + provider)}</td></tr></table>'
    )
    kpis = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        f'<tr>{_kpi_cell("New reviews", str(r["new"]), _delta_html(r["delta"], kind="count"))}'
        f'{_kpi_cell("Average rating", "—" if r["average_rating"] is None else f"{r["average_rating"]:.2f}★", _delta_html(r["rating_delta"], kind="rating"))}</tr>'
        f'<tr>{_kpi_cell("Response rate", _fmt_rate(r["response_rate"]), _delta_html(r["response_rate_delta"], kind="rate"))}'
        f'{_kpi_cell("Awaiting reply", str(r["pending_replies"]), f"<span style=\'color:{_MUTED}\'>{r["backlog"]} in total backlog</span>")}</tr></table>'
    )
    mix_rows = []
    for m in r["rating_mix"]:
        pct = round(m["share"] * 100)
        bar = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>'
            + (f'<td width="{pct}%" style="background:{_TEAL};height:8px;font-size:0;line-height:0">&nbsp;</td>' if pct > 0 else "")
            + (f'<td width="{100 - pct}%" style="background:{_TRACK};height:8px;font-size:0;line-height:0">&nbsp;</td>' if pct < 100 else "")
            + "</tr></table>"
        )
        mix_rows.append(
            f'<tr><td width="34" style="padding:4px 0;font-family:{_MONO};font-size:12px;color:{_TEXT}">{m["rating"]}★</td>'
            f'<td style="padding:4px 10px">{bar}</td>'
            f'<td width="64" align="right" style="padding:4px 0;font-family:{_MONO};font-size:12px;color:{_MUTED}">{m["count"]} · {pct}%</td></tr>'
        )
    mix = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(mix_rows)}</table>' if r["new"] else f'<p style="margin:0;color:{_MUTED}">No reviews this week.</p>'

    if d["themes"]:
        theme_rows = "".join(
            f'<tr><td style="padding:7px 0;border-bottom:1px solid {_LINE};color:{_INK}">{esc(t["label"].capitalize())}</td>'
            f'<td align="right" style="padding:7px 0;border-bottom:1px solid {_LINE};font-family:{_MONO};font-size:12px;color:{_MUTED}">'
            f'{t["mentions"]} mention{"s" if t["mentions"] != 1 else ""} · {t["avg_rating"]:.1f}★</td></tr>'
            for t in d["themes"][:5]
        )
        themes = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{theme_rows}</table>'
    else:
        themes = f'<p style="margin:0;color:{_MUTED}">No recurring themes detected this week.</p>'

    def quotes(items: list[dict], color: str, empty: str) -> str:
        if not items:
            return f'<p style="margin:0;color:{_MUTED}">{esc(empty)}</p>'
        return "".join(
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="border-left:2px solid {color};padding:2px 0 2px 12px">'
            f'<p style="margin:0;color:{_TEXT};font-style:italic">“{esc(h["excerpt"])}”</p>'
            f'<p style="margin:4px 0 0">{_micro(f"{h["reviewer"]} · {h["rating"]}★" + (f" · {h["location_name"]}" if h.get("location_name") else ""))}</p></td></tr></table>'
            for h in items
        )

    rec, req, auto, qr = d["recovery"], d["requests"], d["automation"], d["qr"]
    activity_items = [
        ("Recovery cases opened", rec["opened"]), ("Recovery cases resolved", rec["resolved"]), ("Past response deadline", rec["breached"]),
        ("Review requests sent", req["sent"]), ("Google review clicks", req["google_clicks"]), ("Visits received", auto["visits"]), ("QR scans", qr["scans"]),
    ]
    activity = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid {_LINE};color:{_TEXT}">{esc(lbl)}</td>'
        f'<td align="right" style="padding:6px 0;border-bottom:1px solid {_LINE};font-family:{_MONO};color:{_DOWN if lbl == "Past response deadline" and val else _INK}">{val}</td></tr>'
        for lbl, val in activity_items
    ) + "</table>"

    actions = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + "".join(
        f'<tr><td width="30" valign="top" style="padding:8px 0;font-family:{_MONO};font-size:12px;color:{_TEAL}">{i:02d}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid {_LINE}"><strong style="color:{_INK}">{esc(a["title"])}</strong>'
        f'<br><span style="color:{_MUTED};font-size:13px">{esc(a.get("detail") or "")}</span></td></tr>'
        for i, a in enumerate(d["actions"], start=1)
    ) + "</table>"

    locs = ""
    if len(d.get("locations") or []) > 1:
        loc_rows = "".join(
            f'<tr><td style="padding:6px 0;border-bottom:1px solid {_LINE};color:{_INK}">{esc(lo["name"])}</td>'
            f'<td align="right" style="padding:6px 0;border-bottom:1px solid {_LINE};font-family:{_MONO};font-size:12px;color:{_MUTED}">'
            f'{lo["new_reviews"]} new · {"—" if lo["average_rating"] is None else f"{lo["average_rating"]:.1f}★"} · {_fmt_rate(lo["response_rate"])} replied</td></tr>'
            for lo in d["locations"][:10]
        )
        locs = _section("Locations", f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{loc_rows}</table>')

    demo_note = f'<p style="margin:0 0 12px;color:{_AMBER};font-size:12px">This organization contains sample data. Numbers are for demonstration only.</p>' if d.get("is_demo") else ""
    body = (
        head + demo_note + narrative
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        + f'<tr><td style="padding:20px 0 0">{kpis}</td></tr>'
        + _section("Rating mix", mix)
        + _section("Top themes", themes)
        + _section("What customers praised", quotes(d["highlights"]["praise"], _UP, "No written praise this week."))
        + _section("What needs attention", quotes(d["highlights"]["complaints"], _DOWN, "No written complaints this week."))
        + _section("Recovery & automation", activity)
        + locs
        + _section("Recommended actions", actions)
        + "</table>"
        + _button(link, "Open the full digest")
        + f'<p style="margin:0;font-size:12px;color:{_MUTED}">Numbers cover {esc(wk["label"])} ({esc(wk["timezone"])}) and are computed from your stored reviews, requests and cases.</p>'
    )
    foot = f'You receive this because weekly digest emails are on for your account. <a href="{esc(manage)}" style="color:{_MUTED}">Manage digest emails</a>'
    if footer:
        foot = f"{esc(footer)}<br>{foot}"
    elif not hide_attribution:
        foot = f"Sent by ReviewPilot AI · {foot}"
    html = _digest_layout(f"{'[Test] ' if test else ''}Your week at {org_name}", body, brand=brand, footer=foot)

    lines = [
        f"{'[TEST] ' if test else ''}WEEKLY INTELLIGENCE · {wk['label']}",
        f"{org_name} · {scope['label']}" + (" · DEMO DATA" if d.get("is_demo") else ""),
        "",
        d["narrative"]["text"],
        f"(Summary: {provider})",
        "",
        f"New reviews: {r['new']} (previous week {r['previous']})",
        f"Average rating: {'—' if r['average_rating'] is None else f'{r['average_rating']:.2f}'}",
        f"Response rate: {_fmt_rate(r['response_rate'])}",
        f"Awaiting reply: {r['pending_replies']} this week · {r['backlog']} backlog",
        "",
        "RATING MIX",
        *[f"  {m['rating']}★  {m['count']}" for m in r["rating_mix"]],
        "",
        "TOP THEMES",
        *([f"  - {t['label']}: {t['mentions']} mentions, {t['avg_rating']:.1f}★" for t in d["themes"][:5]] or ["  None detected"]),
        "",
        "PRAISE",
        *([f"  “{h['excerpt']}” — {h['reviewer']}, {h['rating']}★" for h in d["highlights"]["praise"]] or ["  None this week"]),
        "NEEDS ATTENTION",
        *([f"  “{h['excerpt']}” — {h['reviewer']}, {h['rating']}★" for h in d["highlights"]["complaints"]] or ["  None this week"]),
        "",
        "RECOVERY & AUTOMATION",
        *[f"  {lbl}: {val}" for lbl, val in activity_items],
        "",
        "RECOMMENDED ACTIONS",
        *[f"  {i:02d}. {a['title']} — {a.get('detail') or ''}" for i, a in enumerate(d["actions"], start=1)],
        "",
        f"Open the full digest: {link}",
        f"Manage digest emails: {manage}",
    ]
    return subject, html, "\n".join(lines)
