"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BellRing, CircleAlert, Info, MapPin, Megaphone, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { RequestsTable } from "@/components/campaigns/requests-table";
import { CHANNEL_META, ChannelIcon, type Campaign, type RequestRow } from "@/components/campaigns/shared";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface TimelinePoint { date: string; sent: number; delivered: number; failed: number; clicks: number; google_clicks: number }

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular tracking-tight", tone)}>{value}</p>
      {sub && <p className="text-[11px] text-subtle-foreground">{sub}</p>}
    </div>
  );
}

function FunnelBars({ c }: { c: Campaign }) {
  const s = c.stats;
  const steps = [
    { label: "Requests created", v: s.requests, color: "bg-border-strong" },
    { label: "Sent", v: s.sent, color: "bg-[var(--chart-2)]" },
    { label: "Delivered", v: s.delivered, color: "bg-primary" },
    { label: "Opened feedback page", v: s.clicks, color: "bg-[var(--chart-3)]" },
    { label: "Clicked “Review on Google”", v: s.google_clicks, color: "bg-[var(--chart-4)]" },
  ];
  const max = Math.max(1, s.requests);
  return (
    <ul className="space-y-3.5">
      {steps.map((st, i) => (
        <li key={st.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-muted-foreground">{st.label}</span>
            <span className="tabular"><span className="font-semibold text-foreground">{formatNumber(st.v)}</span>{i > 0 && s.requests > 0 && <span className="ml-1.5 text-subtle-foreground">{formatPercent(st.v / s.requests, 0)}</span>}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-[width] duration-700", st.color)} style={{ width: `${(st.v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { orgId, can } = useOrg();
  const [filter, setFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const c = useQuery({ queryKey: ["campaign", id, orgId], queryFn: () => api.get<Campaign>(`/campaigns/${id}`), refetchInterval: (q) => (q.state.data?.status === "active" ? 15_000 : false) });
  const timeline = useQuery({
    queryKey: ["campaign", id, "timeline"],
    queryFn: async () => {
      const pts = await api.get<TimelinePoint[]>(`/campaigns/${id}/timeline`);
      if (pts.length === 1) {
        // Pad a single day with a zero baseline so the area reads as a trend, not a dot.
        const prev = new Date(parseISO(pts[0].date).getTime() - 86_400_000).toISOString().slice(0, 10);
        return [{ date: prev, sent: 0, delivered: 0, failed: 0, clicks: 0, google_clicks: 0 }, ...pts];
      }
      return pts;
    },
    enabled: !!c.data && c.data.channel !== "qr",
  });
  const requests = useQuery({
    queryKey: ["campaign", id, "requests", filter, page],
    queryFn: () => api.get<{ items: RequestRow[]; total: number; page: number; pages: number; page_size: number }>(`/campaigns/${id}/requests`, { page, page_size: 15, status: filter === "all" ? undefined : filter }),
    enabled: !!c.data && c.data.channel !== "qr",
    placeholderData: (p) => p,
  });

  if (c.isError) return <Card><ErrorState message={errorMessage(c.error)} onRetry={() => c.refetch()} /></Card>;
  if (!c.data) return <div className="space-y-6"><Skeleton className="h-16 w-96" /><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  const camp = c.data;
  const s = camp.stats;
  const isQr = camp.channel === "qr";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href="/app/campaigns" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Campaigns</Link>
          <div className="mt-2 flex items-center gap-3">
            <ChannelIcon channel={camp.channel} className="size-11 rounded-2xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em]">{camp.name}</h1>
                <StatusBadge status={camp.status} size="md" />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                <span>{CHANNEL_META[camp.channel].label}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{camp.location_name}</span>
                {camp.launched_at && <span>Launched {format(new Date(camp.launched_at), "d MMM yyyy, h:mm a")}</span>}
                {camp.status === "scheduled" && camp.schedule_at && <span>Sends {format(new Date(camp.schedule_at), "d MMM yyyy, h:mm a")}</span>}
                {camp.reminder_enabled && <span className="inline-flex items-center gap-1"><BellRing className="size-3" />{camp.max_reminders} reminder after {camp.reminder_after_hours}h</span>}
              </p>
            </div>
          </div>
        </div>
        {can("campaigns.manage") && <CampaignActions campaign={camp} variant="buttons" />}
      </div>

      {isQr ? (
        <Card>
          <EmptyState icon={Megaphone} title={`${formatNumber(s.scans ?? s.clicks)} scans so far`} description="QR campaigns don't send messages. Manage designs and see scan analytics for each code on the QR Codes page." action={<Link href="/app/qr-codes" className="text-sm font-medium text-primary hover:underline">Open QR Codes</Link>} />
        </Card>
      ) : (
        <>
          <Card className="grid grid-cols-2 divide-border sm:grid-cols-4 xl:grid-cols-8 xl:divide-x">
            <Kpi label="Requests" value={formatNumber(s.requests)} />
            <Kpi label="Sent" value={formatNumber(s.sent)} />
            <Kpi label="Delivered" value={formatNumber(s.delivered)} sub={s.sent ? formatPercent(s.delivered / s.sent, 0) : undefined} tone="text-success-foreground" />
            <Kpi label="Failed" value={formatNumber(s.failed)} tone={s.failed ? "text-danger-foreground" : undefined} />
            <Kpi label="Skipped" value={formatNumber(s.skipped)} sub="No consent / opted out" />
            <Kpi label="Page opens" value={formatNumber(s.clicks)} />
            <Kpi label="Google clicks" value={formatNumber(s.google_clicks)} tone="text-primary" />
            <Kpi label="Click-through" value={formatPercent(s.conversion_rate)} sub="Google clicks ÷ sent" />
          </Card>

          <InlineAlert variant="info" icon={Info}>
            Google click-through measures clicks on “Review on Google”; ReviewPilot can't confirm a review was posted. {camp.status === "draft" ? "" : "Simulated deliveries (demo mode) are marked in the request details."}
          </InlineAlert>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div><CardTitle>Activity over time</CardTitle><CardDescription>Daily sends, deliveries and clicks</CardDescription></div>
                <Legend items={[{ label: "Sent", color: "var(--chart-2)" }, { label: "Opened", color: "var(--chart-3)" }, { label: "Google clicks", color: "var(--chart-4)" }]} />
              </CardHeader>
              <CardContent>
                {timeline.isLoading ? <Skeleton className="h-64" /> : !timeline.data?.length ? (
                  <EmptyState compact icon={MessageSquareText} title="No activity yet" description={camp.status === "draft" ? "Launch the campaign to start sending." : "Requests will appear as they're sent."} />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline.data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <GradientDefs id="tl-sent" color="var(--chart-2)" />
                        <GradientDefs id="tl-g" color="var(--chart-4)" />
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => format(parseISO(d), "d MMM")} />
                        <YAxis {...axisProps} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE d MMM") : l)} />} />
                        <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-2)" strokeWidth={2} fill="url(#tl-sent)" />
                        <Area type="monotone" dataKey="clicks" name="Opened" stroke="var(--chart-3)" strokeWidth={2} fill="none" />
                        <Area type="monotone" dataKey="google_clicks" name="Google clicks" stroke="var(--chart-4)" strokeWidth={2} fill="url(#tl-g)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Funnel</CardTitle><CardDescription>From request to Google click</CardDescription></div></CardHeader>
              <CardContent className="pt-5"><FunnelBars c={camp} /></CardContent>
            </Card>
          </div>

          {camp.message_body && (
            <Card>
              <CardHeader><div><CardTitle>Message</CardTitle><CardDescription>{camp.message_subject ?? "Sent with personalised placeholders"}</CardDescription></div></CardHeader>
              <CardContent><p className="whitespace-pre-wrap rounded-xl border border-border bg-background-subtle p-4 text-[13px] leading-relaxed text-foreground-soft">{camp.message_body}</p></CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <p className="text-[15px] font-semibold">Requests</p>
                <p className="text-xs text-muted-foreground">One row per customer in this campaign</p>
              </div>
              <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]" size="sm" aria-label="Filter requests"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All requests</SelectItem>
                  <SelectItem value="failed">Failed only</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requests.isError ? <ErrorState message={errorMessage(requests.error)} onRetry={() => requests.refetch()} /> : requests.isLoading ? (
              <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !requests.data?.items.length ? (
              <EmptyState compact icon={filter === "failed" ? CircleAlert : MessageSquareText} title={filter === "failed" ? "No failed messages" : "No requests yet"} description={camp.status === "draft" ? "Launch the campaign to create requests." : "Nothing matches this filter."} />
            ) : (
              <RequestsTable rows={requests.data.items} showCampaign={false} />
            )}
            {requests.data && <Pagination page={requests.data.page} pages={requests.data.pages} total={requests.data.total} pageSize={requests.data.page_size} onPage={setPage} />}
          </Card>
        </>
      )}
    </div>
  );
}
