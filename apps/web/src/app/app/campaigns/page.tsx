"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Megaphone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Reveal } from "@/components/ui/tech";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CHANNEL_META, ChannelIcon, type Campaign } from "@/components/campaigns/shared";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function Funnel({ c }: { c: Campaign }) {
  const s = c.stats;
  if (c.channel === "qr") {
    return <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground"><span className="text-[13px] text-foreground tabular">{formatNumber(s.scans ?? s.clicks)}</span> scans · linked QR codes</p>;
  }
  const base = Math.max(1, s.requests);
  const segs = [
    { v: s.delivered, c: "var(--chart-1)", l: "Delivered" },
    { v: Math.max(0, s.sent - s.delivered), c: "var(--chart-2)", l: "Sent, not confirmed" },
    { v: s.failed, c: "var(--danger)", l: "Failed" },
    { v: s.skipped, c: "var(--chart-5)", l: "Skipped" },
  ];
  return (
    <div className="w-full">
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-[2px] bg-border" role="img" aria-label={segs.map((x) => `${x.l} ${x.v}`).join(", ")}>
        {segs.filter((x) => x.v > 0).map((x) => <div key={x.l} title={`${x.l}: ${x.v}`} style={{ width: `${(x.v / base) * 100}%`, background: x.c }} />)}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.06em] tabular text-subtle-foreground">
        <span><span className="text-foreground-soft">{formatNumber(s.sent)}</span> sent · <span className={s.failed ? "text-danger-foreground" : undefined}>{formatNumber(s.failed)}</span> failed</span>
        <span><span className="text-amber">{formatNumber(s.google_clicks)}</span> google</span>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const { orgId, locationId, can } = useOrg();
  const [status, setStatus] = React.useState("");
  const [channel, setChannel] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ["campaigns", "list", orgId, locationId, status, channel, q, page],
    queryFn: () => api.get<{ items: Campaign[]; total: number; page: number; pages: number; page_size: number }>("/campaigns", {
      page, page_size: 12, status: status || undefined, channel: channel === "all" ? undefined : channel, q, location_id: locationId,
    }),
    placeholderData: (p) => p,
  });
  const canManage = can("campaigns.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outreach · Campaigns"
        title="Campaigns"
        description="Ask customers for honest feedback over WhatsApp, email, SMS or QR — every customer gets the same chance to review you on Google."
        actions={canManage && <Button asChild><Link href="/app/campaigns/new"><Plus /> New campaign</Link></Button>}
      />
      <Reveal>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 xl:flex-row xl:items-center">
            <Segmented id="campaign-status" ariaLabel="Campaign status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={TABS} />
            <div className="flex flex-1 flex-wrap gap-2 xl:justify-end">
              <div className="min-w-[180px] flex-1 xl:max-w-xs"><Input leading={<Search />} placeholder="Search campaigns" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search campaigns" /></div>
              <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]" aria-label="Channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {Object.entries(CHANNEL_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1fr)_90px_36px] gap-x-4 border-b border-border bg-background-subtle/60 px-5 py-2 md:grid">
            <span />
            <span className="micro-label !text-[10px]">Campaign</span>
            <span className="micro-label !text-[10px]">Delivery</span>
            <span className="micro-label !text-[10px] text-right">CTR</span>
            <span />
          </div>

          {list.isError ? (
            <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <div className="divide-y divide-border">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-4 p-5"><Skeleton className="size-9 rounded-lg" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-40" /></div>)}</div>
          ) : !list.data?.items.length ? (
            <EmptyState
              icon={Megaphone}
              title={status || q || channel !== "all" ? "No campaigns match" : "Launch your first campaign"}
              description="Send a WhatsApp or email request after a visit. Customers without consent are skipped automatically."
              action={canManage && <Button size="sm" asChild><Link href="/app/campaigns/new"><Plus /> New campaign</Link></Button>}
            />
          ) : (
            <ul className={cn("divide-y divide-border", list.isFetching && "opacity-70")}>
              {list.data.items.map((c) => (
                <li
                  key={c.id}
                  onClick={() => router.push(`/app/campaigns/${c.id}`)}
                  className="group grid cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition hover:bg-surface-hover/50 sm:px-5 md:grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1fr)_90px_36px]"
                >
                  <ChannelIcon channel={c.channel} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/app/campaigns/${c.id}`} className="truncate text-[13.5px] font-semibold text-foreground outline-none hover:text-primary focus-visible:text-primary" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate">
                      <MonoTime>{CHANNEL_META[c.channel]?.label}</MonoTime>
                      <span className="text-subtle-foreground">·</span>
                      <span className="truncate text-[12px] text-muted-foreground">{c.location_name}</span>
                      <span className="text-subtle-foreground">·</span>
                      <MonoTime>{c.launched_at ? `Launched ${format(new Date(c.launched_at), "dd MMM yyyy")}` : c.schedule_at ? `Sends ${format(new Date(c.schedule_at), "dd MMM · HH:mm")}` : `Created ${format(new Date(c.created_at), "dd MMM yyyy")}`}</MonoTime>
                    </p>
                  </div>
                  <div className="col-span-3 md:col-span-1 md:col-start-3"><Funnel c={c} /></div>
                  <div className="hidden text-right md:block">
                    <p className="font-mono text-[16px] font-medium tabular text-foreground">{c.channel === "qr" ? "—" : formatPercent(c.stats.conversion_rate, 0)}</p>
                    <p className="micro-label !text-[9.5px]">{c.channel === "qr" ? "n/a" : "Google"}</p>
                  </div>
                  <div className="col-start-3 row-start-1 justify-self-end md:col-start-5">{canManage && <CampaignActions campaign={c} />}</div>
                </li>
              ))}
            </ul>
          )}
          {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
        </Card>
      </Reveal>
    </div>
  );
}
