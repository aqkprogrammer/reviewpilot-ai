"""Import every model so Alembic autogenerate and relationship resolution see them."""

from app.models.ai import AIGeneration, AIInsight, AIUsage
from app.models.base import Base
from app.models.billing import Invoice, Payment, Subscription, SubscriptionPlan
from app.models.campaign import Campaign, CampaignTemplate, MessageDelivery, ReviewRequest
from app.models.customer import Customer, CustomerConsent
from app.models.feedback import FeedbackSubmission
from app.models.growth import ApiKey, AutomationRule, RecoveryCase, VisitEvent
from app.models.integration import GoogleAccount, GoogleConnection, IntegrationCredential
from app.models.notification import Notification, NotificationPreference
from app.models.organization import Invitation, Location, LocationMember, Organization, OrganizationMember
from app.models.platform import AuditLog, BackgroundJob, ErrorEvent, FeatureFlag, SystemSetting, WebhookEvent
from app.models.qr import QRCode, QRScan
from app.models.review import Review, ReviewReply
from app.models.support import Announcement, ContactMessage, SupportMessage, SupportTicket
from app.models.user import AuthSession, AuthToken, OAuthIdentity, User

__all__ = [
    "ApiKey", "AutomationRule", "RecoveryCase", "VisitEvent",
    "AIGeneration", "AIInsight", "AIUsage", "Announcement", "AuditLog", "AuthSession", "AuthToken",
    "BackgroundJob", "Base", "Campaign", "CampaignTemplate", "ContactMessage", "Customer", "CustomerConsent",
    "ErrorEvent", "FeatureFlag", "FeedbackSubmission", "GoogleAccount", "GoogleConnection",
    "IntegrationCredential", "Invitation", "Invoice", "Location", "LocationMember", "MessageDelivery",
    "Notification", "NotificationPreference", "OAuthIdentity", "Organization", "OrganizationMember",
    "Payment", "QRCode", "QRScan", "Review", "ReviewReply", "ReviewRequest", "Subscription",
    "SubscriptionPlan", "SupportMessage", "SupportTicket", "SystemSetting", "User", "WebhookEvent",
]
