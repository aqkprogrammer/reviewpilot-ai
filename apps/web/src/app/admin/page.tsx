"use client";
import * as React from "react";
import { ReputationIntelligenceCore } from "@/components/intelligence";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bot, Building2, CircleCheck, CreditCard, Flag, IndianRupee, LifeBuoy, Megaphone, MessageSquareText, Receipt, RefreshCw, ScrollText, Send, Users, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/tech";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { AnnouncementDialog } from "@/components/admin/announcement-dialog";
import { AreaTrend, BarTrend, C, ChartLegend, Donut, Sparkline } from "@/components/admin/charts";
import { DemoTag, EmptyLine, HoloPanel, Kpi, KpiGrid, Notice, Panel, SystemStatusChip, systemStatus, QueryState, SectionHeader, StackedMeter, StatusPill, money, moneyCompact, relTime, stamp, useAdmin, type AdminPage, type Tone } from "@/components/admin/ui";

interface Overview {
  totals: {
    users: number; organizations: number; active_organizations: number; trial_accounts: number; paid_subscriptions: number; mrr_minor: number; arr_minor: number;
    reviews_google: number; reviews_demo: number; campaigns_sent: number; ai_requests: number; failed_jobs_24h: number;
  };
  registrations: { week: string; users: number }[];
  organization_growth: { month: string; organizations: number }[];
  subscription_growth: { month: string; subscriptions: number }[];
  monthly_revenue: { month: string; revenue_minor: number }[];
  plan_distribution: { code: string; name: string; count: number }[];
  churn: { month: string; churned: number }[];
  subscription_status: Record<string, number>;
  demo_mode: boolean;
}
interface Health {
  api: { status: string; environment: string; demo_mode: boolean };
  database: { status: string; latency_ms?: number; error?: string };
  redis: { status: string; latency_ms?: number; note?: string; error?: string };
  worker: { status: string; last_heartbeat?: string | null };
  queue_backlog: number;
  jobs?: { queued: number; running: number; failed_24h: number; succeeded_24h: number };
  integration_errors?: { google: number; messaging: number };
}
interface PayRow { id: string; organization_id: string; organization_name: string; provider: string; amount_minor: number; status: string; plan_code: string | null; created_at: string; paid_at: string | null; simulated: boolean; failure_reason: string | null }
interface LogRow { id: string; seq: number; created_at: string; actor_email: string | null; actor_type: string; organization_name: string | null; action: string; target_type: string | null }

interface AIBrief { configured: boolean; model: string; period: string; totals: { requests: number; failed: number }; by_kind: Record<string, number> }

type Alert = { id: string; tone: "error" | "warn" | "signal"; title: string; detail: string; count?: number; href: string };

const SUB_TONES: Record<string, Tone> = { active: "success", trialing: "ice", grace_period: "amber", past_due: "warning", canceled: "danger", expired: "neutral" };

export default function CommandCenter() {
  const qc = useQueryClient();
  const ov = useAdmin<Overview>("/overview");
  const health = useAdmin<Health>("/system-health", undefined, { staleTime: 15_000, refetchInterval: 60_000 });
  const payments = useAdmin<AdminPage<PayRow> & { summary: { collected_minor: number; failed: number; total: number } }>("/payments", { page: 1, page_size: 6 });
  const audit = useAdmin<AdminPage<LogRow>>("/audit-logs", { page: 1, page_size: 8 });
  const tickets = useAdmin<AdminPage<unknown> & { counts: Record<string, number> }>("/support/tickets", { page_size: 1, status: "open", priority: "urgent" });
  const suspended = useAdmin<AdminPage<unknown>>("/organizations", { page_size: 1, status: "suspended" });
  const ai = useAdmin<AIBrief>("/ai-usage");
  const [announce, setAnnounce] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const d = ov.data;
  const h = health.data;
  const urgent = tickets.data?.total ?? 0;
  const openTickets = tickets.data?.counts?.open ?? 0;
  const failedPayments = payments.data?.summary.failed ?? 0;
  const integrationErrors = (h?.integration_errors?.google ?? 0) + (h?.integration_errors?.messaging ?? 0);
  const grace = d?.subscription_status.grace_period ?? 0;
  const pastDue = d?.subscription_status.past_due ?? 0;

  const alerts: Alert[] = [];
  if (h && h.database.status !== "ok") alerts.push({ id: "db", tone: "error", title: "Database unreachable", detail: h.database.error ?? "Probe failed", href: "/admin/system-health" });
  if (d?.totals.failed_jobs_24h) alerts.push({ id: "jobs", tone: "error", title: "Background jobs failing", detail: "Failed in the last 24 hours", count: d.totals.failed_jobs_24h, href: "/admin/system-health" });
  if (urgent) alerts.push({ id: "urgent", tone: "error", title: "Urgent tickets open", detail: "Customers waiting on an urgent issue", count: urgent, href: "/admin/support?priority=urgent" });
  if (failedPayments) alerts.push({ id: "pay", tone: "warn", title: "Failed payments", detail: "Charges declined by the provider (all time)", count: failedPayments, href: "/admin/payments?status=failed" });
  if (grace) alerts.push({ id: "grace", tone: "warn", title: "Organizations in grace period", detail: "Paid access ends unless payment recovers", count: grace, href: "/admin/subscriptions?status=grace_period" });
  if (pastDue) alerts.push({ id: "pastdue", tone: "warn", title: "Past-due subscriptions", detail: "Awaiting a successful retry", count: pastDue, href: "/admin/subscriptions?status=past_due" });
  if (integrationErrors) alerts.push({ id: "int", tone: "warn", title: "Integration errors", detail: `${h?.integration_errors?.google ?? 0} Google · ${h?.integration_errors?.messaging ?? 0} messaging`, count: integrationErrors, href: "/admin/integrations" });
  if (h && h.worker.status !== "ok") alerts.push({ id: "worker", tone: "warn", title: h.worker.status === "inline" ? "Jobs running inline" : "Worker not reporting", detail: h.redis.note ?? `Redis ${h.redis.status.replace(/_/g, " ")} · worker ${h.worker.status.replace(/_/g, " ")}`, href: "/admin/system-health" });
  if (h && h.queue_backlog > 100) alerts.push({ id: "queue", tone: "warn", title: "Queue backlog high", detail: "Jobs waiting for a worker", count: h.queue_backlog, href: "/admin/system-health" });
  if (suspended.data?.total) alerts.push({ id: "susp", tone: "signal", title: "Suspended organizations", detail: "Members currently locked out", count: suspended.data.total, href: "/admin/organizations?status=suspended" });

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["admin"] });
    setRefreshing(false);
  };

  const growth = d ? d.organization_growth.map((o, i) => ({ month: o.month, organizations: o.organizations, subscriptions: d.subscription_growth[i]?.subscriptions ?? 0 })) : [];
  const collected12 = d?.monthly_revenue.reduce((a, m) => a + m.revenue_minor, 0) ?? 0;
  const bestMonth = d?.monthly_revenue.reduce((a, m) => (m.revenue_minor > a.revenue_minor ? m : a), { month: "", revenue_minor: 0 });
  const churned12 = d?.churn.reduce((a, m) => a + m.churned, 0) ?? 0;
  const regs12 = d?.registrations.reduce((a, r) => a + r.users, 0) ?? 0;
  const plansTotal = d?.plan_distribution.reduce((a, p) => a + p.count, 0) ?? 0;

  return (
    <>
      <SectionHeader
        eyebrow="Platform"
        title="Command center"
        description="Tenants, revenue, delivery and infrastructure across the whole platform — every figure is read live from the database."
        actions={
          <>
            <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground md:inline" aria-live="polite">
              Synced {ov.dataUpdatedAt ? stamp(new Date(ov.dataUpdatedAt).toISOString()) : "—"}
            </span>
            <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>{!refreshing && <RefreshCw />} Refresh</Button>
          </>
        }
      />
      <QueryState query={ov}>
        {d && (
          <div className="space-y-4">
            {d.demo_mode && (
              <Notice icon={AlertTriangle}>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-amber">Demo mode</span> — figures include seeded sample organizations and simulated (mock) payments. They are real rows, not live customers.
              </Notice>
            )}

            {/* KPI matrix + operational alerts */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <KpiGrid className="grid-cols-2 md:grid-cols-4">
                <Kpi label="Users" value={d.totals.users} icon={Users} tone="ice" sub={`+${formatNumber(regs12)} in 12 wks`} href="/admin/users" />
                <Kpi label="Organizations" value={d.totals.organizations} icon={Building2} tone="ice" sub={`${suspended.data?.total ?? 0} suspended`} href="/admin/organizations" />
                <Kpi label="Active orgs" value={d.totals.active_organizations} icon={CircleCheck} tone="success" sub={d.totals.organizations ? `${Math.round((d.totals.active_organizations / d.totals.organizations) * 100)}% of tenants` : "—"} href="/admin/organizations?status=active" />
                <Kpi label="Trials" value={d.totals.trial_accounts} icon={Receipt} tone="cyan" sub="Trialing subscriptions" href="/admin/subscriptions?status=trialing" />
                <Kpi label="Paid subs" value={d.totals.paid_subscriptions} icon={CreditCard} tone="mint" sub={`${grace} grace · ${pastDue} past due`} href="/admin/subscriptions?status=active" />
                <Kpi label="MRR" value={d.totals.mrr_minor} format={moneyCompact} icon={IndianRupee} tone="signal" sub="Normalised monthly" href="/admin/revenue">
                  <Sparkline data={d.monthly_revenue.map((m) => m.revenue_minor)} className="mt-2" height={22} />
                </Kpi>
                <Kpi label="ARR" value={d.totals.arr_minor} format={moneyCompact} icon={IndianRupee} tone="signal" sub="MRR × 12" href="/admin/revenue" />
                <Kpi label="Reviews synced" value={d.totals.reviews_google + d.totals.reviews_demo} icon={MessageSquareText} tone="cyan" sub={`${formatNumber(d.totals.reviews_google)} google · ${formatNumber(d.totals.reviews_demo)} demo`}>
                  <SplitBar a={d.totals.reviews_google} b={d.totals.reviews_demo} />
                </Kpi>
                <Kpi label="Campaign sends" value={d.totals.campaigns_sent} icon={Send} tone="ice" sub="Review requests sent" href="/admin/campaigns" />
                <Kpi label="AI requests" value={d.totals.ai_requests} icon={Bot} tone="mint" sub="Metered · all time" href="/admin/ai-usage" />
                <Kpi label="Failed jobs · 24h" value={d.totals.failed_jobs_24h} icon={Workflow} tone={d.totals.failed_jobs_24h ? "danger" : "success"} alert={!!d.totals.failed_jobs_24h} sub={d.totals.failed_jobs_24h ? "Investigate in health" : "No failures"} href="/admin/system-health" />
                <Kpi label="Open tickets" value={openTickets} icon={LifeBuoy} tone={urgent ? "danger" : "amber"} alert={!!urgent} sub={`${urgent} urgent`} href="/admin/support" loading={tickets.isLoading} />
              </KpiGrid>

              <Panel title="Operational alerts" description="Derived from live data" meta={health.isLoading ? "…" : `${alerts.length} active`} flush>
                {health.isLoading || payments.isLoading ? (
                  <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
                ) : alerts.length ? (
                  <ul className="divide-y divide-border">
                    {alerts.map((a) => (
                      <li key={a.id}>
                        <Link href={a.href} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover/60">
                          <StatusDot tone={a.tone} pulse={a.tone === "error"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-foreground">{a.title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{a.detail}</span>
                          </span>
                          {a.count != null && <span className={cn("font-mono text-[15px] font-semibold tabular", a.tone === "error" ? "text-danger" : a.tone === "warn" ? "text-amber" : "text-primary")}>{a.count}</span>}
                          <ArrowUpRight className="size-3.5 text-subtle-foreground opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <StatusDot tone="live" pulse />
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mint">All systems nominal</p>
                    <p className="text-[12px] text-muted-foreground">No failed jobs, payments, integration errors or urgent tickets.</p>
                  </div>
                )}
              </Panel>
            </div>

            <IntelligencePipeline d={d} h={h} ai={ai.data} />

            {/* Revenue + subscription analytics */}
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel className="xl:col-span-2" title="Collected revenue" description="Succeeded payments per month · INR" meta="12 months" actions={<Button variant="ghost" size="xs" asChild><Link href="/admin/revenue">Analytics <ArrowRight /></Link></Button>}>
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                  <Readout label="MRR" value={money(d.totals.mrr_minor)} accent />
                  <Readout label="ARR" value={money(d.totals.arr_minor, { compact: true })} />
                  <Readout label="Collected · 12 mo" value={money(collected12, { compact: true })} />
                  <Readout label="Best month" value={bestMonth?.revenue_minor ? `${money(bestMonth.revenue_minor, { compact: true })}` : "—"} sub={bestMonth?.revenue_minor ? new Date(`${bestMonth.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase() : undefined} />
                </div>
                <AreaTrend data={d.monthly_revenue} x="month" series={[{ key: "revenue_minor", name: "Collected", color: C.ice }]} format={moneyCompact} height={232} />
              </Panel>
              <Panel title="Subscription analytics" description="Lifecycle and plan mix" meta={`${Object.values(d.subscription_status).reduce((a, b) => a + b, 0)} subs`}>
                <p className="micro-label mb-2">Lifecycle</p>
                <StackedMeter
                  segments={["active", "trialing", "grace_period", "past_due", "canceled", "expired"].map((s) => ({ label: titleCase(s === "grace_period" ? "grace" : s), value: d.subscription_status[s] ?? 0, tone: SUB_TONES[s], href: `/admin/subscriptions?status=${s}` }))}
                />
                <div className="my-4 h-px bg-border" />
                <p className="micro-label mb-3">Plan mix</p>
                <Donut
                  size={118}
                  data={d.plan_distribution.map((p) => ({ name: p.name, value: p.count }))}
                  center={<><span className="text-[20px] font-semibold tabular tracking-[-0.03em]">{plansTotal}</span><span className="micro-label text-[9px]">subs</span></>}
                />
                <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-background-subtle px-3 py-2">
                  <span className="micro-label">Churned · 12 mo</span>
                  <span className="flex items-center gap-3">
                    <Sparkline data={d.churn.map((c) => c.churned)} color={C.danger} height={18} className="w-20" />
                    <span className="font-mono text-[13px] tabular text-foreground">{churned12}</span>
                  </span>
                </div>
              </Panel>
            </div>

            {/* Growth + health */}
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="User registrations" description="New accounts per week" meta="12 weeks">
                <BarTrend data={fillWeeks(d.registrations)} x="week" series={[{ key: "users", name: "Registrations", color: C.cyan }]} height={200} />
              </Panel>
              <Panel title="Tenant growth" description="Cumulative organizations & subscriptions" actions={<ChartLegend items={[{ label: "Orgs", color: C.ice }, { label: "Subs", color: C.mint }]} />}>
                <AreaTrend data={growth} x="month" series={[{ key: "organizations", name: "Organizations", color: C.ice }, { key: "subscriptions", name: "Subscriptions", color: C.mint }]} height={200} yWidth={36} />
              </Panel>
              <HealthPanel h={h} loading={health.isLoading} />
            </div>

            {/* Transactions, activity, actions */}
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
              <Panel title="Recent transactions" description="Latest payment events from provider webhooks" meta={payments.data ? `${formatNumber(payments.data.summary.total)} total` : undefined} flush actions={<Button variant="ghost" size="xs" asChild><Link href="/admin/payments">All <ArrowRight /></Link></Button>}>
                {payments.isLoading ? <ListSkeleton /> : payments.data?.items.length ? (
                  <ul className="divide-y divide-border">
                    {payments.data.items.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border", p.status === "succeeded" ? "border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-success-soft text-success" : p.status === "failed" ? "border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-danger-soft text-danger" : "border-border bg-muted text-muted-foreground")}>
                          <CreditCard className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <Link href={`/admin/organizations/${p.organization_id}`} className="block truncate text-[12.5px] font-medium text-foreground hover:text-primary">{p.organization_name}</Link>
                          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground">{p.provider}{p.plan_code ? ` · ${p.plan_code}` : ""} <DemoTag show={p.simulated} label="Sim" /></span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-[12.5px] tabular text-foreground">{money(p.amount_minor)}</span>
                          <span className="block font-mono text-[10.5px] text-subtle-foreground">{relTime(p.paid_at ?? p.created_at)}</span>
                        </span>
                        <StatusPill status={p.status} className="hidden sm:inline-flex" />
                      </li>
                    ))}
                  </ul>
                ) : <EmptyLine>No payments recorded</EmptyLine>}
              </Panel>
              <Panel title="Recent activity" description="Append-only audit stream" meta={audit.data ? `#${audit.data.items[0]?.seq ?? 0}` : undefined} flush actions={<Button variant="ghost" size="xs" asChild><Link href="/admin/audit-logs">Logs <ArrowRight /></Link></Button>}>
                {audit.isLoading ? <ListSkeleton /> : audit.data?.items.length ? (
                  <ol className="relative divide-y divide-border">
                    {audit.data.items.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 px-4 py-2">
                        <span className="mt-1.5 font-mono text-[10px] tabular text-subtle-foreground">{String(a.seq).padStart(4, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <code className={cn("block truncate font-mono text-[11.5px]", a.action.startsWith("admin.") ? "text-amber" : "text-primary")}>{a.action}</code>
                          <span className="block truncate text-[11px] text-muted-foreground">{a.actor_email ?? a.actor_type}{a.organization_name ? ` · ${a.organization_name}` : ""}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-subtle-foreground">{relTime(a.created_at)}</span>
                      </li>
                    ))}
                  </ol>
                ) : <EmptyLine>No audit entries</EmptyLine>}
              </Panel>
              <Panel title="Quick actions" description="Common administrative tasks" flush>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <QuickAction icon={Megaphone} label="New announcement" onClick={() => setAnnounce(true)} accent />
                  <QuickAction icon={Receipt} label="Grace periods" href="/admin/subscriptions?status=grace_period" count={grace} />
                  <QuickAction icon={CreditCard} label="Failed payments" href="/admin/payments?status=failed" count={failedPayments} />
                  <QuickAction icon={LifeBuoy} label="Support queue" href="/admin/support" count={openTickets} />
                  <QuickAction icon={Flag} label="Feature flags" href="/admin/feature-flags" />
                  <QuickAction icon={ScrollText} label="My audit trail" href="/admin/audit-logs?mine=1" />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </QueryState>
      <AnnouncementDialog open={announce} onOpenChange={setAnnounce} />
    </>
  );
}

/** Pads the weekly series with the weeks that had zero sign-ups (API omits empty buckets). */
function fillWeeks(rows: { week: string; users: number }[]) {
  const map = new Map(rows.map((r) => [r.week, r.users]));
  const now = new Date();
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const keys = Array.from({ length: 12 }, (_, i) => new Date(monday - (11 - i) * 7 * 86_400_000).toISOString().slice(0, 10));
  for (const k of map.keys()) if (!keys.includes(k)) keys.push(k);
  return keys.sort().slice(-12).map((week) => ({ week, users: map.get(week) ?? 0 }));
}

function Readout({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-background-subtle px-3 py-2.5">
      <p className="micro-label text-[9.5px]">{label}</p>
      <p className={cn("mt-1 font-mono text-[14px] font-medium tabular", accent ? "text-primary" : "text-foreground")}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-subtle-foreground">{sub}</p>}
    </div>
  );
}

function SplitBar({ a, b }: { a: number; b: number }) {
  const t = a + b;
  return (
    <div className="mt-2 flex h-1 w-full gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label={`${a} Google, ${b} demo`}>
      {t > 0 && a > 0 && <div className="h-full bg-cyan" style={{ width: `${(a / t) * 100}%` }} />}
      {t > 0 && b > 0 && <div className="h-full bg-amber/70" style={{ width: `${(b / t) * 100}%` }} />}
    </div>
  );
}

function ListSkeleton() {
  return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>;
}

function QuickAction({ icon: Icon, label, href, onClick, count, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; href?: string; onClick?: () => void; count?: number; accent?: boolean }) {
  const inner = (
    <>
      <span className="flex items-center justify-between">
        <Icon className={cn("size-4", accent ? "text-primary" : "text-subtle-foreground group-hover:text-foreground-soft")} />
        {!!count && <span className="font-mono text-[11px] tabular text-amber">{count}</span>}
      </span>
      <span className="mt-3 block text-[12.5px] font-medium text-foreground-soft group-hover:text-foreground">{label}</span>
    </>
  );
  const cls = "group block bg-card px-4 py-3.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cn(cls, "w-full")}>{inner}</button>;
}

function HealthPanel({ h, loading }: { h?: Health; loading: boolean }) {
  const rows = h ? [
    { name: "API", status: h.api.status, detail: h.api.environment },
    { name: "PostgreSQL", status: h.database.status, detail: h.database.latency_ms != null ? `${h.database.latency_ms} ms` : h.database.error ?? "—" },
    { name: "Redis", status: h.redis.status, detail: h.redis.latency_ms != null ? `${h.redis.latency_ms} ms` : h.redis.status === "unavailable" ? "inline fallback" : "—" },
    { name: "Worker", status: h.worker.status, detail: h.worker.last_heartbeat ? relTime(h.worker.last_heartbeat) : h.worker.status === "inline" ? "in-process" : "—" },
  ] : [];
  const dot = (s: string) => (s === "ok" ? "ok" : s === "down" ? "error" : "warn") as "ok" | "error" | "warn";
  return (
    <Panel title="System health" description="Live infrastructure probes" meta="60s" flush actions={<Button variant="ghost" size="xs" asChild><Link href="/admin/system-health">Details <ArrowRight /></Link></Button>}>
      {loading || !h ? <ListSkeleton /> : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-3 px-4 py-2.5">
                <StatusDot tone={dot(r.status)} pulse={r.status === "ok"} label={`${r.name} ${r.status}`} />
                <span className="flex-1 text-[12.5px] text-foreground">{r.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.detail}</span>
                <StatusPill status={r.status} dot={false} />
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
            <Cell label="Backlog" value={h.queue_backlog} />
            <Cell label="Running" value={h.jobs?.running ?? 0} />
            <Cell label="Failed 24h" value={h.jobs?.failed_24h ?? 0} danger={!!h.jobs?.failed_24h} />
          </div>
        </>
      )}
    </Panel>
  );
}

function Cell({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-card px-4 py-2.5">
      <p className="micro-label text-[9.5px]">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[15px] tabular", danger ? "text-danger" : "text-foreground")}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ platform intelligence */

/** The real processing pipeline (signals → intelligence → insights), counted from admin endpoints. */
function IntelligencePipeline({ d, h, ai }: { d: Overview; h?: Health; ai?: AIBrief }) {
  const reviews = d.totals.reviews_google + d.totals.reviews_demo;
  const sentiment = ai?.by_kind.sentiment ?? 0;
  const replies = (ai?.by_kind.reply ?? 0) + (ai?.by_kind.template ?? 0);
  const status = systemStatus(h);
  const subsystems = h ? [
    { k: "API", s: h.api.status }, { k: "DB", s: h.database.status }, { k: "REDIS", s: h.redis.status }, { k: "WORKER", s: h.worker.status },
  ] : [];
  const stages = [
    {
      code: "01", label: "Review ingestion", value: reviews, icon: MessageSquareText,
      detail: `${formatNumber(d.totals.reviews_google)} google · ${formatNumber(d.totals.reviews_demo)} demo`,
      split: [{ v: d.totals.reviews_google, c: "bg-cyan" }, { v: d.totals.reviews_demo, c: "bg-amber/70" }],
      foot: `${formatNumber(d.totals.campaigns_sent)} requests dispatched`,
    },
    {
      code: "02", label: "Sentiment analysis", value: ai ? sentiment : null, icon: Activity,
      detail: ai ? (ai.configured ? `model ${ai.model}` : "offline heuristic engine") : "—",
      split: null,
      foot: ai ? `${formatNumber(ai.totals.requests)} AI requests · ${ai.period}` : "—",
    },
    {
      code: "03", label: "Response generation", value: ai ? replies : null, icon: Bot,
      detail: ai ? `${ai.by_kind.reply ?? 0} replies · ${ai.by_kind.template ?? 0} templates` : "—",
      split: ai ? [{ v: ai.by_kind.reply ?? 0, c: "bg-primary" }, { v: ai.by_kind.template ?? 0, c: "bg-mint" }] : null,
      foot: ai ? `${ai.totals.failed} failed this month` : "—",
      warn: !!ai?.totals.failed,
    },
  ];
  return (
    <HoloPanel
      label="Platform intelligence"
      title="Signals → intelligence → insights"
      meta="All-time generations · live counts"
      actions={<SystemStatusChip h={h} />}
    >
      <div className="grid gap-px bg-[color-mix(in_oklab,var(--primary)_10%,var(--border))] lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Core readout */}
        <div className="flex flex-col justify-between gap-4 bg-[color-mix(in_oklab,var(--card)_60%,transparent)] p-4">
          <ReputationIntelligenceCore detail="lite" className="mx-auto w-[150px]" title={`Platform intelligence core — ${status.label}`} />
          <div>
            <p className="micro-label">Core state</p>
            <p className={cn("mt-1.5 font-mono text-[15px] uppercase tracking-[0.12em]", status.tone === "live" ? "text-mint" : status.tone === "error" ? "text-danger-foreground" : status.tone === "warn" ? "text-amber" : "text-subtle-foreground")}>{status.label}</p>
            <p className="mt-1 truncate font-mono text-[10.5px] text-subtle-foreground" title={status.detail}>{status.detail}</p>
          </div>
          <ul className="grid grid-cols-2 gap-1.5">
            {subsystems.map((x) => (
              <li key={x.k} className="flex items-center gap-1.5 rounded-[4px] border border-border bg-background-subtle/70 px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] text-muted-foreground">
                <StatusDot tone={x.s === "ok" ? "ok" : x.s === "down" ? "error" : "warn"} label={`${x.k} ${x.s}`} />{x.k}
              </li>
            ))}
          </ul>
        </div>
        {/* Pipeline stages */}
        <ol className="grid gap-px bg-[color-mix(in_oklab,var(--primary)_10%,var(--border))] md:grid-cols-3" aria-label="Processing pipeline">
          {stages.map((st, i) => {
            const total = st.split?.reduce((a, x) => a + x.v, 0) ?? 0;
            const Icon = st.icon;
            return (
              <li key={st.code} className="relative bg-[color-mix(in_oklab,var(--card)_60%,transparent)] px-4 py-4">
                {i < stages.length - 1 && (
                  <span aria-hidden className="absolute -right-[9px] top-1/2 z-10 hidden size-[17px] -translate-y-1/2 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-background md:flex">
                    <ArrowRight className="size-2.5 text-primary" />
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{st.code} · {st.label}</span>
                  <Icon className="size-3.5 text-subtle-foreground" />
                </div>
                <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.035em] tabular text-foreground">
                  {st.value == null ? <Skeleton className="h-7 w-16" /> : formatNumber(st.value)}
                </p>
                <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{st.detail}</p>
                <div className="mt-3 flex h-1 w-full gap-[2px] overflow-hidden rounded-full bg-muted" aria-hidden>
                  {st.split && total > 0 ? st.split.filter((x) => x.v > 0).map((x, j) => <div key={j} className={cn("h-full", x.c)} style={{ width: `${(x.v / total) * 100}%` }} />) : st.value ? <div className="h-full w-full bg-primary/70" /> : null}
                </div>
                <p className={cn("mt-2.5 border-t border-border pt-2 font-mono text-[10.5px] uppercase tracking-[0.08em]", "warn" in st && st.warn ? "text-amber" : "text-subtle-foreground")}>{st.foot}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-[color-mix(in_oklab,var(--primary)_14%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_10%,var(--border))] sm:grid-cols-4">
        {[
          ["Campaign sends", formatNumber(d.totals.campaigns_sent), false],
          ["AI requests · all time", formatNumber(d.totals.ai_requests), false],
          ["Failed jobs · 24h", formatNumber(d.totals.failed_jobs_24h), d.totals.failed_jobs_24h > 0],
          ["Queue backlog", h ? formatNumber(h.queue_backlog) : "—", (h?.queue_backlog ?? 0) > 100],
        ].map(([k, v, bad]) => (
          <div key={k as string} className="flex items-center justify-between gap-2 bg-[color-mix(in_oklab,var(--card)_60%,transparent)] px-4 py-2">
            <span className="micro-label text-[9.5px]">{k}</span>
            <span className={cn("font-mono text-[12.5px] tabular", bad ? "text-danger" : "text-foreground")}>{v}</span>
          </div>
        ))}
      </div>
    </HoloPanel>
  );
}
