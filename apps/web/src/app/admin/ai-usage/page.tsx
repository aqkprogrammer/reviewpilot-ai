"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Coins, Cpu, Hash } from "lucide-react";
import { formatNumber, titleCase } from "@/lib/utils";
import { BarTrend, C, Donut } from "@/components/admin/charts";
import { Bar, DataTable, MetricCard, Panel, QueryState, Row, SectionHeader, Td, Th, relTime, useAdmin } from "@/components/admin/ui";

interface AIUsage {
  period: string; configured: boolean; model: string;
  totals: { requests: number; failed: number; prompt_tokens: number; completion_tokens: number; estimated_cost_usd: number };
  per_organization: { organization_id: string; organization_name: string; requests: number; failed: number; tokens: number; estimated_cost_usd: number }[];
  by_model: { provider: string; model: string; requests: number; tokens: number; estimated_cost_usd: number }[];
  by_kind: Record<string, number>;
  monthly: { period: string; requests: number; tokens: number; estimated_cost_usd: number }[];
  recent_failures: { id: string; organization_name: string; kind: string; model: string; error: string; created_at: string }[];
}
const usd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`;

export default function AIUsagePage() {
  const q = useAdmin<AIUsage>("/ai-usage");
  const d = q.data;
  const max = Math.max(1, ...(d?.per_organization.map((o) => o.requests) ?? [1]));
  return (
    <>
      <SectionHeader eyebrow="Operations" title="AI usage" description={d ? `Metered usage for ${d.period}. ${d.configured ? `Primary model: ${d.model}.` : "OpenAI is not configured — requests use the offline heuristic engine (zero cost)."}` : "Metered AI consumption."} />
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Requests this month" value={formatNumber(d.totals.requests)} icon={Bot} accent="violet" />
              <MetricCard label="Tokens" value={formatNumber(d.totals.prompt_tokens + d.totals.completion_tokens, { compact: true })} icon={Hash} accent="blue" hint={`${formatNumber(d.totals.prompt_tokens, { compact: true })} in · ${formatNumber(d.totals.completion_tokens, { compact: true })} out`} />
              <MetricCard label="Estimated cost" value={usd(d.totals.estimated_cost_usd)} icon={Coins} accent="amber" hint="List-price estimate (USD)" />
              <MetricCard label="Failed requests" value={formatNumber(d.totals.failed)} icon={AlertTriangle} accent={d.totals.failed ? "rose" : "emerald"} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Requests by month" className="xl:col-span-2"><BarTrend data={d.monthly} x="period" series={[{ key: "requests", name: "Requests", color: C.violet }]} height={240} /></Panel>
              <Panel title="By feature"><Donut data={Object.entries(d.by_kind).map(([k, v]) => ({ name: titleCase(k), value: v }))} height={160} /></Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Usage by organization" flush className="xl:col-span-2">
                <DataTable colSpan={5} minWidth={560} empty={!d.per_organization.length} head={<><Th>Organization</Th><Th>Share</Th><Th align="right">Requests</Th><Th align="right">Tokens</Th><Th align="right">Cost</Th></>}>
                  {d.per_organization.map((o) => (
                    <Row key={o.organization_id}>
                      <Td><Link href={`/admin/organizations/${o.organization_id}`} className="font-medium text-foreground hover:underline">{o.organization_name}</Link></Td>
                      <Td className="w-40"><Bar value={o.requests} max={max} accent={C.violet} /></Td>
                      <Td align="right">{formatNumber(o.requests)}</Td>
                      <Td align="right">{formatNumber(o.tokens, { compact: true })}</Td>
                      <Td align="right" className="font-mono">{usd(o.estimated_cost_usd)}</Td>
                    </Row>
                  ))}
                </DataTable>
              </Panel>
              <Panel title="By model" flush>
                <ul className="divide-y divide-border">
                  {d.by_model.map((m) => (
                    <li key={`${m.provider}-${m.model}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                      <span className="flex items-center gap-2.5"><Cpu className="size-4 text-subtle-foreground" /><span><span className="block font-mono text-[12px] text-foreground">{m.model}</span><span className="text-[11px] text-muted-foreground">{m.provider}</span></span></span>
                      <span className="text-right font-mono text-[12px]"><span className="block text-foreground">{formatNumber(m.requests)}</span><span className="text-subtle-foreground">{usd(m.estimated_cost_usd)}</span></span>
                    </li>
                  ))}
                  {!d.by_model.length && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No generations logged.</li>}
                </ul>
              </Panel>
            </div>
            <Panel title="Recent failures" flush>
              <ul className="divide-y divide-border">
                {d.recent_failures.map((f) => (
                  <li key={f.id} className="px-5 py-3 text-[13px]"><span className="font-medium text-foreground">{f.organization_name}</span> <span className="font-mono text-[11.5px] text-subtle-foreground">· {f.kind} · {f.model} · {relTime(f.created_at)}</span><p className="truncate text-[12px] text-danger-foreground">{f.error}</p></li>
                ))}
                {!d.recent_failures.length && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No failed AI requests.</li>}
              </ul>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
