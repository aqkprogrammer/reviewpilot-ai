"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, Inbox, MessageSquareReply, MessagesSquare, MousePointerClick, RefreshCw, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, Reveal, StatusDot } from "@/components/ui/tech";
import { StatCard } from "@/components/app/stat-card";
import { PeriodFilter, periodQuery, usePeriod } from "@/components/app/period-filter";
import { CampaignPerformance, LocationTable, RatingBars, ReviewGrowthChart, SentimentRing } from "@/components/dashboard/charts";
import { PanelHeader, PanelLink } from "@/components/dashboard/kit";
import { HeroInstrument, InsightsCard, PendingResponses, QuickActions, RecentReviewsCard, SetupChecklist } from "@/components/dashboard/sections";
import type { Overview } from "@/components/dashboard/types";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const int = (n: number) => formatNumber(Math.round(n));

function useClock(ts: number) {
  // Client-only "time since refresh" readout; re-renders every second.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!ts || now == null) return null;
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function OverviewPage() {
  const { orgId, locationId, locations, can, membership } = useOrg();
  const [period, setPeriod] = usePeriod("30d");
  const q = useQuery({
    queryKey: ["analytics", "overview", orgId, period, locationId],
    queryFn: () => api.get<Overview>("/analytics/overview", { ...periodQuery(period), location_id: locationId }),
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const k = d?.kpis;
  const delta = d?.deltas;
  const def = d?.definitions ?? {};
  const stats = useQuery({
    queryKey: ["reviews", "stats", orgId, locationId],
    queryFn: () => api.get<{ pending: number; negative_pending: number }>("/reviews/stats", { location_id: locationId }),
    enabled: can("reviews.read"),
  });
  const since = useClock(q.dataUpdatedAt);
  const refreshedAt = q.dataUpdatedAt ? format(new Date(q.dataUpdatedAt), "HH:mm:ss") : "—";
  const scope = locationId ? locations.find((l) => l.id === locationId)?.name ?? "1 location" : `All · ${locations.length} locations`;
  const range = d?.range ? `${format(parseISO(d.range.start), "dd MMM")} → ${format(parseISO(d.range.end), "dd MMM yyyy")}` : "—";

  return (
    <div className="space-y-6">
      {/* Console header */}
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="micro-label mb-2.5 flex items-center gap-2">
              <StatusDot tone={q.isError ? "error" : q.isFetching ? "signal" : "live"} pulse={!q.isError} />
              Operations console
            </p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em]">Overview</h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">Your reputation at a glance — every number is calculated from stored records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            {can("campaigns.manage") && (
              <Button asChild><Link href="/app/campaigns/new"><Send /> New campaign</Link></Button>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-background-subtle/60 px-4 py-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-0">
          {[
            { l: "Org", v: membership.organization.name },
            { l: "Scope", v: scope },
            { l: "Period", v: range },
            {
              l: "Data mode",
              v: d ? (
                <span className={cn("inline-flex items-center gap-1.5", d.is_demo ? "text-amber" : "text-mint")}>
                  <StatusDot tone={d.is_demo ? "warn" : "live"} /> {d.is_demo ? "DEMO" : "LIVE"}
                </span>
              ) : "—",
            },
            {
              l: "Last refresh",
              v: (
                <span className="inline-flex items-center gap-2">
                  {refreshedAt}
                  {since && <span className="text-subtle-foreground">+{since}</span>}
                  <button onClick={() => q.refetch()} className="rounded p-0.5 text-subtle-foreground transition hover:text-primary" aria-label="Refresh overview data">
                    <RefreshCw className={cn("size-3", q.isFetching && "animate-spin")} />
                  </button>
                </span>
              ),
            },
          ].map((r, i) => (
            <div key={r.l} className={cn("min-w-0", i > 0 && "lg:border-l lg:border-border lg:pl-5", "lg:pr-5")}>
              <dt className="micro-label">{r.l}</dt>
              <dd className="mt-1 truncate font-mono text-[12px] tabular text-foreground">{r.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {q.isError && !d ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Card>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <HeroInstrument data={d} loading={q.isLoading} />
            <div className="flex flex-col gap-5">
              <SetupChecklist />
              {can("reviews.read") && <PendingResponses pending={stats.data?.pending} negative={stats.data?.negative_pending} loading={!stats.data} index="01" />}
            </div>
          </div>

          <Reveal>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard label="Total reviews" icon={MessagesSquare} accent="primary" loading={!k} value={<AnimatedNumber value={k?.total_reviews} format={int} />} definition={def.total_reviews} footer={d?.is_demo ? "Demo data · sample records" : "Synced from Google"} />
              <StatCard label="Average rating" icon={Star} accent="amber" loading={!k} value={<AnimatedNumber value={k?.average_rating} format={(n) => n.toFixed(2)} />} delta={delta?.period_average_rating} definition={def.average_rating} footer={<span className="font-mono">PERIOD {k?.period_average_rating?.toFixed(2) ?? "—"}★</span>} />
              <StatCard label="New reviews" icon={Inbox} accent="ice" loading={!k} value={<AnimatedNumber value={k?.new_reviews} format={int} />} delta={delta?.new_reviews} definition={def.new_reviews} footer="vs previous period" />
              <StatCard label="Requests sent" icon={Send} accent="mint" loading={!k} value={<AnimatedNumber value={k?.requests_sent} format={int} />} delta={delta?.requests_sent} definition={def.requests_sent} footer={`${formatNumber(k?.requests_delivered)} delivered · ${formatNumber(k?.requests_failed)} failed`} />
              <StatCard label="Google click-through" icon={MousePointerClick} accent="cyan" loading={!k} value={k?.conversion_rate == null ? "—" : <AnimatedNumber value={k.conversion_rate} format={pct} />} delta={delta?.conversion_rate} definition={def.conversion_rate} footer={`${formatNumber(k?.google_clicks)} clicks`} />
              <StatCard label="Response rate" icon={MessageSquareReply} accent="success" loading={!k} value={k?.response_rate == null ? "—" : <AnimatedNumber value={k.response_rate} format={pct} />} delta={delta?.response_rate} definition={def.response_rate} footer="Reviews with an owner reply" />
            </div>
          </Reveal>

          <Reveal className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <PanelHeader index="02" eyebrow="Telemetry" title="Review growth" description={`New reviews per ${d && d.series.length > 120 ? "week" : "day"} and running total`} />
              <div className="p-5 pt-4">{d ? <ReviewGrowthChart data={d.series} /> : <Skeleton className="h-[300px]" />}</div>
            </Card>
            <Card>
              <PanelHeader index="03" eyebrow="Distribution" title="Rating distribution" description="Reviews created in this period" />
              <div className="p-5 pt-5">{d ? <RatingBars data={d.ratings} /> : <Skeleton className="h-48" />}</div>
            </Card>
          </Reveal>

          <Reveal className="grid gap-5 lg:grid-cols-3">
            <Card>
              <PanelHeader index="04" eyebrow="Sentiment" title="Review sentiment" description="Classified from review text and rating" />
              <div className="p-5 pt-5">{d ? <SentimentRing data={d.sentiment} /> : <Skeleton className="h-44" />}</div>
            </Card>
            <Card className="lg:col-span-2">
              <PanelHeader
                index="05"
                eyebrow="Outreach"
                title="Campaign performance"
                description="Requests sent vs. clicks through to Google"
                action={<Link href="/app/campaigns" className="group rounded outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"><PanelLink>All campaigns <ArrowUpRight className="size-3" /></PanelLink></Link>}
              />
              <div className="p-5 pt-4">
                {!d ? <Skeleton className="h-[220px]" /> : d.campaigns.filter((c) => c.channel !== "qr").length ? (
                  <CampaignPerformance data={d.campaigns} />
                ) : (
                  <EmptyState compact icon={Send} title="No campaigns yet" description="Send your first WhatsApp or email review request." action={can("campaigns.manage") ? <Button size="sm" asChild><Link href="/app/campaigns/new">Create campaign</Link></Button> : undefined} />
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2"><RecentReviewsCard reviews={d?.recent_reviews ?? []} index="06" /></div>
            <InsightsCard insights={d?.insights ?? []} index="07" />
          </Reveal>

          <Reveal className="grid gap-5 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <PanelHeader index="08" eyebrow="Branches" title="Location performance" description="Reviews, rating and reply rate per branch" />
              <div className="pt-4">
                {d ? (d.locations.length ? <LocationTable data={d.locations} /> : <p className="px-5 pb-5 text-sm text-muted-foreground">No locations yet.</p>) : <div className="p-5"><Skeleton className="h-32" /></div>}
              </div>
            </Card>
            <QuickActions index="09" />
          </Reveal>
        </>
      )}
    </div>
  );
}
