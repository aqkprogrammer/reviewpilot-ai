import type { BadgeProps } from "@/components/ui/badge";

export type Severity = "critical" | "high" | "medium";
export type CaseStatus = "open" | "in_progress" | "contacted" | "resolved" | "closed";
export type Resolution = "resolved_happy" | "resolved_neutral" | "unreachable" | "not_actionable";
export type ContactChannel = "call" | "whatsapp" | "email" | "sms";
export type ContactOutcome = "reached" | "no_answer" | "left_message" | "message_sent";

export interface CaseItem {
  id: string;
  title: string;
  summary: string | null;
  source: "review" | "feedback" | "manual";
  severity: Severity;
  status: CaseStatus;
  location_id: string | null;
  location_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  review_id: string | null;
  feedback_id: string | null;
  rating: number | null;
  customer_name: string | null;
  due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  resolution: Resolution | null;
  created_at: string;
  breached: boolean;
  sla_missed: boolean;
  is_demo: boolean;
}

export interface TimelineEntry {
  at: string;
  by: string;
  by_id?: string;
  event: string;
  note: string | null;
  channel?: ContactChannel;
  outcome?: ContactOutcome;
  resolution?: Resolution;
  first?: boolean;
}

export interface CaseDetail extends CaseItem {
  timeline: TimelineEntry[];
  review: { id: string; source: string; rating: number; comment: string | null; reviewer_name: string | null; review_created_at: string; response_status: string; platform_reply: string | null } | null;
  feedback: { id: string; rating: number | null; message: string; name: string | null; channel: string; sentiment: string | null; language: string; created_at: string } | null;
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    customer_id: string | null;
    consent_contact: boolean;
    consents: Record<string, boolean>;
    opted_out: boolean;
    can_contact: boolean;
    suggested_message: string;
    suggested_email: string;
  } | null;
  sla_hours: number;
  can_act: boolean;
}

export interface Summary {
  open: number;
  breached: number;
  due_today: number;
  resolved_7d: number;
  median_first_response_hours: number | null;
}

export interface RecoverySettings {
  enabled: boolean;
  review_max_rating: number;
  feedback_max_rating: number;
  feedback_negative: boolean;
  review_max_age_days: number;
  sla_hours: Record<Severity, number>;
  alert_whatsapp: string[];
  whatsapp_template: string;
  whatsapp_channel?: { channel: string; mode: "live" | "simulated" | "unavailable"; ready: boolean; note?: string };
}

export interface Assignee {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  is_you: boolean;
}

export interface CaseRef {
  id: string;
  status: CaseStatus;
  severity: Severity;
  breached: boolean;
}

export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export const SEVERITY: Record<Severity, { label: string; variant: BadgeProps["variant"]; rail: string }> = {
  critical: { label: "Critical", variant: "danger", rail: "bg-danger" },
  high: { label: "High", variant: "amber", rail: "bg-amber" },
  medium: { label: "Medium", variant: "info", rail: "bg-ice" },
};

export const STATUS: Record<CaseStatus, { label: string; variant: BadgeProps["variant"]; dot: "signal" | "warn" | "ok" | "idle" | "live" }> = {
  open: { label: "Open", variant: "primary", dot: "signal" },
  in_progress: { label: "In progress", variant: "info", dot: "warn" },
  contacted: { label: "Contacted", variant: "mint", dot: "live" },
  resolved: { label: "Resolved", variant: "success", dot: "ok" },
  closed: { label: "Closed", variant: "neutral", dot: "idle" },
};

export const RESOLUTIONS: { value: Resolution; label: string; hint: string }[] = [
  { value: "resolved_happy", label: "Resolved — customer satisfied", hint: "The customer confirmed the issue was put right." },
  { value: "resolved_neutral", label: "Resolved — acknowledged", hint: "We followed up and fixed what we could." },
  { value: "unreachable", label: "Customer unreachable", hint: "No response after reasonable attempts." },
  { value: "not_actionable", label: "Not actionable", hint: "Spam, duplicate or outside our control." },
];

export const CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

export const OUTCOMES: { value: ContactOutcome; label: string }[] = [
  { value: "reached", label: "Spoke with customer" },
  { value: "message_sent", label: "Message sent" },
  { value: "left_message", label: "Left a voicemail" },
  { value: "no_answer", label: "No answer" },
];

export const ACTIVE: CaseStatus[] = ["open", "in_progress", "contacted"];
export const CLOCK: CaseStatus[] = ["open", "in_progress"];

/** Client-side mirror of the server policy check (the server is authoritative). */
const POLICY = [
  /\b(?:remove|delete|change|edit|update|revise|retract|withdraw|take\s+down|modify|upgrade)\s+(?:your|ur)\s+(?:google\s+)?(?:review|rating|stars?)/i,
  /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:remove|delete|change|edit|update|revise|retract|withdraw|take\s+down|modify)\s+(?:the|this|that|it|your)\b[^.!?\n]{0,20}(?:review|rating|stars?)/i,
  /\b(?:give|leave|post|write)\s+(?:us\s+)?(?:a\s+)?(?:5|five)[\s-]*stars?\b/i,
  /\bin\s+exchange\s+for\b/i,
  /\b(?:discount|coupon|voucher|free|gift|refund|cashback|reward|credit|complimentary)\b[^.!?\n]{0,60}\b(?:if|when|once|after|for)\b[^.!?\n]{0,40}(?:review|rating|stars?)/i,
];
export const policyIssue = (text: string) => POLICY.some((p) => p.test(text));
export const POLICY_HINT = "Never ask a customer to change or remove a review, and never offer anything in exchange for one.";
