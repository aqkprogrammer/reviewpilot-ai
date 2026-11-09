"use client";
import * as React from "react";
import { AlertTriangle, Boxes, CircleDashed, KeyRound, Mail, MessageSquare, Plug, Send } from "lucide-react";
import { GoogleIcon, OpenAIIcon, RazorpayIcon, StripeIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { StatusDot } from "@/components/ui/tech";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { RankBars, C } from "@/components/admin/charts";
import { DataTable, Row, SearchInput, Td, Th, Toolbar } from "@/components/admin/table";
import { EmptyLine, Kpi, KpiGrid, Notice, Panel, QueryState, SectionHeader, StackedMeter, StatusPill, stamp, useAdmin, type Tone } from "@/components/admin/ui";

interface Integrations {
  platform: Record<string, boolean>;
  google_connections: Record<string, number>;
  credentials: Record<string, Record<string, number>>;
  failed_deliveries_7d: Record<string, number>;
  recent_errors: { provider: string; organization_name: string; status: string; error: string | null; at: string | null }[];
}

const PROVIDERS: { key: string; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "google_oauth", name: "Google OAuth & GBP", desc: "Sign-in, review sync, reply publishing", icon: GoogleIcon },
  { key: "whatsapp_platform", name: "WhatsApp Cloud API", desc: "Platform sender fallback", icon: WhatsAppIcon },
  { key: "openai", name: "OpenAI", desc: "AI replies, sentiment, insights", icon: OpenAIIcon },
  { key: "razorpay", name: "Razorpay", desc: "INR subscriptions + webhooks", icon: RazorpayIcon },
  { key: "stripe", name: "Stripe", desc: "International subscriptions", icon: StripeIcon },
  { key: "resend", name: "Resend", desc: "Transactional + request email", icon: Mail },
  { key: "twilio", name: "Twilio SMS", desc: "SMS provider adapter", icon: MessageSquare },
  { key: "s3", name: "S3 storage", desc: "Logos and uploads", icon: Boxes },
];
const STATUS_TONE: Record<string, Tone> = { connected: "success", active: "success", pending_authorization: "amber", token_expired: "warning", error: "danger", disconnected: "neutral", not_connected: "neutral" };

export default function IntegrationsPage() {
  const q = useAdmin<Integrations>("/integrations");
  const d = q.data;
  const [search, setSearch] = React.useState("");
  const configured = d ? PROVIDERS.filter((p) => d.platform[p.key]).length : 0;
  const gTotal = d ? Object.values(d.google_connections).reduce((a, b) => a + b, 0) : 0;
  const credTotal = d ? Object.values(d.credentials).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0) : 0;
  const failed7 = d ? Object.values(d.failed_deliveries_7d).reduce((a, b) => a + b, 0) : 0;
  const errors = (d?.recent_errors ?? []).filter((e) => !search || `${e.organization_name} ${e.provider} ${e.error ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <SectionHeader title="Integrations" description="Platform credentials (environment variables — values are never shown) and the health of every organization's connections." />
      <QueryState query={q}>
        {d && (
          <div className="space-y-4">
            {d.platform.demo_mode && <Notice icon={AlertTriangle}>Demo mode: unconfigured channels fall back to clearly-labelled mock adapters.</Notice>}
            <KpiGrid className="grid-cols-2 lg:grid-cols-5">
              <Kpi label="Platform providers" display={`${configured}/${PROVIDERS.length}`} icon={KeyRound} tone="signal" sub="Configured in env" />
              <Kpi label="Google connections" value={gTotal} icon={Plug} tone="ice" sub={`${d.google_connections.connected ?? 0} connected`} />
              <Kpi label="Messaging creds" value={credTotal} icon={Send} tone="cyan" sub={`${Object.keys(d.credentials).length} providers`} />
              <Kpi label="Failed deliveries · 7d" value={failed7} icon={AlertTriangle} tone={failed7 ? "danger" : "success"} alert={!!failed7} sub="Across all channels" />
              <Kpi label="Connection errors" value={d.recent_errors.length} icon={AlertTriangle} tone={d.recent_errors.length ? "warning" : "success"} alert={!!d.recent_errors.length} sub="Latest 15 shown" />
            </KpiGrid>

            <Panel title="Provider matrix" description="Platform-level credentials read from the deployment environment" meta={`${configured} configured`} flush>
              <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
                {PROVIDERS.map((p) => {
                  const on = !!d.platform[p.key];
                  const Icon = p.icon;
                  return (
                    <div key={p.key} className="flex items-start gap-3 bg-card px-4 py-3.5">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background-subtle", on ? "border-[color-mix(in_oklab,var(--success)_30%,transparent)]" : "border-border")}>
                        {Icon ? <Icon className={cn("size-[18px]", !on && "opacity-50 grayscale")} /> : <CircleDashed className="size-4 text-subtle-foreground" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{p.desc}</p>
                        <p className={cn("mt-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]", on ? "text-success" : "text-subtle-foreground")}>
                          <StatusDot tone={on ? "ok" : "idle"} /> {on ? "Configured" : "Not set"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Google Business Profile" description="Organization connections by status" meta={`${gTotal} total`}>
                {gTotal ? (
                  <StackedMeter segments={Object.entries(d.google_connections).map(([k, v]) => ({ label: titleCase(k), value: v, tone: STATUS_TONE[k] ?? "neutral" }))} />
                ) : <EmptyLine>No organization has connected Google</EmptyLine>}
              </Panel>
              <Panel title="Messaging credentials" description="Per-organization providers">
                {Object.keys(d.credentials).length ? (
                  <div className="space-y-4">
                    {Object.entries(d.credentials).map(([prov, counts]) => (
                      <div key={prov}>
                        <p className="micro-label mb-2">{prov}</p>
                        <StackedMeter segments={Object.entries(counts).map(([k, v]) => ({ label: titleCase(k), value: v, tone: STATUS_TONE[k] ?? "neutral" }))} />
                      </div>
                    ))}
                  </div>
                ) : <EmptyLine>No organization credentials saved</EmptyLine>}
              </Panel>
              <Panel title="Failed deliveries" description="By channel · last 7 days" meta={formatNumber(failed7)}>
                {failed7 ? <RankBars data={Object.entries(d.failed_deliveries_7d).map(([k, v]) => ({ name: titleCase(k), value: v }))} color={C.danger} /> : <EmptyLine>No failed deliveries this week</EmptyLine>}
              </Panel>
            </div>

            <Panel title="Recent integration errors" description="Latest error per connection, newest first" flush>
              <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Filter by organization, provider or error" /></Toolbar>
              <DataTable colSpan={5} minWidth={760} empty={!errors.length ? <EmptyLine>No integration errors recorded</EmptyLine> : false} caption="Integration errors" head={<><Th>When</Th><Th>Organization</Th><Th>Provider</Th><Th>Status</Th><Th>Error</Th></>}>
                {errors.map((e, i) => (
                  <Row key={i}>
                    <Td className="whitespace-nowrap font-mono text-[11px]">{stamp(e.at, false)}</Td>
                    <Td className="font-medium text-foreground">{e.organization_name}</Td>
                    <Td className="font-mono text-[11px] uppercase">{e.provider}</Td>
                    <Td><StatusPill status={e.status} /></Td>
                    <Td className="max-w-[420px] truncate text-[12px] text-danger-foreground">{e.error}</Td>
                  </Row>
                ))}
              </DataTable>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
