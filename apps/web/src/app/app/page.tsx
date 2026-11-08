"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Inbox, MessageSquareReply, MousePointerClick, Send, Star, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/app/stat-card";
import { PeriodFilter, periodQuery, usePeriod } from "@/components/app/period-filter";
import { CampaignBars, LocationTable, RatingBars, ReviewGrowthChart, SentimentDonut } from "@/components/dashboard/charts";
import { CampaignsMini, HeroCard, InsightsCard, QuickActions, RecentReviewsCard, SetupChecklist } from "@/components/dashboard/sections";
import type { Overview } from "@/components/dashboard/types";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function OverviewPage() {
  const { orgId, locationId, can } = useOrg();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your reputation at a glance — every number is calculated from stored records."
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            {can("campaigns.manage") && (
              <Button asChild><Link href="/app/campaigns/new"><Send /> New campaign</Link></Button>
            )}
          </>
        }
      />

      {q.isError && !d ? (
        <Card><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <HeroCard data={d} loading={q.isLoading} />
            <SetupChecklist />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Total reviews" icon={MessagesSquare} accent="primary" loading={!k} value={formatNumber(k?.total_reviews)} definition={def.total_reviews} footer={d?.is_demo ? "Demo data" : "Synced from Google"} />
            <StatCard label="Average rating" icon={Star} accent="warning" loading={!k} value={k?.average_rating?.toFixed(2) ?? "—"} delta={delta?.period_average_rating} definition={def.average_rating} footer={`Period: ${k?.period_average_rating?.toFixed(2) ?? "—"}★`} />
            <StatCard label="New reviews" icon={Inbox} accent="blue" loading={!k} value={formatNumber(k?.new_reviews)} delta={delta?.new_reviews} definition={def.new_reviews} footer="vs previous period" />
            <StatCard label="Requests sent" icon={Send} accent="purple" loading={!k} value={formatNumber(k?.requests_sent)} delta={delta?.requests_sent} definition={def.requests_sent} footer={`${formatNumber(k?.requests_delivered)} delivered`} />
            <StatCard label="Google click-through" icon={MousePointerClick} accent="cyan" loading={!k} value={formatPercent(k?.conversion_rate)} delta={delta?.conversion_rate} definition={def.conversion_rate} footer={`${formatNumber(k?.google_clicks)} clicks`} />
            <StatCard label="Response rate" icon={MessageSquareReply} accent="success" loading={!k} value={formatPercent(k?.response_rate)} delta={delta?.response_rate} definition={def.response_rate} footer="Reviews with an owner reply" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Review growth</CardTitle>
                  <CardDescription>New reviews per {d && d.series.length > 120 ? "week" : "day"} and running total</CardDescription>
                </div>
              </CardHeader>
              <CardContent>{d ? <ReviewGrowthChart data={d.series} /> : <Skeleton className="h-[260px]" />}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Rating distribution</CardTitle>
                  <CardDescription>Reviews created in this period</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-6">{d ? <RatingBars data={d.ratings} /> : <Skeleton className="h-40" />}</CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><div><CardTitle>Review sentiment</CardTitle><CardDescription>Classified from review text and rating</CardDescription></div></CardHeader>
              <CardContent className="pt-5">{d ? <SentimentDonut data={d.sentiment} /> : <Skeleton className="h-40" />}</CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <div><CardTitle>Campaign performance</CardTitle><CardDescription>Requests sent vs. clicks through to Google</CardDescription></div>
                <Button variant="ghost" size="xs" asChild><Link href="/app/campaigns">All campaigns <ArrowRight /></Link></Button>
              </CardHeader>
              <CardContent>
                {!d ? <Skeleton className="h-[220px]" /> : d.campaigns.filter((c) => c.channel !== "qr").length ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <CampaignBars data={d.campaigns} />
                    <CampaignsMini campaigns={d.campaigns} />
                  </div>
                ) : (
                  <EmptyState compact icon={Send} title="No campaigns yet" description="Send your first WhatsApp or email review request." action={<Button size="sm" asChild><Link href="/app/campaigns/new">Create campaign</Link></Button>} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><RecentReviewsCard reviews={d?.recent_reviews ?? []} /></div>
            <InsightsCard insights={d?.insights ?? []} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><div><CardTitle>Location performance</CardTitle><CardDescription>Reviews, rating and reply rate per branch</CardDescription></div></CardHeader>
              <CardContent className="pt-5">{d ? (d.locations.length ? <LocationTable data={d.locations} /> : <p className="text-sm text-muted-foreground">No locations yet.</p>) : <Skeleton className="h-32" />}</CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div><CardTitle>Pending responses</CardTitle><CardDescription>Recent reviews still waiting for a reply</CardDescription></div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-semibold tabular tracking-tight">{stats.data ? formatNumber(stats.data.pending) : "—"}</span>
                    <Button size="sm" variant="soft" asChild><Link href="/app/reviews?status=pending">Reply now <ArrowRight /></Link></Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.data?.negative_pending ? <span className="font-medium text-danger-foreground">{stats.data.negative_pending} negative</span> : "No negative reviews"} waiting — reply within 24h to show customers you care.
                  </p>
                </CardContent>
              </Card>
              <QuickActions />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
