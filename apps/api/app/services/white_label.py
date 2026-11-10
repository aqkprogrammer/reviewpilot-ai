"""White-label branding (Agency / Enterprise entitlement `white_label`).

Settings live in organizations.white_label; they only take effect while the plan is entitled,
so a downgrade automatically restores ReviewPilot attribution.
"""

from __future__ import annotations

from email.utils import formataddr, parseaddr

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Organization
from app.services.organizations import has_entitlement


async def effective(db: AsyncSession, org: Organization) -> dict:
    wl = org.white_label or {}
    entitled = await has_entitlement(db, org.id, "white_label")
    return {
        "entitled": entitled,
        "hide_attribution": bool(entitled and wl.get("hide_attribution")),
        "sender_name": (wl.get("sender_name") or None) if entitled else None,
        "footer_text": (wl.get("footer_text") or None) if entitled else None,
    }


def sender_for(org: Organization, wl: dict) -> str:
    """From-header for customer-facing emails: the verified platform address, branded display name."""
    _, address = parseaddr(settings.email_from)
    if wl.get("sender_name"):
        name = wl["sender_name"]
    elif wl.get("hide_attribution"):
        name = org.name
    else:
        name = f"{org.name} via ReviewPilot"
    return formataddr((name[:70], address))
