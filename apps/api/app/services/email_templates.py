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


def review_request(*, business: str, customer_name: str | None, message: str, link: str, unsubscribe_url: str, color: str) -> tuple[str, str]:
    greeting = f"Hi {_html.escape(customer_name)}," if customer_name else "Hello,"
    body = (
        f"<p>{greeting}</p><p>{_html.escape(message)}</p>{_button(link, 'Share your experience', color)}"
        "<p style='font-size:12px;color:#7d8b95'>Your honest feedback — positive or negative — helps us improve.</p>"
    )
    footer = f'You received this because you recently visited {_html.escape(business)}. <a href="{_html.escape(unsubscribe_url)}" style="color:#7d8b95">Unsubscribe</a>'
    text = f"{'Hi ' + customer_name + ',' if customer_name else 'Hello,'}\n\n{message}\n\n{link}\n\nUnsubscribe: {unsubscribe_url}"
    return _layout(f"How was your visit to {business}?", body, brand=business, color=color, footer=footer), text


def notification(title: str, body_text: str, link: str | None) -> tuple[str, str]:
    body = f"<p>{_html.escape(body_text)}</p>" + (_button(f"{settings.frontend_url}{link}", "Open ReviewPilot") if link else "")
    return _layout(title, body), f"{title}\n\n{body_text}\n{settings.frontend_url}{link or ''}"
