"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Coins, Cpu, Hash, Percent } from "lucide-react";
import { formatNumber, formatPercent, titleCase } from "@/lib/utils";
import { BarTrend, C, Donut } from "@/components/admin/charts";
import { DataTable, Row, SearchInput, SortNote, Td, Th, Toolbar, useClientSort } from "@/components/admin/table";
import { EmptyLine, Kpi, KpiGrid, Meter, Monogram, Notice, Panel, QueryState, SectionHeader, stamp, useAdmin } from "@/components/admin/ui";

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
  const [search, setSearch] = React.useState("");
  const orgs = (d?.per_organization ?? []).filter((o) => !search || o.organization_name.toLowerCase().includes(search.toLowerCase()));
  const { sorted, sort, toggle } = useClientSort(orgs, { org: (o) => o.organization_name, requests: (o) => o.requests, failed: (o) => o.failed, tokens: (o) => o.tokens, cost: (o) => o.estimated_cost_usd }, { key: "requests", dir: "desc" });
  const max = Math.max(1, ...(d?.per_organization.map((o) => o.requests) ?? [1]));
  const periodLabel = d ? new Date(`${d.period}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";
  const tokens = d ? d.totals.prompt_tokens + d.totals.completion_tokens : 0;
  return (
    <>
      <SectionHeader title="AI usage" description="Metered AI consumption per tenant, feature and model. Cost is a list-price estimate in USD." meta={periodLabel} />
      <QueryState query={q}>
        {d && (
          <div className="space-y-4">
            {!d.configured && <Notice icon={Cpu} tone="ice">OpenAI is not configured — requests use the offline heuristic engine at zero cost. Set <span className="font-mono">OPENAI_API_KEY</span> to switch to <span className="font-mono">{d.model}</span>.</Notice>}
            <KpiGrid className="grid-cols-2 lg:grid-cols-5">
              <Kpi label="Requests · month" value={d.totals.requests} icon={Bot} tone="mint" sub={d.configured ? d.model : "offline engine"} />
              <Kpi label="Tokens" value={tokens} format={(n) => formatNumber(n, { compact: true })} icon={Hash} tone="ice" sub={`${formatNumber(d.totals.prompt_tokens, { compact: true })} in · ${formatNumber(d.totals.completion_tokens, { compact: true })} out`} />
              <Kpi label="Est. cost · USD" display={usd(d.totals.estimated_cost_usd)} icon={Coins} tone="amber" sub="List-price estimate" />
              <Kpi label="Failed" value={d.totals.failed} icon={AlertTriangle} tone={d.totals.failed ? "danger" : "success"} alert={!!d.totals.failed} sub="Provider or parse errors" />
              <Kpi label="Failure rate" display={d.totals.requests ? formatPercent(d.totals.failed / d.totals.requests) : "—"} icon={Percent} tone="neutral" sub="Failed ÷ requests" />
            </KpiGrid>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Requests by month" description="Metered requests across all tenants" meta={`${d.monthly.length} months`} className="xl:col-span-2">
                <BarTrend data={d.monthly} x="period" series={[{ key: "requests", name: "Requests", color: C.mint }]} height={240} />
              </Panel>
              <Panel title="By feature" description="All-time generations by kind">
                <Donut size={132} data={Object.entries(d.by_kind).map(([k, v]) => ({ name: titleCase(k), value: v }))} center={<><span className="text-[18px] font-semibold tabular">{formatNumber(Object.values(d.by_kind).reduce((a, b) => a + b, 0), { compact: true })}</span><span className="micro-label text-[9px]">gens</span></>} />
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
              <Panel title="Usage by organization" description="This month · top 50" flush>
                <Toolbar right={<SortNote sort={sort} base="By requests" />}><SearchInput value={search} onChange={setSearch} placeholder="Filter organizations" /></Toolbar>
                <DataTable colSpan={6} minWidth={660} maxHeight={440} empty={!sorted.length ? <EmptyLine>No AI usage this month</EmptyLine> : false} caption="AI usage by organization"
                  head={<><Th sortKey="org" sort={sort} onSort={toggle}>Organization</Th><Th>Share</Th><Th align="right" sortKey="requests" sort={sort} onSort={toggle}>Requests</Th><Th align="right" sortKey="failed" sort={sort} onSort={toggle}>Failed</Th><Th align="right" sortKey="tokens" sort={sort} onSort={toggle}>Tokens</Th><Th align="right" sortKey="cost" sort={sort} onSort={toggle}>Cost</Th></>}>
                  {sorted.map((o) => (
                    <Row key={o.organization_id}>
                      <Td><Link href={`/admin/organizations/${o.organization_id}`} className="group flex items-center gap-2.5"><Monogram name={o.organization_name} size={24} /><span className="truncate font-medium text-foreground group-hover:text-primary">{o.organization_name}</span></Link></Td>
                      <Td className="w-36"><Meter value={o.requests} max={max} tone="mint" label={`${o.organization_name} share`} /></Td>
                      <Td align="right" className="font-mono text-[12px] text-foreground">{formatNumber(o.requests)}</Td>
                      <Td align="right" className={o.failed ? "font-mono text-[12px] text-danger-foreground" : "font-mono text-[12px]"}>{o.failed}</Td>
                      <Td align="right" className="font-mono text-[12px]">{formatNumber(o.tokens, { compact: true })}</Td>
                      <Td align="right" className="font-mono text-[12px]">{usd(o.estimated_cost_usd)}</Td>
                    </Row>
                  ))}
                </DataTable>
              </Panel>
              <div className="space-y-4">
                <Panel title="By model" description="All-time generations" flush>
                  <ul className="divide-y divide-border">
                    {d.by_model.map((m) => (
                      <li key={`${m.provider}-${m.model}`} className="flex items-center gap-3 px-4 py-2.5">
                        <Cpu className="size-4 shrink-0 text-subtle-foreground" />
                        <span className="min-w-0 flex-1"><span className="block truncate font-mono text-[12px] text-foreground">{m.model}</span><span className="font-mono text-[10.5px] uppercase text-subtle-foreground">{m.provider} · {formatNumber(m.tokens, { compact: true })} tok</span></span>
                        <span className="text-right font-mono text-[12px]"><span className="block tabular text-foreground">{formatNumber(m.requests)}</span><span className="text-[10.5px] text-subtle-foreground">{usd(m.estimated_cost_usd)}</span></span>
                      </li>
                    ))}
                    {!d.by_model.length && <li><EmptyLine>No generations logged</EmptyLine></li>}
                  </ul>
                </Panel>
                <Panel title="Recent failures" description="Latest 10 failed generations" flush>
                  <ul className="max-h-[260px] divide-y divide-border overflow-y-auto scrollbar-thin">
                    {d.recent_failures.map((f) => (
                      <li key={f.id} className="px-4 py-2.5">
                        <p className="flex items-center gap-2 text-[12px]"><span className="truncate font-medium text-foreground">{f.organization_name}</span><span className="ml-auto shrink-0 font-mono text-[10.5px] text-subtle-foreground">{stamp(f.created_at, false)}</span></p>
                        <p className="font-mono text-[10.5px] uppercase text-subtle-foreground">{f.kind} · {f.model}</p>
                        <p className="truncate text-[11.5px] text-danger-foreground">{f.error}</p>
                      </li>
                    ))}
                    {!d.recent_failures.length && <li><EmptyLine>No failed AI requests</EmptyLine></li>}
                  </ul>
                </Panel>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
