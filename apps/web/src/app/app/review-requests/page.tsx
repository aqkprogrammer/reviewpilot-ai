"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, MousePointerClick, PackageCheck, Search, Send, SkipForward, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Pagination } from "@/components/app/pagination";
import { StatCard } from "@/components/app/stat-card";
import { RequestsTable } from "@/components/campaigns/requests-table";
import { SendRequestDialog } from "@/components/campaigns/send-request-dialog";
import type { RequestRow } from "@/components/campaigns/shared";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber, formatPercent } from "@/lib/utils";

interface Summary { total: number; sent: number; delivered: number; failed: number; clicked: number; google_clicked: number; skipped: number }

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
  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review requests"
        description="Every request sent to a customer, from campaigns and one-off sends — with delivery and click tracking."
        actions={can("customers.manage") && <SendRequestDialog trigger={<Button><Send /> Send request</Button>} />}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Sent" icon={Send} accent="primary" loading={!s} value={formatNumber(s?.sent)} footer={`${formatNumber(s?.total)} requests created`} />
        <StatCard label="Delivered" icon={PackageCheck} accent="success" loading={!s} value={formatNumber(s?.delivered)} footer={s?.sent ? `${formatPercent(s.delivered / s.sent, 0)} of sent` : "—"} />
        <StatCard label="Opened feedback page" icon={MousePointerClick} accent="blue" loading={!s} value={formatNumber(s?.clicked)} footer={s?.sent ? `${formatPercent(s.clicked / s.sent, 0)} of sent` : "—"} />
        <StatCard label="Clicked to Google" icon={Star} accent="cyan" loading={!s} value={formatNumber(s?.google_clicked)} definition="Customers who clicked “Review on Google”. A click is intent — ReviewPilot can't confirm a review was posted." footer={s?.sent ? `${formatPercent(s.google_clicked / s.sent, 0)} click-through` : "—"} />
        <StatCard label="Failed / skipped" icon={CircleAlert} accent="danger" loading={!s} value={`${formatNumber(s?.failed)} / ${formatNumber(s?.skipped)}`} footer="Skipped = no consent or opted out" className="col-span-2 md:col-span-1" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="flex-1 sm:max-w-xs"><Input leading={<Search />} placeholder="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search requests" /></div>
          <div className="flex gap-2 sm:ml-auto">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["queued", "sent", "delivered", "clicked", "failed", "skipped"].map((x) => <SelectItem key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
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
    </div>
  );
}
