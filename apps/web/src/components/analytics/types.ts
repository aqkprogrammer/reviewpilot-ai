export interface Kpis {
  total_reviews: number; average_rating: number | null; period_average_rating: number | null; new_reviews: number; requests_sent: number;
  requests_delivered: number; requests_failed: number; page_opens: number; google_clicks: number; conversion_rate: number | null; response_rate: number | null; qr_scans: number;
}
export interface Detailed {
  kpis: Kpis; previous: Kpis; deltas: Partial<Record<keyof Kpis, number | null>>; definitions: Record<string, string>; is_demo: boolean;
  range: { start: string; end: string };
  series: { date: string; reviews: number; avg_rating: number | null; positive: number; negative: number; cumulative: number }[];
  ratings: { rating: number; count: number; share: number }[];
  sentiment: { sentiment: string; count: number }[];
  topics: { topic: string; mentions: number; avg_rating: number }[];
  sources: { source: string; label: string; count: number }[];
  locations: { location_id: string; name: string; reviews: number; avg_rating: number | null; response_rate: number | null; requests_sent: number }[];
  campaigns: { campaign_id: string; name: string; channel: string; status: string; sent: number; delivered: number; failed: number; clicks: number; google_clicks: number; conversion_rate: number | null }[];
  channels: { channel: string; sent: number; delivered: number; failed: number; skipped: number; google_clicks: number }[];
  responses: { pending: number; responded: number; handled: number; avg_response_hours: number | null };
  monthly: { month: string; reviews: number; avg_rating: number | null; response_rate: number | null; requests_sent: number; google_clicks: number }[];
  filtered_kpis?: Kpis;
}
