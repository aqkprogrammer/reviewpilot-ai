/**
 * Shared domain contracts between the ReviewPilot API and web clients.
 * Keep these in sync with apps/api/app/models/enums.py.
 */

export const ORG_ROLES = ["owner", "admin", "manager", "staff", "analyst"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const PLATFORM_ROLES = ["user", "platform_super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PERMISSIONS = [
  "org.manage",
  "billing.manage",
  "team.manage",
  "locations.manage",
  "reviews.read",
  "reviews.reply",
  "campaigns.manage",
  "customers.read",
  "customers.manage",
  "analytics.read",
  "integrations.manage",
  "ai.use",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    "locations.manage", "reviews.read", "reviews.reply", "campaigns.manage",
    "customers.read", "customers.manage", "analytics.read", "integrations.manage",
    "ai.use", "settings.manage", "team.manage",
  ],
  manager: [
    "reviews.read", "reviews.reply", "campaigns.manage", "customers.read",
    "customers.manage", "analytics.read", "ai.use",
  ],
  staff: ["reviews.read", "customers.read", "customers.manage", "ai.use"],
  analyst: ["reviews.read", "analytics.read"],
};

export const CHANNELS = ["qr", "whatsapp", "email", "sms"] as const;
export type Channel = (typeof CHANNELS)[number];

export const AI_TONES = ["professional", "friendly", "empathetic", "appreciative", "concise", "apologetic"] as const;
export type AiTone = (typeof AI_TONES)[number];

export const AI_LANGUAGES = ["en", "hi", "hinglish"] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "active", "paused", "completed", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "grace_period", "canceled", "expired", "incomplete"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INTEGRATION_STATUSES = ["connected", "not_connected", "pending_authorization", "token_expired", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant & Café" },
  { value: "dental", label: "Dental clinic" },
  { value: "healthcare", label: "Hospital & healthcare" },
  { value: "salon", label: "Salon & spa" },
  { value: "hotel", label: "Hotel & hospitality" },
  { value: "real_estate", label: "Real estate" },
  { value: "automotive", label: "Automotive dealership" },
  { value: "education", label: "Coaching & education" },
  { value: "retail", label: "Retail store" },
  { value: "local_services", label: "Local services" },
  { value: "agency", label: "Marketing agency" },
  { value: "other", label: "Other" },
] as const;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; request_id?: string };
}
