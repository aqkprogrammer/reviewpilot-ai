export interface QR {
  id: string;
  name: string;
  code: string;
  location_id: string;
  location_name: string | null;
  campaign_id: string | null;
  foreground: string;
  background: string;
  template: string;
  logo_url: string | null;
  card_headline: string | null;
  card_subtext: string | null;
  scan_count: number;
  last_scanned_at: string | null;
  created_at: string;
  scan_url: string;
  scans_7d: number;
}
