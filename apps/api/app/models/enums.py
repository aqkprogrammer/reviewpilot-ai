"""Domain enumerations (stored as strings). Mirror of packages/shared-types."""

from enum import StrEnum


class PlatformRole(StrEnum):
    USER = "user"
    SUPER_ADMIN = "platform_super_admin"


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class OrgRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"
    ANALYST = "analyst"


class OrgStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class Channel(StrEnum):
    QR = "qr"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"


class CampaignStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RequestStatus(StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    CLICKED = "clicked"
    FAILED = "failed"
    SKIPPED = "skipped"  # e.g. no consent / opted out


class DeliveryStatus(StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    BOUNCED = "bounced"


class ReviewSource(StrEnum):
    GOOGLE = "google"  # synchronized via Google Business Profile API
    DEMO = "demo"  # seeded demo data, never real


class ReplyStatus(StrEnum):
    DRAFT = "draft"
    PENDING_PUBLISH = "pending_publish"
    PUBLISHED = "published"
    FAILED = "failed"


class ResponseStatus(StrEnum):
    PENDING = "pending"
    RESPONDED = "responded"
    HANDLED = "handled"


class Sentiment(StrEnum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    MIXED = "mixed"


class IntegrationStatus(StrEnum):
    CONNECTED = "connected"
    NOT_CONNECTED = "not_connected"
    PENDING = "pending_authorization"
    TOKEN_EXPIRED = "token_expired"
    ERROR = "error"


class SubscriptionStatus(StrEnum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    GRACE_PERIOD = "grace_period"
    CANCELED = "canceled"
    EXPIRED = "expired"
    INCOMPLETE = "incomplete"


class BillingInterval(StrEnum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class TicketStatus(StrEnum):
    OPEN = "open"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ConsentType(StrEnum):
    TRANSACTIONAL = "transactional"  # service-related review request
    MARKETING = "marketing"


class ConsentStatus(StrEnum):
    GRANTED = "granted"
    REVOKED = "revoked"
