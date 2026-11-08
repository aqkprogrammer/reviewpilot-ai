export interface Review {
  id: string;
  location_id: string;
  location_name: string | null;
  source: string;
  platform: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  rating: number;
  comment: string | null;
  language: string | null;
  review_created_at: string;
  response_status: "pending" | "responded" | "handled";
  platform_reply: string | null;
  platform_reply_at: string | null;
  sentiment: string | null;
  topics: string[];
  is_flagged: boolean;
  handled_at: string | null;
}

export interface Reply {
  id: string;
  body: string;
  tone: string | null;
  language: string | null;
  status: string;
  published_at: string | null;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewDetail extends Review {
  history: { at: string; event: string; by?: string; note?: string; error?: string }[];
  replies: Reply[];
  can_publish: boolean;
  publish_mode: "google" | "demo" | "unavailable";
}

export interface Suggestion {
  reply: string;
  explanation: string | null;
  sentiment: string | null;
  keywords: string[];
  follow_up: string | null;
  provider: string;
  generation_id: string;
}

export interface Feedback {
  id: string;
  location_id: string;
  rating: number | null;
  message: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  language: string;
  sentiment: string | null;
  status: "new" | "in_progress" | "resolved";
  channel: string;
  consent_contact: boolean;
  customer_id: string | null;
  created_at: string;
}

export const TOPIC_LABELS: Record<string, string> = {
  wait_time: "Wait time", staff: "Staff", cleanliness: "Cleanliness", quality: "Quality", price: "Price & value", ambience: "Ambience", booking: "Booking", parking: "Parking",
};

export const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-success-soft text-success-foreground",
  negative: "bg-danger-soft text-danger-foreground",
  mixed: "bg-warning-soft text-warning-foreground",
  neutral: "bg-blue-soft text-blue",
};
