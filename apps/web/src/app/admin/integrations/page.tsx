"use client";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { GoogleIcon, OpenAIIcon, RazorpayIcon, StripeIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { cn, titleCase } from "@/lib/utils";
import { Panel, QueryState, SectionHeader, StatusPill, relTime, useAdmin } from "@/components/admin/ui";

interface Integrations {
  platform: Record<string, boolean>;
  google_connections: Record<string, number>;
  credentials: Record<string, Record<string, number>>;
  failed_deliveries_7d: Record<string, number>;
  recent_errors: { provider: string; organization_name: string; status: string; error: string | null; at: string | null }[];
}

const PROVIDERS: { key: string; name: string; desc: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { key: "google_oauth", name: "Google OAuth & Business Profile", desc: "Sign-in, review sync and reply publishing", icon: GoogleIcon },
  { key: "whatsapp_platform", name: "WhatsApp Cloud API (platform number)", desc: "Fallback sender when an org has no own number", icon: WhatsAppIcon },
  { key: "openai", name: "OpenAI", desc: "AI replies, sentiment and insights", icon: OpenAIIcon },
  { key: "razorpay", name: "Razorpay", desc: "INR subscriptions and webhooks", icon: RazorpayIcon },
  { key: "stripe", name: "Stripe", desc: "International subscriptions", icon: StripeIcon },
  { key: "resend", name: "Resend", desc: "Transactional and review-request email" },
  { key: "twilio", name: "Twilio SMS", desc: "SMS provider adapter" },
  { key: "s3", name: "S3 storage", desc: "Logos and uploads (local disk otherwise)" },
];

export default function IntegrationsPage() {
  const q = useAdmin<Integrations>("/integrations");
  const d = q.data;
  return (
    <>
      <SectionHeader eyebrow="Operations" title="Integrations" description="Platform credentials (from environment variables) and the health of each organisation's connections." />
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PROVIDERS.map((p) => {
                const on = d.platform[p.key];
                const Icon = p.icon;
                return (
                  <div key={p.key} className={cn("rounded-2xl border bg-card p-4", on ? "border-[#10b981]/30" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card-elevated">{Icon ? <Icon className="size-5" /> : <CircleDashed className="size-4 text-subtle-foreground" />}</span>
                      {on ? <CheckCircle2 className="size-4 text-success-foreground" /> : <span className="font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">Not set</span>}
                    </div>
                    <p className="mt-3 text-[13px] font-medium text-foreground">{p.name}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{p.desc}</p>
                  </div>
                );
              })}
            </div>
            {d.platform.demo_mode && <p className="flex items-center gap-2 text-[12px] text-warning-foreground"><AlertTriangle className="size-3.5" /> Demo mode: unconfigured channels use clearly-labelled mock adapters.</p>}
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Google Business Profile" description="Organisation connections by status">
                <StatusList data={d.google_connections} empty="No organisation has connected Google yet." />
              </Panel>
              <Panel title="Messaging credentials" description="Per-organisation providers">
                {Object.keys(d.credentials).length ? Object.entries(d.credentials).map(([prov, counts]) => (
                  <div key={prov} className="mb-3 last:mb-0"><p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">{prov}</p><StatusList data={counts} /></div>
                )) : <p className="text-[13px] text-muted-foreground">No organisation credentials saved.</p>}
              </Panel>
              <Panel title="Failed deliveries (7 days)">
                <StatusList data={Object.fromEntries(Object.entries(d.failed_deliveries_7d).map(([k, v]) => [k, v]))} empty="No failed deliveries this week." plain />
              </Panel>
            </div>
            <Panel title="Recent integration errors" flush>
              <ul className="divide-y divide-border">
                {d.recent_errors.map((e, i) => (
                  <li key={i} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0"><span className="font-medium text-foreground">{e.organization_name}</span> <span className="font-mono text-[11.5px] text-subtle-foreground">· {e.provider}</span><span className="block truncate text-[12px] text-danger-foreground">{e.error}</span></span>
                    <span className="flex items-center gap-2"><StatusPill status={e.status} /><span className="text-[11.5px] text-subtle-foreground">{relTime(e.at)}</span></span>
                  </li>
                ))}
                {!d.recent_errors.length && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No integration errors recorded.</li>}
              </ul>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}

function StatusList({ data, empty, plain }: { data: Record<string, number>; empty?: string; plain?: boolean }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between text-[13px]">
          {plain ? <span className="text-foreground-soft">{titleCase(k)}</span> : <StatusPill status={k} />}
          <span className="font-mono text-foreground">{v}</span>
        </li>
      ))}
    </ul>
  );
}
