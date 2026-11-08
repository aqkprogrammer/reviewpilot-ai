from __future__ import annotations

import re
import secrets
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def slugify(value: str, max_len: int = 60) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return (value or "business")[:max_len].strip("-")


async def unique_slug(db: AsyncSession, column, base: str, max_len: int = 60) -> str:
    slug = slugify(base, max_len - 6)
    candidate = slug
    for _ in range(20):
        exists = await db.scalar(select(column).where(column == candidate).limit(1))
        if not exists:
            return candidate
        candidate = f"{slug}-{secrets.token_hex(2)}"
    return f"{slug}-{secrets.token_hex(4)}"
