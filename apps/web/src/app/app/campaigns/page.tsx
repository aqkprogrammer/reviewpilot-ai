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
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CHANNEL_META, ChannelIcon, type Campaign } from "@/components/campaigns/shared";
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
    return <p className="text-[12.5px] text-muted-foreground"><span className="font-semibold tabular text-foreground">{formatNumber(s.scans ?? s.clicks)}</span> scans of linked QR codes</p>;
  }
  const base = Math.max(1, s.requests);
  const segs = [
    { v: s.delivered, c: "bg-primary", l: "Delivered" },
    { v: Math.max(0, s.sent - s.delivered), c: "bg-blue", l: "Sent" },
    { v: s.failed, c: "bg-danger", l: "Failed" },
    { v: s.skipped, c: "bg-border-strong", l: "Skipped" },
  ];
  return (
    <div className="w-full">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {segs.map((x) => <div key={x.l} className={x.c} style={{ width: `${(x.v / base) * 100}%` }} />)}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] tabular text-muted-foreground">
        <span>{formatNumber(s.sent)} sent · {formatNumber(s.failed)} failed</span>
        <span>{formatNumber(s.google_clicks)} Google clicks</span>
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
        title="Campaigns"
        description="Ask customers for honest feedback over WhatsApp, email, SMS or QR — every customer gets the same chance to review you on Google."
        actions={canManage && <Button asChild><Link href="/app/campaigns/new"><Plus /> New campaign</Link></Button>}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist">
            {TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={status === t.value} onClick={() => { setStatus(t.value); setPage(1); }}
                className={cn("h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition", status === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 gap-2 xl:justify-end">
            <div className="flex-1 xl:max-w-xs"><Input leading={<Search />} placeholder="Search campaigns" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search campaigns" /></div>
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" aria-label="Channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {Object.entries(CHANNEL_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {list.isError ? (
          <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="divide-y divide-border">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-4 p-5"><Skeleton className="size-9 rounded-xl" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-40" /></div>)}</div>
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
              <li key={c.id} onClick={() => router.push(`/app/campaigns/${c.id}`)} className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-muted/40 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_90px_auto]">
                <ChannelIcon channel={c.channel} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/app/campaigns/${c.id}`} className="truncate text-[13.5px] font-semibold hover:text-primary" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {CHANNEL_META[c.channel]?.label} · {c.location_name} · {c.launched_at ? `Launched ${format(new Date(c.launched_at), "d MMM yyyy")}` : c.schedule_at ? `Scheduled ${format(new Date(c.schedule_at), "d MMM, h:mm a")}` : `Created ${format(new Date(c.created_at), "d MMM yyyy")}`}
                  </p>
                </div>
                <div className="col-span-3 md:col-span-1 md:col-start-3"><Funnel c={c} /></div>
                <div className="hidden text-right md:block">
                  <p className="text-[15px] font-semibold tabular">{c.channel === "qr" ? "—" : formatPercent(c.stats.conversion_rate, 0)}</p>
                  <p className="text-[11px] text-muted-foreground">click-through</p>
                </div>
                <div className="col-start-3 row-start-1 md:col-start-5">{canManage && <CampaignActions campaign={c} />}</div>
              </li>
            ))}
          </ul>
        )}
        {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
      </Card>
    </div>
  );
}
