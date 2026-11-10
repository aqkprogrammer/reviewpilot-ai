/** Shapes returned by GET /digest/preview and /digest/settings (apps/api/app/services/digest.py). */

export interface DigestHighlight {
  review_id: string;
  excerpt: string;
  reviewer: string;
  rating: number;
  date: string;
  location_name: string | null;
}

export interface DigestTheme {
  topic: string;
  label: string;
  mentions: number;
  avg_rating: number;
  negative: number;
  positive: number;
}

export interface DigestAction {
  kind: string;
  title: string;
  detail: string;
  link: string | null;
}

export interface DigestLocation {
  location_id: string;
  name: string;
  new_reviews: number;
  previous_new_reviews: number;
  average_rating: number | null;
  rating_delta: number | null;
  response_rate: number | null;
  pending_replies: number;
}

export interface DigestWeekOption {
  week_end: string;
  label: string;
  range: string;
  is_partial: boolean;
}

export interface Digest {
  organization: { id: string; name: string };
  is_demo: boolean;
  label: string | null;
  week: { key: string; week_end: string; start: string; end: string; label: string; timezone: string; is_partial: boolean; previous_label: string };
  scope: { location_id: string | null; location_name: string | null; restricted: boolean; label: string };
  reviews: {
    new: number;
    previous: number;
    delta: number;
    delta_pct: number | null;
    average_rating: number | null;
    previous_average_rating: number | null;
    rating_delta: number | null;
    response_rate: number | null;
    previous_response_rate: number | null;
    response_rate_delta: number | null;
    responded: number;
    pending_replies: number;
    backlog: number;
    rating_mix: { rating: number; count: number; share: number }[];
  };
  themes: DigestTheme[];
  themes_source: "tagged" | "keyword" | "mixed" | "none";
  highlights: { praise: DigestHighlight[]; complaints: DigestHighlight[] };
  recovery: { opened: number; previous_opened: number; resolved: number; breached: number; open_now: number };
  requests: { sent: number; previous_sent: number; google_clicks: number; previous_google_clicks: number; page_opens: number; click_rate: number | null };
  automation: { visits: number; previous_visits: number; requests_sent: number; skipped: number; failed: number; active_rules: number };
  qr: { scans: number; previous_scans: number };
  locations: DigestLocation[];
  actions: DigestAction[];
  narrative: { text: string; provider: "openai" | "heuristic"; model: string; label: string };
  definitions: Record<string, string>;
  generated_at: string;
  has_activity: boolean;
  available_weeks: DigestWeekOption[];
}

export interface DigestSettings {
  email_enabled: boolean;
  in_app_enabled: boolean;
  is_default: boolean;
  default_email_enabled: boolean;
  org_enabled: boolean;
  can_manage_org: boolean;
  schedule: string;
  last_sent_week: string | null;
  last_sent_at: string | null;
  email: string;
}
