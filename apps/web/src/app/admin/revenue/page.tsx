"use client";
import * as React from "react";
import { AlertTriangle, CalendarClock, IndianRupee, Percent, TrendingDown, Users } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import { AreaTrend, BarTrend, C, ChartLegend } from "@/components/admin/charts";
import { EmptyLine, Kpi, KpiGrid, Meter, Notice, Panel, QueryState, SectionHeader, money, moneyCompact, relTime, toneBg, useAdmin, type Tone } from "@/components/admin/ui";

interface Revenue {
  mrr_minor: number; arr_minor: number; paying_customers: number; arpa_minor: number; monthly_churn_rate: number; trial_conversion_rate: number | null; ltv_estimate_minor: number | null;
  revenue_by_plan: { code: string; name: string; mrr_minor: number }[]; monthly: { month: string; revenue_minor: number; payments: number; failed: number; failed_minor: number }[];
  failed_payments: { id: string; organization_name: string; amount_minor: number; failure_reason: string | null; created_at: string }[]; definitions: Record<string, string>; includes_simulated: boolean;
}
const PLAN_TONES: Tone[] = ["signal", "cyan", "mint", "amber", "neutral"];

export default function RevenuePage() {
  const q = useAdmin<Revenue>("/revenue");
  const d = q.data;
  const totalPlan = Math.max(1, d?.revenue_by_plan.reduce((a, p) => a + p.mrr_minor, 0) ?? 1);
  const collected = d?.monthly.reduce((a, m) => a + m.revenue_minor, 0) ?? 0;
  const failedMinor = d?.monthly.reduce((a, m) => a + m.failed_minor, 0) ?? 0;
  const failedCount = d?.monthly.reduce((a, m) => a + m.failed, 0) ?? 0;
  const okCount = d?.monthly.reduce((a, m) => a + m.payments, 0) ?? 0;
  const recovery = okCount + failedCount ? okCount / (okCount + failedCount) : null;
  return (
    <>
      <SectionHeader title="Revenue analytics" description="Recurring revenue, retention and collection health. Estimates are labelled and defined at the bottom of the page." meta="Trailing 12 months" />
      <QueryState query={q}>
        {d && (
          <div className="space-y-4">
            {d.includes_simulated && <Notice icon={AlertTriangle}>Includes simulated (mock) payments from demo mode — no money moved for those rows.</Notice>}
            <KpiGrid className="grid-cols-2 md:grid-cols-4">
              <Kpi label="MRR" value={d.mrr_minor} format={(n) => money(n)} icon={IndianRupee} tone="signal" sub={`ARR ${money(d.arr_minor)}`} />
              <Kpi label="Paying customers" value={d.paying_customers} icon={Users} tone="ice" sub={`ARPA ${money(d.arpa_minor)} / mo`} />
              <Kpi label="Monthly churn · est." display={formatPercent(d.monthly_churn_rate)} icon={TrendingDown} tone="danger" sub="Trailing 90 days" />
              <Kpi label="Trial conversion" display={formatPercent(d.trial_conversion_rate)} icon={Percent} tone="mint" sub="Orgs with ≥1 paid charge" />
              <Kpi label="LTV · estimate" display={d.ltv_estimate_minor ? money(d.ltv_estimate_minor, { compact: true }) : "—"} icon={CalendarClock} tone="amber" sub="ARPA ÷ monthly churn" />
              <Kpi label="Collected · 12 mo" value={collected} format={moneyCompact} icon={IndianRupee} tone="success" sub={`${okCount} succeeded charges`} />
              <Kpi label="Failed · 12 mo" value={failedMinor} format={moneyCompact} icon={AlertTriangle} tone="danger" alert={failedMinor > 0} sub={`${failedCount} failed charges`} />
              <Kpi label="Charge success" display={recovery == null ? "—" : formatPercent(recovery)} icon={Percent} tone="ice" sub="Succeeded ÷ attempted" />
            </KpiGrid>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Collected vs failed" description="Payment value by month · INR" className="xl:col-span-2" actions={<ChartLegend items={[{ label: "Collected", color: C.ice }, { label: "Failed", color: C.danger, dashed: true }]} />}>
                <AreaTrend data={d.monthly} x="month" series={[{ key: "revenue_minor", name: "Collected", color: C.ice }, { key: "failed_minor", name: "Failed", color: C.danger, dashed: true }]} format={moneyCompact} height={280} />
              </Panel>
              <Panel title="MRR by plan" description="Share of normalised monthly revenue" meta={money(d.mrr_minor)}>
                <ul className="space-y-4">
                  {d.revenue_by_plan.map((p, i) => (
                    <li key={p.code}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="flex items-center gap-2 text-foreground-soft"><span className={cn("size-1.5 rounded-[1px]", toneBg(PLAN_TONES[i % PLAN_TONES.length]))} />{p.name}</span>
                        <span className="font-mono tabular text-foreground">{money(p.mrr_minor)} <span className="ml-1 text-subtle-foreground">{Math.round((p.mrr_minor / totalPlan) * 100)}%</span></span>
                      </div>
                      <Meter value={p.mrr_minor} max={totalPlan} tone={PLAN_TONES[i % PLAN_TONES.length]} label={`${p.name} share of MRR`} />
                    </li>
                  ))}
                  {!d.revenue_by_plan.length && <li><EmptyLine>No paying subscriptions yet</EmptyLine></li>}
                </ul>
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Charge volume" description="Succeeded vs failed charges per month" actions={<ChartLegend items={[{ label: "Succeeded", color: C.cyan }, { label: "Failed", color: C.danger }]} />}>
                <BarTrend data={d.monthly} x="month" series={[{ key: "payments", name: "Succeeded", color: C.cyan }, { key: "failed", name: "Failed", color: C.danger }]} stacked height={230} />
              </Panel>
              <Panel title="Recent failed payments" description="Grace-period candidates" meta={`${d.failed_payments.length} shown`} flush>
                <ul className="divide-y divide-border">
                  {d.failed_payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-danger shadow-[0_0_8px_var(--danger)]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground">{p.organization_name}</span>
                        <span className="block truncate text-[11px] text-danger-foreground">{p.failure_reason ?? "Payment failed"}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-[12.5px] tabular text-foreground">{money(p.amount_minor)}</span>
                        <span className="block font-mono text-[10.5px] text-subtle-foreground">{relTime(p.created_at)}</span>
                      </span>
                    </li>
                  ))}
                  {!d.failed_payments.length && <li><EmptyLine>No failed payments</EmptyLine></li>}
                </ul>
              </Panel>
            </div>
            <Panel title="Metric definitions" description="How each figure is computed server-side">
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(d.definitions).map(([k, v]) => (
                  <div key={k} className="border-l border-border pl-3">
                    <dt className="micro-label">{k.replace(/_/g, " ")}</dt>
                    <dd className="mt-1 text-[12.5px] leading-relaxed text-foreground-soft">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}

