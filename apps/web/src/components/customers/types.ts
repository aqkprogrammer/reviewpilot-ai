export interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  location_id: string | null;
  tags: string[];
  notes: string | null;
  source: string;
  preferred_language: string;
  opted_out_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  consents: Record<string, boolean>;
  request_count: number;
}

export interface TimelineItem { at: string; kind: string; title: string; detail: string | null; status: string | null }

export interface CustomerDetail extends Customer {
  timeline: TimelineItem[];
  consent_history: { channel: string; type: string; status: string; source: string; at: string }[];
}

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];
