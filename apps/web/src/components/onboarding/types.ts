import type { Location, Me } from "@/lib/types";

export interface OrgFull {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  address: string | null;
  timezone: string;
  logo_url: string | null;
  brand_color: string;
  default_language: string;
  onboarding_step: number;
  onboarding_data: Record<string, unknown>;
  onboarding_completed_at: string | null;
}

export interface OnboardingState {
  step: number;
  steps: string[];
  data: Record<string, unknown>;
  completed: boolean;
  organization: OrgFull;
}

export interface WizardCtx {
  me: Me;
  org: OrgFull | null; // null until step 2 creates it (Google sign-ups / ?new=1)
  data: Record<string, unknown>;
  locations: Location[];
  refreshLocations: () => Promise<unknown>;
  /** Persist progress and move forward. */
  next: (data?: Record<string, unknown>) => Promise<void>;
  back: () => void;
  setOrg: (org: OrgFull) => void;
  step: number;
}

export const STEPS = [
  { key: "welcome", label: "Welcome", hint: "What you'll set up" },
  { key: "business", label: "Business details", hint: "Name, category, contact" },
  { key: "location", label: "Location", hint: "Where customers visit" },
  { key: "google", label: "Google", hint: "Connect or add review link" },
  { key: "collection", label: "Review collection", hint: "QR, WhatsApp, email" },
  { key: "team", label: "Team", hint: "Invite colleagues" },
  { key: "plan", label: "Plan", hint: "Trial or subscribe" },
  { key: "finish", label: "Finish", hint: "You're ready" },
] as const;
