import type { OrgRole, Permission } from "@reviewpilot/shared-types";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  platform_role: "user" | "platform_super_admin";
  status: string;
  locale: string;
  timezone: string;
  has_password: boolean;
  created_at: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  industry: string;
  logo_url: string | null;
  status: string;
  is_demo: boolean;
  onboarding_completed: boolean;
  plan_code: string | null;
  subscription_status: string | null;
}

export interface Membership {
  organization: OrgSummary;
  role: OrgRole;
  permissions: Permission[];
  location_ids: string[] | null;
}

export interface Me {
  user: User;
  memberships: Membership[];
  demo_mode: boolean;
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  timezone: string;
  google_review_url: string | null;
  google_place_id: string | null;
  google_location_name: string | null;
  feedback_page: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  google_status: string;
  review_count: number;
  average_rating: number | null;
  pending_responses: number;
  qr_count: number;
  campaign_count: number;
  effective_review_url: string | null;
}
