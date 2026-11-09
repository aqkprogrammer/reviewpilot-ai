"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { Eyebrow } from "@/components/console/kit";
import { GoogleCard } from "@/components/integrations/google-card";
import { EmailCard, OpenAICard, SmsCard } from "@/components/integrations/other-cards";
import { WhatsAppCard } from "@/components/integrations/whatsapp-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { Reveal, StatusDot } from "@/components/ui/tech";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

const GOOGLE_RESULTS: Record<string, [kind: "success" | "error" | "info", message: string]> = {
  connected: ["success", "Google Business Profile connected. Link your locations below."],
  pending_access: ["info", "Google authorized the connection, but Business Profile API access for this project is still pending Google's approval."],
  cancelled: ["info", "Google connection was cancelled."],
  state_invalid: ["error", "The Google connection link expired. Please try again."],
  session_mismatch: ["error", "Please connect Google while signed in as the same user who started the connection."],
  exchange_failed: ["error", "Google rejected the authorization. Please try again."],
  discovery_failed: ["error", "Connected, but we couldn't list your Business Profile accounts. Try “Refresh accounts”."],
};

function GoogleResultToast() {
  const params = useSearchParams();
  const router = useRouter();
  React.useEffect(() => {
    const r = params.get("google");
    if (!r) return;
    const [kind, msg] = GOOGLE_RESULTS[r] ?? ["info", `Google: ${r}`];
    toast[kind](msg);
    router.replace("/app/integrations");
  }, [params, router]);
  return null;
}

const LABEL: Record<string, string> = { connected: "Connected", not_connected: "Not connected", not_configured: "Not configured", pending_authorization: "Pending auth", token_expired: "Token expired", error: "Error", simulated: "Simulated" };
const TONE: Record<string, "ok" | "warn" | "error" | "idle" | "live"> = { connected: "ok", simulated: "live", pending_authorization: "warn", token_expired: "warn", error: "error" };

/** Signal map: one cell per provider, reading the same queries the cards use (deduped by React Query). */
function SignalMap() {
  const { orgId } = useOrg();
  const google = useQuery({ queryKey: ["integrations", "google", orgId], queryFn: () => api.get<{ platform_configured: boolean; status: string }>("/integrations/google") });
  const wa = useQuery({ queryKey: ["integrations", "whatsapp", orgId], queryFn: () => api.get<{ status: string }>("/integrations/whatsapp") });
  const email = useQuery({ queryKey: ["integrations", "email", orgId], queryFn: () => api.get<{ configured: boolean; delivery: { mode: string } }>("/integrations/email") });
  const overview = useQuery({ queryKey: ["integrations", "overview", orgId], queryFn: () => api.get<{ sms: { status: string; delivery: { mode: string } }; openai: { status: string; model: string | null } }>("/integrations") });
  const g = google.data;
  const cells = [
    { name: "Google", icon: <GoogleIcon />, status: g ? (!g.platform_configured && g.status === "not_connected" ? "not_configured" : g.status) : null },
    { name: "WhatsApp", icon: <WhatsAppIcon />, status: wa.data?.status ?? null },
    { name: "Email", icon: <Mail className="text-primary" />, status: email.data ? (email.data.configured ? "connected" : email.data.delivery.mode === "simulated" ? "simulated" : "not_configured") : null },
    { name: "SMS", icon: <MessageCircle className="text-cyan" />, status: overview.data ? (overview.data.sms.status === "connected" ? "connected" : overview.data.sms.delivery.mode === "simulated" ? "simulated" : "not_configured") : null },
    { name: "OpenAI", icon: <Cpu className="text-primary" />, status: overview.data ? (overview.data.openai.status === "connected" ? "connected" : "not_configured") : null },
  ];
  const live = cells.filter((c) => c.status === "connected").length;
  const loaded = cells.every((c) => c.status != null);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background-subtle/70 px-4 py-2.5">
        <span className="micro-label">Signal map</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{loaded ? `${live} / ${cells.length} live` : "Checking…"}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.name} className="flex items-center gap-3 bg-card px-4 py-3 last:max-sm:col-span-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background-subtle [&_svg]:size-4">{c.icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{c.name}</p>
              {c.status == null ? <Skeleton className="mt-1 h-3 w-16" /> : (
                <p className={cn("mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]", c.status === "connected" ? "text-success-foreground" : c.status === "error" ? "text-danger-foreground" : ["pending_authorization", "token_expired"].includes(c.status) ? "text-warning-foreground" : "text-subtle-foreground")}>
                  <StatusDot tone={TONE[c.status] ?? "idle"} className="size-1.5 [&>span]:size-1.5" />
                  {LABEL[c.status] ?? c.status}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { orgId, can } = useOrg();
  const overview = useQuery({ queryKey: ["integrations", "overview", orgId], queryFn: () => api.get<{ sms: { status: string; delivery: { mode: string } }; openai: { status: string; model: string | null } }>("/integrations") });
  if (!can("reviews.read") && !can("integrations.manage")) return <ReadOnlyNotice />;
  return (
    <div className="space-y-6">
      <React.Suspense fallback={null}><GoogleResultToast /></React.Suspense>
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow parts={["Manage", "Connections"]} />}
        title="Integrations"
        description="Connection status is always real — nothing shows as connected unless the provider confirmed it."
      />
      <SignalMap />
      {!can("integrations.manage") && <p className="-mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Read-only · owners and admins can change connections</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="min-w-0 lg:col-span-2"><GoogleCard /></Reveal>
        <Reveal className="min-w-0"><WhatsAppCard /></Reveal>
        <Reveal delay={0.04} className="min-w-0"><EmailCard /></Reveal>
        <Reveal className="min-w-0"><SmsCard data={overview.data?.sms} /></Reveal>
        <Reveal delay={0.04} className="min-w-0"><OpenAICard data={overview.data?.openai} /></Reveal>
      </div>
    </div>
  );
}
