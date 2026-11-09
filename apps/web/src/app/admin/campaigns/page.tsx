"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCheck, ExternalLink, Percent, Send, SkipForward } from "lucide-react";
import { Skeleton } from "@/components/ui/states";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";
import { BarTrend, C, ChartLegend } from "@/components/admin/charts";
import { DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort } from "@/components/admin/table";
import { EmptyLine, Kpi, KpiGrid, Meter, Monogram, Panel, SectionHeader, StatusPill, opts, relTime, useAdmin, type AdminPage } from "@/components/admin/ui";

interface CampRow { id: string; name: string; organization_id: string; organization_name: string; channel: string; status: string; launched_at: string | null; sent: number; delivered: number; failed: number; skipped: number; failure_rate: number | null }
interface Resp extends AdminPage<CampRow> {
  summary_30d: { sent: number; delivered: number; failed: number; skipped: number; failure_rate: number | null };
  top_failing: { organization_id: string; organization_name: string; failed: number; total: number }[];
  by_channel: { channel: string; sent: number; failed: number }[];
  status_counts: Record<string, number>;
}
const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "archived"];

export default function CampaignMonitoringPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [status, setStatus] = React.useState("");
  const [channel, setChannel] = React.useState("");
  React.useEffect(() => setPage(1), [status, channel, pageSize]);
  const q = useAdmin<Resp>("/campaigns", { page, page_size: pageSize, status, channel });
  const d = q.data;
  const s = d?.summary_30d;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    name: (c) => c.name, org: (c) => c.organization_name, channel: (c) => c.channel, status: (c) => c.status, sent: (c) => c.sent, delivered: (c) => c.delivered, failed: (c) => c.failed, rate: (c) => c.failure_rate, launched: (c) => c.launched_at,
  });
  const totalCampaigns = d ? Object.values(d.status_counts).reduce((a, b) => a + b, 0) : undefined;
  const deliveryRate = s && s.sent ? s.delivered / s.sent : null;
  const menu = (c: CampRow) => [{ label: "Open organization", icon: ExternalLink, href: `/admin/organizations/${c.organization_id}` }];
  return (
    <>
      <SectionHeader title="Campaign monitoring" description="Delivery health across every tenant. Counts only — message content and recipients stay private." meta="Rolling 30 days" />
      <KpiGrid className="mb-4 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Sent · 30d" value={s?.sent} icon={Send} tone="ice" sub="Review requests" loading={!s} />
        <Kpi label="Delivered" value={s?.delivered} icon={CheckCheck} tone="success" sub={deliveryRate != null ? `${formatPercent(deliveryRate)} of sent` : "—"} loading={!s} />
        <Kpi label="Failed" value={s?.failed} icon={AlertTriangle} tone={s?.failed ? "danger" : "success"} alert={!!s?.failed} sub="Provider rejected" loading={!s} />
        <Kpi label="Failure rate" display={formatPercent(s?.failure_rate)} icon={Percent} tone="amber" sub="Failed ÷ attempted" loading={!s} />
        <Kpi label="Skipped" value={s?.skipped} icon={SkipForward} tone="neutral" sub="No consent / opted out" loading={!s} />
      </KpiGrid>
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel title="By channel" description="Sent vs failed · 30 days" className="xl:col-span-2" actions={<ChartLegend items={[{ label: "Sent", color: C.ice }, { label: "Failed", color: C.danger }]} />}>
          {d ? (d.by_channel.length ? <BarTrend data={d.by_channel.map((c) => ({ ...c, channel: titleCase(c.channel) }))} x="channel" series={[{ key: "sent", name: "Sent", color: C.ice }, { key: "failed", name: "Failed", color: C.danger }]} height={220} /> : <EmptyLine className="py-20">No sends in the last 30 days</EmptyLine>) : <Skeleton className="h-[220px]" />}
        </Panel>
        <Panel title="Top failing organizations" description="Failed ÷ total requests · 30 days" flush>
          <ul className="divide-y divide-border">
            {d?.top_failing.map((o) => (
              <li key={o.organization_id} className="px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
                  <Link href={`/admin/organizations/${o.organization_id}`} className="truncate text-foreground hover:text-primary">{o.organization_name}</Link>
                  <span className="font-mono tabular text-danger-foreground">{o.failed}<span className="text-subtle-foreground">/{o.total}</span></span>
                </div>
                <Meter value={o.failed} max={o.total} tone="danger" label={`${o.organization_name} failure share`} />
              </li>
            ))}
            {d && !d.top_failing.length && <li><EmptyLine>No failures in the last 30 days</EmptyLine></li>}
            {!d && <li className="p-4"><Skeleton className="h-32" /></li>}
          </ul>
        </Panel>
      </div>
      <StatusTabs
        id="camp-status"
        className="mb-3"
        value={status || "all"}
        onChange={(v) => setStatus(v === "all" ? "" : v)}
        items={[{ value: "all", label: "All", count: totalCampaigns }, ...STATUSES.map((t) => ({ value: t, label: titleCase(t), count: d?.status_counts?.[t] ?? 0 }))]}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} />}>
          <FilterSelect value={channel} onChange={setChannel} placeholder="All channels" options={[...opts(["whatsapp", "email", "sms"]), { value: "qr", label: "QR" }]} />
        </Toolbar>
        <Responsive
          table={
            <DataTable colSpan={10} minWidth={1060} loading={q.isLoading} empty={!!d && !d.items.length} caption="Campaigns"
              head={<>
                <Th sortKey="name" sort={sort} onSort={toggle}>Campaign</Th>
                <Th sortKey="org" sort={sort} onSort={toggle}>Organization</Th>
                <Th sortKey="channel" sort={sort} onSort={toggle}>Channel</Th>
                <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                <Th align="right" sortKey="sent" sort={sort} onSort={toggle}>Sent</Th>
                <Th align="right" sortKey="delivered" sort={sort} onSort={toggle}>Deliv.</Th>
                <Th align="right" sortKey="failed" sort={sort} onSort={toggle}>Failed</Th>
                <Th sortKey="rate" sort={sort} onSort={toggle}>Fail rate</Th>
                <Th sortKey="launched" sort={sort} onSort={toggle}>Launched</Th>
                <Th srOnly>Actions</Th>
              </>}>
              {sorted.map((c) => (
                <Row key={c.id}>
                  <Td className="max-w-[220px] truncate font-medium text-foreground">{c.name}</Td>
                  <Td><Link href={`/admin/organizations/${c.organization_id}`} className="flex items-center gap-2 hover:text-primary"><Monogram name={c.organization_name} size={22} /><span className="truncate">{c.organization_name}</span></Link></Td>
                  <Td className="font-mono text-[11px] uppercase">{c.channel}</Td>
                  <Td><StatusPill status={c.status} /></Td>
                  <Td align="right" className="font-mono text-[12px] text-foreground">{formatNumber(c.sent)}</Td>
                  <Td align="right" className="font-mono text-[12px]">{formatNumber(c.delivered)}</Td>
                  <Td align="right" className={cn("font-mono text-[12px]", c.failed && "text-danger-foreground")}>{c.failed}</Td>
                  <Td className="w-32">
                    {c.failure_rate != null ? (
                      <div className="flex items-center gap-2"><Meter value={c.failure_rate} max={1} tone={c.failure_rate > 0.1 ? "danger" : "amber"} className="w-14" label="Failure rate" /><span className="font-mono text-[11px] tabular">{formatPercent(c.failure_rate, 0)}</span></div>
                    ) : <span className="text-subtle-foreground">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{relTime(c.launched_at)}</Td>
                  <Td align="right"><RowMenu items={menu(c)} label={`Actions for ${c.name}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : !sorted.length ? <EmptyLine>No campaigns match</EmptyLine>
            : sorted.map((c) => (
              <MobileCard key={c.id}>
                <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{c.name}</p><StatusPill status={c.status} /></div>
                <p className="truncate font-mono text-[10.5px] uppercase text-subtle-foreground">{c.organization_name} · {c.channel}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <MiniStat label="Sent">{formatNumber(c.sent)}</MiniStat>
                  <MiniStat label="Failed">{c.failed}</MiniStat>
                  <MiniStat label="Launched">{relTime(c.launched_at)}</MiniStat>
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="campaigns" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>
    </>
  );
}
