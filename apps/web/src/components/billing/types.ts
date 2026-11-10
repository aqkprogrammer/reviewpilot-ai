export interface Plan {
  id: string; code: string; name: string; description: string | null; currency: string; price_monthly_minor: number; price_yearly_minor: number;
  max_locations: number; max_team_members: number; max_organizations: number; ai_requests_per_month: number; monthly_message_quota: number;
  features: string[]; entitlements: Record<string, boolean>; is_popular: boolean; is_custom_pricing: boolean;
}
export interface CurrentSub {
  subscription: null | {
    id: string; status: string; interval: string; provider: string | null; trial_ends_at: string | null; current_period_start: string | null;
    current_period_end: string | null; grace_period_ends_at: string | null; cancel_at_period_end: boolean; canceled_at: string | null;
    pending_plan: Plan | null; pending_checkout: { provider: string; reference: string; plan_code: string; interval: string } | null;
    scheduled_change: { plan: Plan; interval: string; effective_at: string | null } | null;
  };
  plan: Plan | null;
  usage: { locations: number; team_members: number; ai_requests: number };
  providers: { razorpay: boolean; stripe: boolean; mock: boolean; default: string };
  can_manage: boolean;
}
export interface PaymentRow {
  id: string; provider: string; amount_minor: number; currency: string; status: string; failure_reason: string | null; plan_code: string | null;
  paid_at: string | null; created_at: string; invoice_id: string | null; invoice_number: string | null; simulated: boolean;
}
