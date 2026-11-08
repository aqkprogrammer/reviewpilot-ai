from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORM

TONES = ("professional", "friendly", "empathetic", "appreciative", "concise", "apologetic")


class ReplyOut(ORM):
    id: uuid.UUID
    body: str
    tone: str | None
    language: str | None
    status: str
    published_at: datetime | None
    publish_error: str | None
    author_id: uuid.UUID | None
    approved_by_id: uuid.UUID | None
    ai_generation_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ReviewOut(ORM):
    id: uuid.UUID
    location_id: uuid.UUID
    location_name: str | None = None
    source: str
    platform: str
    reviewer_name: str | None
    reviewer_photo_url: str | None
    rating: int
    comment: str | None
    language: str | None
    review_created_at: datetime
    response_status: str
    platform_reply: str | None
    platform_reply_at: datetime | None
    sentiment: str | None
    topics: list[str]
    is_flagged: bool
    handled_at: datetime | None


class ReviewDetail(ReviewOut):
    history: list
    replies: list[ReplyOut] = []
    can_publish: bool = False
    publish_mode: str = "demo"  # google|demo|unavailable


class ReplyDraftIn(BaseModel):
    body: str = Field(min_length=2, max_length=4000)
    tone: str | None = None
    language: str | None = None
    ai_generation_id: uuid.UUID | None = None


class SuggestIn(BaseModel):
    tone: str = Field("professional", pattern="^(" + "|".join(TONES) + ")$")
    language: str = Field("en", pattern="^(en|hi|hinglish)$")


class SuggestOut(BaseModel):
    reply: str
    explanation: str | None = None
    sentiment: str | None = None
    keywords: list[str] = []
    follow_up: str | None = None
    provider: str
    generation_id: str


class ReviewStats(BaseModel):
    total: int
    average_rating: float | None
    pending: int
    responded: int
    negative_pending: int
