"use client";
import { CalendarClock, IndianRupee, Info, Percent, TrendingDown, Users } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import { AreaTrend, BarTrend, C } from "@/components/admin/charts";
import { Bar, MetricCard, Panel, QueryState, SectionHeader, money, relTime, useAdmin } from "@/components/admin/ui";

interface Revenue {
  mrr_minor: number; arr_minor: number; paying_customers: number; arpa_minor: number; monthly_churn_rate: number; trial_conversion_rate: number | null; ltv_estimate_minor: number | null;
  revenue_by_plan: { code: string; name: string; mrr_minor: number }[]; monthly: { month: string; revenue_minor: number; payments: number; failed: number; failed_minor: number }[];
  failed_payments: { id: string; organization_name: string; amount_minor: number; failure_reason: string | null; created_at: string }[]; definitions: Record<string, string>; includes_simulated: boolean;
}

export default function RevenuePage() {
  const q = useAdmin<Revenue>("/revenue");
  const d = q.data;
  const maxPlan = Math.max(1, ...(d?.revenue_by_plan.map((p) => p.mrr_minor) ?? [1]));
  return (
    <>
      <SectionHeader eyebrow="Finance" title="Revenue analytics" description="Recurring revenue, retention and collection health. Estimates are labelled." />
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            {d.includes_simulated && <p className="flex items-center gap-2 text-[12px] text-warning-foreground"><Info className="size-3.5" /> Includes simulated (mock) payments from demo mode.</p>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="MRR" value={money(d.mrr_minor)} icon={IndianRupee} accent="emerald" hint={`ARR ${money(d.arr_minor)}`} />
              <MetricCard label="Paying customers" value={d.paying_customers} icon={Users} accent="blue" hint={`ARPA ${money(d.arpa_minor)} / month`} />
              <MetricCard label="Monthly churn (est.)" value={formatPercent(d.monthly_churn_rate)} icon={TrendingDown} accent="rose" hint="Trailing 90 days" />
              <MetricCard label="Trial conversion" value={formatPercent(d.trial_conversion_rate)} icon={Percent} accent="violet" hint="Orgs with ≥1 successful payment" />
              <MetricCard label="LTV (estimate)" value={d.ltv_estimate_minor ? money(d.ltv_estimate_minor, { compact: true }) : "—"} icon={CalendarClock} accent="amber" hint="ARPA ÷ monthly churn" />
              <MetricCard label="Failed (12 mo)" value={money(d.monthly.reduce((a, m) => a + m.failed_minor, 0), { compact: true })} icon={TrendingDown} accent="rose" hint={`${d.monthly.reduce((a, m) => a + m.failed, 0)} failed charges`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Collected revenue" description="Succeeded payments by month" className="xl:col-span-2">
                <AreaTrend data={d.monthly} x="month" series={[{ key: "revenue_minor", name: "Collected", color: C.emerald }, { key: "failed_minor", name: "Failed", color: C.rose }]} format={(v) => money(v, { compact: true })} height={280} />
              </Panel>
              <Panel title="MRR by plan">
                <ul className="space-y-4">
                  {d.revenue_by_plan.map((p) => (
                    <li key={p.code}>
                      <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-foreground-soft">{p.name}</span><span className="font-mono text-foreground">{money(p.mrr_minor)}</span></div>
                      <Bar value={p.mrr_minor} max={maxPlan} />
                    </li>
                  ))}
                  {!d.revenue_by_plan.length && <li className="text-[13px] text-muted-foreground">No paying subscriptions yet.</li>}
                </ul>
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Payment volume" description="Successful vs failed charges">
                <BarTrend data={d.monthly} x="month" series={[{ key: "payments", name: "Succeeded", color: C.blue }, { key: "failed", name: "Failed", color: C.rose }]} stacked height={230} />
              </Panel>
              <Panel title="Recent failed payments" flush>
                <ul className="divide-y divide-border">
                  {d.failed_payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                      <span className="min-w-0"><span className="block truncate font-medium text-foreground">{p.organization_name}</span><span className="block truncate text-[11.5px] text-danger-foreground">{p.failure_reason ?? "Payment failed"}</span></span>
                      <span className="text-right"><span className="block font-mono text-foreground">{money(p.amount_minor)}</span><span className="text-[11px] text-subtle-foreground">{relTime(p.created_at)}</span></span>
                    </li>
                  ))}
                  {!d.failed_payments.length && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No failed payments.</li>}
                </ul>
              </Panel>
            </div>
            <Panel title="Metric definitions">
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(d.definitions).map(([k, v]) => <div key={k}><dt className="font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">{k.replace(/_/g, " ")}</dt><dd className="mt-1 text-[12.5px] text-foreground-soft">{v}</dd></div>)}
              </dl>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
