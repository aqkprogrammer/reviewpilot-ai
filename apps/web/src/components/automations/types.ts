export type RuleChannel = "auto" | "whatsapp" | "email" | "sms";

export interface RuleStats { visits_7d: number; sent_7d: number; skipped_7d: number; failed_7d: number; scheduled: number }

export interface Rule {
  id: string;
  name: string;
  location_id: string | null;
  location_name: string | null;
  channel: RuleChannel;
  template_id: string | null;
  template_name: string | null;
  message_body: string | null;
  delay_minutes: number;
  quiet_hours: { start?: number; end?: number };
  cooldown_days: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  stats: RuleStats;
}

export interface VisitRow {
  id: string;
  source: string;
  external_id: string | null;
  status: "received" | "scheduled" | "processing" | "sent" | "skipped" | "failed";
  skip_reason: string | null;
  skip_label: string | null;
  occurred_at: string;
  scheduled_for: string | null;
  created_at: string;
  location_id: string;
  location_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  rule_id: string | null;
  rule_name: string | null;
  review_request_id: string | null;
  channel: string | null;
  request_status: string | null;
  clicked_at: string | null;
  google_clicked_at: string | null;
}

export interface Summary {
  window_days: number;
  received: number;
  scheduled: number;
  sent: number;
  skipped: number;
  failed: number;
  skipped_by_reason: { reason: string; label: string; count: number }[];
  page_opens: number;
  google_clicks: number;
  next_send_at: string | null;
  last_visit_at: string | null;
  by_source: Record<string, number>;
  rules_enabled: number;
  api_keys_active: number;
  definitions: Record<string, string>;
}

export interface ApiKeyRow { id: string; name: string; prefix: string; scopes: string[]; last_used_at: string | null; revoked_at: string | null; created_at: string }

export interface ShopifyStatus {
  configured: boolean;
  status: string;
  location_id: string | null;
  location_name: string | null;
  shop_domain: string | null;
  secret_hint: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  webhook_url: string;
  topics: string[];
}

export interface IngestResult { id: string; status: string; skip_reason: string | null; scheduled_for: string | null; rule_id: string | null; customer_id: string | null; duplicate: boolean }

export const SKIP_LABELS: Record<string, string> = {
  no_matching_rule: "No rule for this location",
  no_consent: "No consent on an eligible channel",
  opted_out: "Customer opted out",
  no_phone: "No phone number",
  no_email: "No email address",
  no_contact: "No phone or email",
  cooldown: "Inside cooldown window",
  not_in_plan: "WhatsApp not in plan",
  channel_unavailable: "Channel not connected",
  rule_disabled: "Rule disabled before send",
  rule_removed: "Rule deleted before send",
  visit_too_old: "Visit older than 14 days",
  customer_deleted: "Customer erased",
  interrupted: "Interrupted — not retried",
};

export const SOURCE_LABELS: Record<string, string> = { api: "API", zapier: "Zapier", shopify: "Shopify", manual: "Manual" };

export const CHANNEL_LABELS: Record<string, string> = { auto: "Auto", whatsapp: "WhatsApp", email: "Email", sms: "SMS" };

export const automationKeys = {
  all: ["automations"] as const,
  summary: (orgId: string) => ["automations", "summary", orgId] as const,
  rules: (orgId: string) => ["automations", "rules", orgId] as const,
  visits: (orgId: string, ...rest: unknown[]) => ["automations", "visits", orgId, ...rest] as const,
  keys: (orgId: string) => ["automations", "keys", orgId] as const,
  shopify: (orgId: string) => ["automations", "shopify", orgId] as const,
};

/** "2h", "30m", "1d 4h", "Immediately". */
export function formatDelay(minutes: number) {
  if (!minutes) return "Immediately";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function hasQuiet(q: Rule["quiet_hours"] | null | undefined): q is { start: number; end: number } {
  return !!q && typeof q.start === "number" && typeof q.end === "number" && q.start !== q.end;
}

function inQuiet(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Same math as the API (services/automations.apply_quiet_hours), in "location wall-clock"
 * minutes since the visit day's midnight. Used only to explain a rule with an example.
 */
export function exampleSend(visitMinutes: number, delay: number, quiet?: { start: number; end: number } | null) {
  let t = visitMinutes + delay;
  let shifted = false;
  if (quiet && inQuiet(Math.floor((t % 1440) / 60), quiet.start, quiet.end)) {
    const day = Math.floor(t / 1440);
    let target = day * 1440 + quiet.end * 60;
    if (target <= t) target += 1440;
    t = target;
    shifted = true;
  }
  return { minutes: t, dayOffset: Math.floor(t / 1440), shifted };
}

export function clock(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 1 ? "now" : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  if (text === "now") return "now";
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
