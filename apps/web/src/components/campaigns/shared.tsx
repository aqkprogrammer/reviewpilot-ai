"use client";
import { Mail, MessageSquare, QrCode } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { cn } from "@/lib/utils";

export interface Campaign {
  id: string;
  name: string;
  location_id: string;
  location_name: string | null;
  channel: "whatsapp" | "email" | "sms" | "qr";
  status: string;
  template_id: string | null;
  message_subject: string | null;
  message_body: string | null;
  audience: Record<string, unknown>;
  schedule_at: string | null;
  reminder_enabled: boolean;
  reminder_after_hours: number;
  max_reminders: number;
  launched_at: string | null;
  completed_at: string | null;
  created_at: string;
  stats: CampaignStats;
}

export interface CampaignStats {
  requests: number; sent: number; delivered: number; failed: number; skipped: number; clicks: number; google_clicks: number; conversion_rate: number | null; scans?: number;
}

export interface RequestRow {
  id: string; channel: string; status: string; customer_id: string | null; customer_name: string | null; recipient: string | null; campaign_id: string | null; campaign_name: string | null;
  location_id: string; sent_at: string | null; delivered_at: string | null; clicked_at: string | null; google_clicked_at: string | null; failed_reason: string | null; reminders_sent: number; created_at: string;
}

export const CHANNEL_META = {
  whatsapp: { label: "WhatsApp", icon: WhatsAppIcon, tone: "text-success" },
  email: { label: "Email", icon: Mail, tone: "text-ice" },
  sms: { label: "SMS", icon: MessageSquare, tone: "text-mint" },
  qr: { label: "QR code", icon: QrCode, tone: "text-cyan" },
} as const;

/** Channel glyph in a graphite instrument chip (hairline border, tinted icon). */
export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const m = CHANNEL_META[channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.email;
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background-subtle shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]", m.tone, className)} title={m.label}>
      <m.icon className="size-[17px]" />
    </span>
  );
}

export const REASONS: Record<string, string> = {
  no_consent: "No consent for this channel",
  opted_out: "Customer opted out",
  no_phone: "No phone number",
  no_email: "No email address",
  customer_deleted: "Customer erased",
  missing_data: "Missing data",
};
