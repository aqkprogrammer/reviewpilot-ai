"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Info, Search, Send, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, Reveal, StatusDot } from "@/components/ui/tech";
import { Pagination } from "@/components/app/pagination";
import { RequestsTable } from "@/components/campaigns/requests-table";
import { SendRequestDialog } from "@/components/campaigns/send-request-dialog";
import type { RequestRow } from "@/components/campaigns/shared";
import { LineMeter, Segmented } from "@/components/dashboard/kit";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface Summary { total: number; sent: number; delivered: number; failed: number; clicked: number; google_clicked: number; skipped: number }

const int = (n: number) => formatNumber(Math.round(n));

function Pipeline({ s }: { s?: Summary }) {
  const stages = [
    { label: "Sent", v: s?.sent, color: "var(--chart-2)", sub: s ? `${formatNumber(s.total)} created` : undefined },
    { label: "Delivered", v: s?.delivered, color: "var(--chart-1)" },
    { label: "Opened page", v: s?.clicked, color: "var(--chart-3)" },
    { label: "Clicked to Google", v: s?.google_clicked, color: "var(--chart-4)", def: "Customers who clicked “Review on Google”. A click is intent — ReviewPilot can't confirm a review was posted." },
  ];
  const base = s?.sent || 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="micro-label flex items-center gap-2"><span className="text-primary/80">01</span><span aria-hidden className="h-px w-3 bg-border-strong" />Delivery pipeline</p>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">% of sent · all time</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.9fr)]">
        {stages.map((st, i) => (
          <div key={st.label} className={cn("relative border-border px-5 py-4", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i > 0 && "lg:border-l")}>
            {i > 0 && <ChevronRight aria-hidden className="absolute -left-2 top-1/2 hidden size-4 -translate-y-1/2 rounded-full bg-card text-subtle-foreground lg:block" />}
            <p className="micro-label flex items-center gap-1.5">
              {st.label}
              {st.def && (
                <Tooltip content={st.def}><button aria-label={`About ${st.label}`} className="text-subtle-foreground hover:text-foreground"><Info className="size-3" /></button></Tooltip>
              )}
            </p>
            {s ? (
              <>
                <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.035em] tabular"><AnimatedNumber value={st.v} format={int} /></p>
                <LineMeter className="mt-3" value={base ? (st.v ?? 0) / base : 0} color={st.color} />
                <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{i === 0 ? st.sub : base ? `${formatPercent((st.v ?? 0) / base, 0)} of sent` : "—"}</p>
              </>
            ) : <Skeleton className="mt-2 h-12 w-24" />}
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-2 border-t border-border bg-background-subtle/50 lg:col-span-1 lg:grid-cols-1 lg:border-l lg:border-t-0">
          <div className="px-5 py-3.5">
            <p className="micro-label flex items-center gap-1.5"><StatusDot tone={s?.failed ? "error" : "idle"} /> Failed</p>
            <p className={cn("mt-1.5 font-mono text-[18px] tabular", s?.failed ? "text-danger-foreground" : "text-foreground")}>{s ? <AnimatedNumber value={s.failed} format={int} /> : "—"}</p>
          </div>
          <div className="border-l border-border px-5 py-3.5 lg:border-l-0 lg:border-t">
            <p className="micro-label flex items-center gap-1.5"><StatusDot tone="idle" /> Skipped</p>
            <p className="mt-1.5 font-mono text-[18px] tabular text-foreground">{s ? <AnimatedNumber value={s.skipped} format={int} /> : "—"}</p>
            <p className="mt-0.5 text-[10.5px] text-subtle-foreground">No consent or opted out</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ReviewRequestsPage() {
  const { orgId, can } = useOrg();
  const [status, setStatus] = React.useState("all");
  const [channel, setChannel] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const summary = useQuery({ queryKey: ["review-requests", "summary", orgId], queryFn: () => api.get<Summary>("/review-requests/summary") });
  const list = useQuery({
    queryKey: ["review-requests", "list", orgId, status, channel, q, page],
    queryFn: () => api.get<{ items: RequestRow[]; total: number; page: number; pages: number; page_size: number }>("/review-requests", {
      page, page_size: 20, status: status === "all" ? undefined : status, channel: channel === "all" ? undefined : channel, q,
    }),
    placeholderData: (p) => p,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outreach · Delivery log"
        title="Review requests"
        description="Every request sent to a customer, from campaigns and one-off sends — with delivery and click tracking."
        actions={can("customers.manage") && <SendRequestDialog trigger={<Button><Send /> Send request</Button>} />}
      />
      <Pipeline s={summary.data} />

      <Reveal>
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-center">
            <Segmented
              id="rr-channel"
              ariaLabel="Channel"
              value={channel}
              onChange={(v) => { setChannel(v); setPage(1); }}
              options={[{ value: "all", label: "All" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }]}
            />
            <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
              <div className="min-w-[180px] flex-1 lg:max-w-xs"><Input leading={<Search />} placeholder="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search requests" /></div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[156px]" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["queued", "sent", "delivered", "clicked", "failed", "skipped"].map((x) => <SelectItem key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {list.isError ? (
            <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !list.data?.items.length ? (
            <EmptyState
              icon={SkipForward}
              title={q || status !== "all" || channel !== "all" ? "No requests match" : "No review requests yet"}
              description="Launch a campaign or send a one-off request to a customer who agreed to be contacted."
              action={can("customers.manage") && <SendRequestDialog trigger={<Button size="sm"><Send /> Send request</Button>} />}
            />
          ) : (
            <div className={list.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}><RequestsTable rows={list.data.items} /></div>
          )}
          {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
        </Card>
      </Reveal>
    </div>
  );
}
