"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCheck, Send, SkipForward } from "lucide-react";
import { formatNumber, formatPercent, titleCase } from "@/lib/utils";
import { BarTrend, C } from "@/components/admin/charts";
import { Bar, DataTable, FilterBar, FilterSelect, MetricCard, Pagination, Panel, Row, SectionHeader, StatusPill, Td, Th, opts, relTime, useAdmin, type AdminPage } from "@/components/admin/ui";

interface CampRow { id: string; name: string; organization_id: string; organization_name: string; channel: string; status: string; launched_at: string | null; sent: number; delivered: number; failed: number; skipped: number; failure_rate: number | null }
interface Resp extends AdminPage<CampRow> {
  summary_30d: { sent: number; delivered: number; failed: number; skipped: number; failure_rate: number | null };
  top_failing: { organization_id: string; organization_name: string; failed: number; total: number }[];
  by_channel: { channel: string; sent: number; failed: number }[];
  status_counts: Record<string, number>;
}

export default function CampaignMonitoringPage() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [channel, setChannel] = React.useState("");
  React.useEffect(() => setPage(1), [status, channel]);
  const q = useAdmin<Resp>("/campaigns", { page, page_size: 20, status, channel });
  const d = q.data;
  return (
    <>
      <SectionHeader eyebrow="Operations" title="Campaign monitoring" description="Delivery health across every tenant. Counts only — message content and recipients stay private." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sent (30 days)" value={formatNumber(d?.summary_30d.sent)} icon={Send} accent="blue" loading={!d} />
        <MetricCard label="Delivered" value={formatNumber(d?.summary_30d.delivered)} icon={CheckCheck} accent="emerald" loading={!d} />
        <MetricCard label="Failure rate" value={formatPercent(d?.summary_30d.failure_rate)} icon={AlertTriangle} accent="rose" loading={!d} hint={`${formatNumber(d?.summary_30d.failed ?? 0)} failed`} />
        <MetricCard label="Skipped (no consent / opted out)" value={formatNumber(d?.summary_30d.skipped)} icon={SkipForward} accent="amber" loading={!d} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <Panel title="By channel (30 days)" className="xl:col-span-2">
          <BarTrend data={d?.by_channel.map((c) => ({ ...c, channel: titleCase(c.channel) })) ?? []} x="channel" series={[{ key: "sent", name: "Sent", color: C.blue }, { key: "failed", name: "Failed", color: C.rose }]} height={220} />
        </Panel>
        <Panel title="Top failing organizations">
          <ul className="space-y-3.5">
            {d?.top_failing.map((o) => (
              <li key={o.organization_id}>
                <div className="mb-1.5 flex justify-between text-[13px]"><Link href={`/admin/organizations/${o.organization_id}`} className="truncate text-foreground hover:underline">{o.organization_name}</Link><span className="font-mono text-danger-foreground">{o.failed}/{o.total}</span></div>
                <Bar value={o.failed} max={o.total} accent={C.rose} />
              </li>
            ))}
            {d && !d.top_failing.length && <li className="text-[13px] text-muted-foreground">No failures in the last 30 days.</li>}
          </ul>
        </Panel>
      </div>
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={opts(["draft", "scheduled", "active", "paused", "completed", "archived"])} />
          <FilterSelect value={channel} onChange={setChannel} placeholder="All channels" options={opts(["whatsapp", "email", "sms", "qr"])} />
        </FilterBar>
        <DataTable colSpan={8} loading={q.isLoading} empty={d && !d.items.length} head={<><Th>Campaign</Th><Th>Organization</Th><Th>Channel</Th><Th>Status</Th><Th align="right">Sent</Th><Th align="right">Delivered</Th><Th align="right">Failed</Th><Th>Launched</Th></>}>
          {d?.items.map((c) => (
            <Row key={c.id}>
              <Td className="font-medium text-foreground">{c.name}</Td>
              <Td><Link href={`/admin/organizations/${c.organization_id}`} className="hover:underline">{c.organization_name}</Link></Td>
              <Td>{titleCase(c.channel)}</Td>
              <Td><StatusPill status={c.status} /></Td>
              <Td align="right">{c.sent}</Td>
              <Td align="right">{c.delivered}</Td>
              <Td align="right" className={c.failed ? "text-danger-foreground" : ""}>{c.failed}{c.failure_rate ? <span className="ml-1 text-[11px]">({formatPercent(c.failure_rate, 0)})</span> : null}</Td>
              <Td>{relTime(c.launched_at)}</Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="campaigns" />}
      </Panel>
    </>
  );
}
