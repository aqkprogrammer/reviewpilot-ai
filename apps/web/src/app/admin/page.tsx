"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, Building2, CreditCard, IndianRupee, MessageSquareText, Send, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { AreaTrend, BarTrend, C, Donut } from "@/components/admin/charts";
import { MetricCard, Panel, QueryState, SectionHeader, money, useAdmin } from "@/components/admin/ui";

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

export default function AdminOverview() {
  const q = useAdmin<Overview>("/overview");
  const d = q.data;
  const growth = d ? d.organization_growth.map((o, i) => ({ month: o.month, organizations: o.organizations, subscriptions: d.subscription_growth[i]?.subscriptions ?? 0 })) : [];
  return (
    <>
      <SectionHeader
        eyebrow="Control plane"
        title="Platform overview"
        description="Live health of the ReviewPilot business — tenants, revenue, delivery and AI consumption."
        actions={<Button variant="outline" size="sm" asChild><Link href="/admin/revenue">Revenue analytics <ArrowRight /></Link></Button>}
      />
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            {d.demo_mode && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#f59e0b]/25 bg-warning-soft px-4 py-2.5 text-[12.5px] text-warning-foreground">
                <AlertTriangle className="size-4 shrink-0" /> Demo mode is on — figures include seeded sample organizations and simulated (mock) payments.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Monthly recurring revenue" value={money(d.totals.mrr_minor, { compact: true })} icon={IndianRupee} accent="emerald" hint={<>ARR {money(d.totals.arr_minor, { compact: true })}</>} />
              <MetricCard label="Organizations" value={formatNumber(d.totals.organizations)} icon={Building2} accent="blue" hint={`${d.totals.active_organizations} active · ${d.totals.trial_accounts} on trial`} />
              <MetricCard label="Paid subscriptions" value={formatNumber(d.totals.paid_subscriptions)} icon={CreditCard} accent="violet" hint={`${d.subscription_status.grace_period ?? 0} in grace period`} />
              <MetricCard label="Total users" value={formatNumber(d.totals.users)} icon={Users} accent="amber" hint="Across all organizations" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Reviews synchronized" value={formatNumber(d.totals.reviews_google + d.totals.reviews_demo, { compact: true })} icon={MessageSquareText} accent="cyan" hint={`${formatNumber(d.totals.reviews_google)} Google · ${formatNumber(d.totals.reviews_demo)} demo`} />
              <MetricCard label="Review requests sent" value={formatNumber(d.totals.campaigns_sent, { compact: true })} icon={Send} accent="blue" hint="WhatsApp, email and SMS" />
              <MetricCard label="AI requests" value={formatNumber(d.totals.ai_requests, { compact: true })} icon={Bot} accent="violet" hint="All time, metered" />
              <MetricCard label="Failed jobs (24h)" value={formatNumber(d.totals.failed_jobs_24h)} icon={AlertTriangle} accent={d.totals.failed_jobs_24h ? "rose" : "emerald"} hint={<Link href="/admin/system-health" className="underline-offset-4 hover:underline">View system health</Link>} />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel className="xl:col-span-2" title="Monthly revenue" description="Succeeded payments per month (INR)" actions={<Sparkles className="size-4 text-subtle-foreground" />}>
                <AreaTrend data={d.monthly_revenue} x="month" series={[{ key: "revenue_minor", name: "Revenue", color: C.blue }]} format={(v) => money(v, { compact: true })} height={280} />
              </Panel>
              <Panel title="Plan distribution" description="Subscriptions by plan">
                <Donut data={d.plan_distribution.map((p) => ({ name: p.name, value: p.count }))} height={170} center={<><span className="font-mono text-2xl font-semibold">{d.plan_distribution.reduce((a, p) => a + p.count, 0)}</span><span className="text-[11px] text-muted-foreground">subscriptions</span></>} />
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="New registrations" description="Users per week · last 12 weeks">
                <BarTrend data={d.registrations} x="week" series={[{ key: "users", name: "Users", color: C.cyan }]} height={220} />
              </Panel>
              <Panel title="Organization & subscription growth" description="Cumulative, by month">
                <AreaTrend data={growth} x="month" series={[{ key: "organizations", name: "Organizations", color: C.violet }, { key: "subscriptions", name: "Subscriptions", color: C.blue }]} height={220} />
              </Panel>
              <Panel title="Churn" description="Canceled + expired subscriptions per month">
                <BarTrend data={d.churn} x="month" series={[{ key: "churned", name: "Churned", color: C.rose }]} height={220} />
              </Panel>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
