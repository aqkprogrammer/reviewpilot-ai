export interface PublicPlan {
  code: string;
  name: string;
  description: string;
  price_monthly_minor: number | null;
  price_yearly_minor: number | null;
  currency: string;
  max_locations: number | null;
  max_team_members: number | null;
  features: string[];
  is_popular: boolean;
  is_custom_pricing: boolean;
}

export const TRIAL_DAYS = 14;

/** Fallback plan catalogue (mirrors the API seed). Amounts in paise. */
export const DEFAULT_PLANS: PublicPlan[] = [
  {
    code: "starter",
    name: "Starter",
    description: "For a single storefront getting serious about its Google reputation.",
    price_monthly_minor: 99900,
    price_yearly_minor: 999000,
    currency: "INR",
    max_locations: 1,
    max_team_members: 2,
    features: ["1 business location", "Branded QR codes & feedback page", "Basic review collection", "Review inbox & manual replies", "Basic analytics", "Up to 2 team members"],
    is_popular: false,
    is_custom_pricing: false,
  },
  {
    code: "growth",
    name: "Growth",
    description: "WhatsApp-first collection and AI replies for growing multi-location businesses.",
    price_monthly_minor: 199900,
    price_yearly_minor: 1999000,
    currency: "INR",
    max_locations: 3,
    max_team_members: 10,
    features: ["Up to 3 locations", "WhatsApp review campaigns", "AI review responses (EN / HI / Hinglish)", "Advanced analytics & sentiment", "Customer management & CSV import", "Up to 10 team members"],
    is_popular: true,
    is_custom_pricing: false,
  },
  {
    code: "agency",
    name: "Agency",
    description: "Run reputation for many clients from one workspace, under your brand.",
    price_monthly_minor: 499900,
    price_yearly_minor: 4999000,
    currency: "INR",
    max_locations: 10,
    max_team_members: 50,
    features: ["Up to 10 locations", "Multi-organization management", "White-label feedback pages", "Team roles & location access", "Advanced reporting & PDF exports", "Priority support"],
    is_popular: false,
    is_custom_pricing: false,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Hospital chains, franchises and brands with custom security and scale needs.",
    price_monthly_minor: null,
    price_yearly_minor: null,
    currency: "INR",
    max_locations: null,
    max_team_members: null,
    features: ["Unlimited locations", "SSO & custom data retention", "Dedicated success manager", "Custom integrations & SLAs", "Security review & DPA"],
    is_popular: false,
    is_custom_pricing: true,
  },
];

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Server-side fetch of the live plan catalogue with graceful fallback.
 *
 * - Never touches the network during `next build`: builds must not depend on the API being
 *   reachable (on Render the API may be redeploying at the same moment). Pages that call this
 *   export `revalidate = 300`, so live prices replace the defaults within five minutes.
 * - Hard 2.5 s ceiling via Promise.race, because the patched fetch used during prerendering
 *   doesn't reliably honour AbortSignal timeouts.
 */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  if (process.env.NEXT_PHASE === "phase-production-build") return DEFAULT_PLANS;
  const timeout = new Promise<PublicPlan[]>((resolve) => setTimeout(() => resolve(DEFAULT_PLANS), 2500));
  const live = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/subscriptions/plans`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return DEFAULT_PLANS;
      const data = (await res.json()) as PublicPlan[] | { items: PublicPlan[] };
      const plans = Array.isArray(data) ? data : data.items;
      return plans?.length ? plans : DEFAULT_PLANS;
    } catch {
      return DEFAULT_PLANS;
    }
  })();
  return Promise.race([live, timeout]);
}

export function formatINR(minor: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
}
