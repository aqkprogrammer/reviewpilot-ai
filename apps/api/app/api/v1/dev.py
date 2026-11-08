"""Development-only helpers (404 outside development/test)."""

from fastapi import APIRouter

from app.core.config import settings
from app.core.errors import NotFound
from app.providers.email import DEV_OUTBOX

router = APIRouter(prefix="/dev", tags=["dev"], include_in_schema=False)


@router.get("/outbox")
async def outbox():
    if settings.environment not in ("development", "test"):
        raise NotFound("Not found")
    return list(DEV_OUTBOX)
