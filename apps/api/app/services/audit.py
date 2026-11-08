from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ratelimit import client_ip
from app.models import AuditLog, User


async def record(
    db: AsyncSession,
    action: str,
    *,
    actor: User | None = None,
    organization_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: Any = None,
    request: Request | None = None,
    meta: dict[str, Any] | None = None,
    actor_type: str | None = None,
) -> AuditLog:
    """Append an audit entry. Caller controls the transaction (commit with the business change)."""
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        actor_type=actor_type or ("super_admin" if actor and actor.is_super_admin else ("user" if actor else "system")),
        organization_id=organization_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        ip_address=client_ip(request) if request else None,
        user_agent=(request.headers.get("user-agent") or "")[:500] if request else None,
        meta=meta or {},
    )
    db.add(entry)
    return entry
