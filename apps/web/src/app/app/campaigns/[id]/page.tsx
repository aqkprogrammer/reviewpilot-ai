"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, CircleAlert, Info, Megaphone, MessageSquareText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, Reveal, StatusDot } from "@/components/ui/tech";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { RequestsTable } from "@/components/campaigns/requests-table";
import { CHANNEL_META, ChannelIcon, type Campaign, type RequestRow } from "@/components/campaigns/shared";
import { PanelHeader, Segmented } from "@/components/dashboard/kit";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface TimelinePoint { date: string; sent: number; delivered: number; failed: number; clicks: number; google_clicks: number }

const int = (n: number) => formatNumber(Math.round(n));

function FunnelStages({ c }: { c: Campaign }) {
  const s = c.stats;
  const steps = [
    { label: "Requests created", v: s.requests, color: "var(--chart-5)" },
    { label: "Sent", v: s.sent, color: "var(--chart-2)" },
    { label: "Delivered", v: s.delivered, color: "var(--chart-1)" },
    { label: "Opened feedback page", v: s.clicks, color: "var(--chart-3)" },
    { label: "Clicked “Review on Google”", v: s.google_clicks, color: "var(--chart-4)" },
  ];
  const max = Math.max(1, s.requests);
  return (
    <ol className="space-y-1">
      {steps.map((st, i) => {
        const prev = i > 0 ? steps[i - 1].v : null;
        const w = (st.v / max) * 100;
        return (
          <li key={st.label}>
            {prev != null && (
              <p className="flex items-center gap-2 py-0.5 pl-1 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">
                <span aria-hidden className="h-3 w-px bg-border-strong" />
                {prev ? `${formatPercent(st.v / prev, 0)} step conversion` : "—"}
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="flex items-center gap-2 text-muted-foreground"><span className="font-mono text-[10px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>{st.label}</span>
              <span className="font-mono tabular text-foreground">{formatNumber(st.v)}</span>
            </div>
            <div className="mt-1.5 flex justify-center">
              <div className="h-2.5 w-full rounded-[2px] bg-border/60">
                <div className="mx-auto h-full rounded-[2px] transition-[width] duration-700" style={{ width: `${Math.max(st.v ? 1.5 : 0, w)}%`, background: st.color, boxShadow: i === steps.length - 1 && st.v ? `0 0 10px -2px ${st.color}` : undefined }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
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
  if (!c.data) return <div className="space-y-6"><Skeleton className="h-16 w-96 max-w-full" /><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  const camp = c.data;
  const s = camp.stats;
  const isQr = camp.channel === "qr";
  const live = camp.status === "active";

  const meta: [string, React.ReactNode][] = [
    ["Channel", CHANNEL_META[camp.channel].label],
    ["Location", camp.location_name ?? "—"],
    [camp.launched_at ? "Launched" : camp.status === "scheduled" ? "Sends" : "Created", format(new Date(camp.launched_at ?? (camp.status === "scheduled" && camp.schedule_at ? camp.schedule_at : camp.created_at)), "dd MMM yyyy · HH:mm")],
    ["Reminders", camp.reminder_enabled ? `${camp.max_reminders} after ${camp.reminder_after_hours}h` : "Off"],
  ];

  const kpis: { label: string; v: number | null; fmt?: (n: number) => string; sub?: string; tone?: string }[] = [
    { label: "Requests", v: s.requests },
    { label: "Sent", v: s.sent },
    { label: "Delivered", v: s.delivered, sub: s.sent ? formatPercent(s.delivered / s.sent, 0) : undefined, tone: "text-success-foreground" },
    { label: "Failed", v: s.failed, tone: s.failed ? "text-danger-foreground" : undefined },
    { label: "Skipped", v: s.skipped, sub: "No consent" },
    { label: "Page opens", v: s.clicks },
    { label: "Google clicks", v: s.google_clicks, tone: "text-amber" },
    { label: "Click-through", v: s.conversion_rate, fmt: (n) => `${(n * 100).toFixed(1)}%`, sub: "Clicks ÷ sent", tone: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-primary"><ArrowLeft className="size-3.5" /> Campaigns</Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <ChannelIcon channel={camp.channel} className="size-11" />
            <div className="min-w-0">
              <p className="micro-label flex items-center gap-2"><StatusDot tone={live ? "live" : camp.status === "failed" ? "error" : "idle"} pulse={live} /> Campaign · <span className="normal-case tracking-normal">{camp.id.slice(0, 8)}</span></p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[24px] font-semibold tracking-[-0.025em]">{camp.name}</h1>
                <StatusBadge status={camp.status} size="md" />
              </div>
            </div>
          </div>
          {can("campaigns.manage") && <CampaignActions campaign={camp} variant="buttons" />}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-0">
          {meta.map(([k, v], i) => (
            <div key={k} className={cn("min-w-0", i > 0 && "sm:border-l sm:border-border sm:pl-5")}>
              <dt className="micro-label">{k}</dt>
              <dd className="mt-1 truncate font-mono text-[12px] text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {isQr ? (
        <Card>
          <EmptyState icon={Megaphone} title={`${formatNumber(s.scans ?? s.clicks)} scans so far`} description="QR campaigns don't send messages. Manage designs and see scan analytics for each code on the QR Codes page." action={<Link href="/app/qr-codes" className="text-sm font-medium text-primary hover:underline">Open QR Codes</Link>} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-4 xl:grid-cols-8">
            {kpis.map((k) => (
              <div key={k.label} className="bg-card px-4 py-4">
                <p className="micro-label !text-[10px]">{k.label}</p>
                <p className={cn("mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular text-foreground", k.tone)}>
                  {k.v == null ? "—" : <AnimatedNumber value={k.v} format={k.fmt ?? int} />}
                </p>
                <p className="mt-1.5 h-3.5 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-subtle-foreground">{k.sub ?? ""}</p>
              </div>
            ))}
          </div>

          <InlineAlert variant="info" icon={Info}>
            Google click-through measures clicks on “Review on Google”; ReviewPilot can&apos;t confirm a review was posted. {camp.status === "draft" ? "" : "Simulated deliveries (demo mode) are marked in the request details."}
          </InlineAlert>

          <Reveal className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <PanelHeader
                index="01"
                eyebrow="Timeline"
                title="Activity over time"
                description="Daily sends, page opens and Google clicks"
                action={<Legend className="hidden sm:flex" items={[{ label: "Sent", color: "var(--chart-2)" }, { label: "Opened", color: "var(--chart-3)" }, { label: "Google", color: "var(--chart-4)" }]} />}
              />
              <div className="p-5 pt-4">
                {timeline.isLoading ? <Skeleton className="h-64" /> : !timeline.data?.length ? (
                  <EmptyState compact icon={MessageSquareText} title="No activity yet" description={camp.status === "draft" ? "Launch the campaign to start sending." : "Requests will appear as they're sent."} />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timeline.data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <GradientDefs id="tl-sent" color="var(--chart-2)" />
                        <GradientDefs id="tl-g" color="var(--chart-4)" />
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => format(parseISO(d), "d MMM")} minTickGap={24} />
                        <YAxis {...axisProps} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE d MMM") : l)} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 3" }} />
                        <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-2)" strokeWidth={1.75} fill="url(#tl-sent)" />
                        <Line type="monotone" dataKey="clicks" name="Opened" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                        <Area type="monotone" dataKey="google_clicks" name="Google clicks" stroke="var(--chart-4)" strokeWidth={1.75} fill="url(#tl-g)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <PanelHeader index="02" eyebrow="Funnel" title="Request → Google click" description="Each step as a share of the one before" />
              <div className="p-5 pt-4"><FunnelStages c={camp} /></div>
            </Card>
          </Reveal>

          {camp.message_body && (
            <Card>
              <PanelHeader index="03" eyebrow="Payload" title="Message" description={camp.message_subject ?? "Sent with personalised placeholders"} />
              <div className="p-5 pt-4">
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-background-subtle p-4 font-mono text-[12.5px] leading-relaxed text-foreground-soft">{camp.message_body}</p>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="micro-label flex items-center gap-2"><span className="text-primary/80">{camp.message_body ? "04" : "03"}</span><span aria-hidden className="h-px w-3 bg-border-strong" />Recipients</p>
                <p className="mt-1 text-[14.5px] font-semibold">Requests</p>
                <p className="text-[12.5px] text-muted-foreground">One row per customer in this campaign</p>
              </div>
              <Segmented
                id="campaign-req-filter"
                ariaLabel="Filter requests"
                size="sm"
                value={filter}
                onChange={(v) => { setFilter(v); setPage(1); }}
                options={[{ value: "all", label: "All" }, { value: "delivered", label: "Delivered" }, { value: "clicked", label: "Clicked" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Skipped" }]}
              />
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
