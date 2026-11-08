export interface Kpis {
  total_reviews: number;
  average_rating: number | null;
  period_average_rating: number | null;
  new_reviews: number;
  requests_sent: number;
  requests_delivered: number;
  requests_failed: number;
  page_opens: number;
  google_clicks: number;
  conversion_rate: number | null;
  response_rate: number | null;
  qr_scans: number;
}

export interface Overview {
  kpis: Kpis;
  previous: Kpis;
  deltas: Record<keyof Kpis, number | null>;
  definitions: Record<string, string>;
  is_demo: boolean;
  range: { start: string; end: string };
  series: { date: string; reviews: number; avg_rating: number | null; positive: number; negative: number; cumulative: number }[];
  ratings: { rating: number; count: number; share: number }[];
  sentiment: { sentiment: string; count: number }[];
  locations: { location_id: string; name: string; reviews: number; avg_rating: number | null; response_rate: number | null; requests_sent: number }[];
  campaigns: { campaign_id: string; name: string; channel: string; status: string; sent: number; delivered: number; failed: number; clicks: number; google_clicks: number; conversion_rate: number | null }[];
  insights: { id: string; kind: string; title: string; detail: string; severity: string; evidence_count: number; generated_by: string }[];
  recent_reviews: { id: string; reviewer_name: string | null; rating: number; comment: string | null; review_created_at: string; response_status: string; source: string; location_id: string }[];
}
