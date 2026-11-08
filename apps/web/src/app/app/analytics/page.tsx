"use client";
import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Download, FileText, FlaskConical, MessageSquareText, MousePointerClick, QrCode, Reply, Send, Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Legend } from "@/components/app/chart-kit";
import { PeriodFilter, periodQuery, usePeriod } from "@/components/app/period-filter";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { CumulativeChart, RatingBars, ReviewTrendChart, SentimentDonut, SourceDonut, TopicsList } from "@/components/analytics/charts";
import type { Detailed, Kpis } from "@/components/analytics/types";
import { QueryErrorState, ReadOnlyNotice } from "@/components/billing/plan-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";

const DEF_LABELS: Record<string, string> = {
  total_reviews: "Total reviews", average_rating: "Average rating", new_reviews: "New reviews", requests_sent: "Requests sent",
  conversion_rate: "Google click-through", response_rate: "Response rate", qr_scans: "QR scans",
};

export default function AnalyticsPage() {
  const { can, orgId, locationId, locations } = useOrg();
  const [period, setPeriod] = usePeriod("30d");
  const [loc, setLoc] = React.useState(locationId ?? "all");
  const [campaign, setCampaign] = React.useState("all");
  const [channel, setChannel] = React.useState("all");
  const [showDefs, setShowDefs] = React.useState(false);
  const [busy, setBusy] = React.useState<"csv" | "pdf" | null>(null);
  React.useEffect(() => setLoc(locationId ?? "all"), [locationId]);

  const params = { ...periodQuery(period), location_id: loc === "all" ? undefined : loc };
  const query = useQuery({
    queryKey: ["analytics", "detailed", orgId, params, campaign, channel],
    queryFn: () => api.get<Detailed>("/analytics/detailed", { ...params, campaign_id: campaign === "all" ? undefined : campaign, channel: channel === "all" ? undefined : channel }),
    placeholderData: keepPreviousData,
    enabled: can("analytics.read") && (period.period !== "custom" || !!period.date_from),
  });
  const campaigns = useQuery({
    queryKey: ["campaigns", orgId, "for-filter"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>("/campaigns", { page_size: 100 }),
    enabled: can("analytics.read"),
  });

  if (!can("analytics.read")) return <ReadOnlyNotice message="Analytics is available to owners, admins, managers and analysts." />;

  const exportFile = async (kind: "csv" | "pdf") => {
    setBusy(kind);
    try {
      await downloadFile(kind === "csv" ? "/analytics/export.csv" : "/analytics/report.pdf", params, kind === "csv" ? "analytics.csv" : "report.pdf");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const d = query.data;
  const k = d?.kpis;
  const fk: Kpis | undefined = d?.filtered_kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Every metric is computed from stored records. Google review data and private feedback are always reported separately."
        className="mb-0"
        actions={
          <>
            <Button variant="outline" loading={busy === "csv"} onClick={() => exportFile("csv")}><Download /> CSV</Button>
            <Button variant="outline" loading={busy === "pdf"} onClick={() => exportFile("pdf")}><FileText /> PDF report</Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <PeriodFilter value={period} onChange={setPeriod} className="self-start" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:ml-auto xl:flex">
          {locations.length > 1 && (
            <Select value={loc} onValueChange={setLoc}>
              <SelectTrigger size="sm" className="xl:w-48" aria-label="Location"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger size="sm" className="xl:w-52" aria-label="Campaign"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All campaigns</SelectItem>{campaigns.data?.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger size="sm" className="xl:w-40" aria-label="Channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {["whatsapp", "email", "sms", "qr"].map((c) => <SelectItem key={c} value={c}>{c === "qr" ? "QR" : titleCase(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {d?.is_demo && (
        <InlineAlert variant="primary" icon={FlaskConical} title="Demo data">This organization contains sample reviews, customers and simulated messages. Numbers below are for demonstration only.</InlineAlert>
      )}

      {query.error ? (
        <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity", query.isFetching && !query.isLoading && "opacity-70")}>
            <StatCard loading={!k} label="Total reviews" value={formatNumber(k?.total_reviews)} icon={MessageSquareText} definition={d?.definitions.total_reviews} footer={k && `${formatNumber(k.new_reviews)} new in period`} delta={d?.deltas.new_reviews} />
            <StatCard loading={!k} label="Average rating" value={k?.average_rating?.toFixed(2) ?? "—"} icon={Star} accent="warning" definition={d?.definitions.average_rating} footer={k && `Period average ${k.period_average_rating?.toFixed(2) ?? "—"}★`} delta={d?.deltas.period_average_rating} />
            <StatCard loading={!k} label="Google click-through" value={formatPercent((fk ?? k)?.conversion_rate)} icon={MousePointerClick} accent="purple" definition={d?.definitions.conversion_rate} footer={k && `${formatNumber((fk ?? k)!.google_clicks)} clicks · ${formatNumber((fk ?? k)!.requests_sent)} sent`} delta={fk ? null : d?.deltas.conversion_rate} />
            <StatCard loading={!k} label="Response rate" value={formatPercent(k?.response_rate)} icon={Reply} accent="success" definition={d?.definitions.response_rate} delta={d?.deltas.response_rate} footer={d?.responses.avg_response_hours != null ? `Avg reply in ${d.responses.avg_response_hours}h` : "No replies in period"} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard loading={!k} label="Requests sent" value={formatNumber((fk ?? k)?.requests_sent)} icon={Send} accent="blue" definition={d?.definitions.requests_sent} footer={k && `${formatNumber((fk ?? k)!.requests_delivered)} delivered · ${formatNumber((fk ?? k)!.requests_failed)} failed`} />
            <StatCard loading={!k} label="Feedback page opens" value={formatNumber((fk ?? k)?.page_opens)} icon={TrendingUp} accent="cyan" footer="From tracked review-request links" />
            <StatCard loading={!k} label="QR scans" value={formatNumber(k?.qr_scans)} icon={QrCode} accent="primary" definition={d?.definitions.qr_scans} delta={d?.deltas.qr_scans} />
          </div>

          <Card>
            <button onClick={() => setShowDefs((s) => !s)} className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-[13px] font-medium" aria-expanded={showDefs}>
              <BookOpen className="size-4 text-primary" /> Metric definitions
              <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", showDefs && "rotate-180")} />
            </button>
            {showDefs && d && (
              <dl className="grid gap-x-8 gap-y-3 border-t border-border px-5 py-4 md:grid-cols-2">
                {Object.entries(d.definitions).map(([key, text]) => (
                  <div key={key}><dt className="text-[12.5px] font-semibold">{DEF_LABELS[key] ?? titleCase(key)}</dt><dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</dd></div>
                ))}
              </dl>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Card>
              <CardHeader>
                <div><CardTitle>Review volume & rating</CardTitle><CardDescription>Positive (4–5★) and negative (1–2★) reviews with the average rating line</CardDescription></div>
                <Legend className="hidden sm:flex" items={[{ label: "4–5★", color: "var(--chart-1)" }, { label: "1–2★", color: "var(--danger)" }, { label: "Avg rating", color: "var(--warning)" }]} />
              </CardHeader>
              <CardContent>{d ? (d.series.some((s) => s.reviews) ? <ReviewTrendChart data={d.series} /> : <EmptyState compact icon={TrendingUp} title="No reviews in this period" />) : <Skeleton className="h-72" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Rating distribution</CardTitle><CardDescription>Reviews created in the period</CardDescription></div></CardHeader>
              <CardContent className="space-y-6">
                {d ? <RatingBars data={d.ratings} /> : <Skeleton className="h-36" />}
                <div className="border-t border-border pt-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Total reviews over time</p>
                  {d ? <CumulativeChart data={d.series} /> : <Skeleton className="h-40" />}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><div><CardTitle>Sources</CardTitle><CardDescription>Public reviews and private feedback — never merged</CardDescription></div></CardHeader>
              <CardContent>{d ? <SourceDonut data={d.sources} /> : <Skeleton className="h-40" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Sentiment</CardTitle><CardDescription>Classified from review text and rating</CardDescription></div></CardHeader>
              <CardContent>{d ? <SentimentDonut data={d.sentiment} /> : <Skeleton className="h-40" />}</CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Top topics</CardTitle><CardDescription>Mentions and average rating per topic</CardDescription></div></CardHeader>
              <CardContent>{d ? (d.topics.length ? <TopicsList data={d.topics.slice(0, 6)} /> : <p className="text-[13px] text-muted-foreground">No topics detected in this period.</p>) : <Skeleton className="h-40" />}</CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="pb-4"><div><CardTitle>Locations</CardTitle><CardDescription>Compare performance across branches</CardDescription></div></CardHeader>
              {d ? (
                <Table>
                  <THead><TR className="hover:bg-transparent"><TH>Location</TH><TH className="text-right">Reviews</TH><TH className="text-right">Avg</TH><TH className="text-right">Response</TH><TH className="text-right">Requests</TH></TR></THead>
                  <TBody>
                    {d.locations.map((l) => (
                      <TR key={l.location_id}>
                        <TD className="font-medium text-foreground"><Link href={`/app/locations/${l.location_id}`} className="hover:underline">{l.name}</Link></TD>
                        <TD className="text-right tabular">{formatNumber(l.reviews)}</TD>
                        <TD className="text-right tabular">{l.avg_rating ? `${l.avg_rating.toFixed(2)}★` : "—"}</TD>
                        <TD className="text-right tabular">{formatPercent(l.response_rate, 0)}</TD>
                        <TD className="text-right tabular">{formatNumber(l.requests_sent)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : <div className="p-5"><Skeleton className="h-40" /></div>}
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Delivery by channel</CardTitle><CardDescription>Review requests created in the period</CardDescription></div></CardHeader>
              <CardContent>
                {!d ? <Skeleton className="h-40" /> : !d.channels.length ? <EmptyState compact icon={Send} title="No requests sent in this period" /> : (
                  <div className="space-y-4">
                    {d.channels.map((c) => {
                      const total = Math.max(1, c.sent + c.failed + c.skipped);
                      return (
                        <div key={c.channel}>
                          <div className="mb-1.5 flex items-center justify-between text-[13px]">
                            <span className="font-medium">{titleCase(c.channel)}</span>
                            <span className="text-xs tabular text-muted-foreground">{formatNumber(c.sent)} sent · {formatNumber(c.google_clicks)} Google clicks</span>
                          </div>
                          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                            <div className="bg-success" style={{ width: `${(c.delivered / total) * 100}%` }} title="Delivered" />
                            <div className="bg-blue" style={{ width: `${(Math.max(0, c.sent - c.delivered) / total) * 100}%` }} title="Sent" />
                            <div className="bg-danger" style={{ width: `${(c.failed / total) * 100}%` }} title="Failed" />
                            <div className="bg-border-strong" style={{ width: `${(c.skipped / total) * 100}%` }} title="Skipped" />
                          </div>
                        </div>
                      );
                    })}
                    <Legend items={[{ label: "Delivered", color: "var(--success)" }, { label: "Sent", color: "var(--blue)" }, { label: "Failed", color: "var(--danger)" }, { label: "Skipped (no consent / opted out)", color: "var(--border-strong)" }]} />
                  </div>
                )}
                {d && (
                  <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-4">
                    {([["Pending", d.responses.pending, "text-warning-foreground"], ["Responded", d.responses.responded, "text-success-foreground"], ["Handled", d.responses.handled, "text-foreground"]] as const).map(([l, v, c]) => (
                      <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className={cn("mt-0.5 text-xl font-semibold tabular", c)}>{formatNumber(v)}</p></div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4"><div><CardTitle>Campaign performance</CardTitle><CardDescription>Google click-through = clicks on “Review on Google” ÷ requests sent. We can't confirm a review was posted.</CardDescription></div></CardHeader>
            {!d ? <div className="p-5"><Skeleton className="h-40" /></div> : !d.campaigns.length ? <EmptyState compact icon={Send} title="No campaigns yet" action={<Button asChild size="sm"><Link href="/app/campaigns">Create a campaign</Link></Button>} /> : (
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Campaign</TH><TH className="hidden sm:table-cell">Status</TH><TH className="text-right">Sent</TH><TH className="hidden md:table-cell text-right">Delivered</TH><TH className="hidden md:table-cell text-right">Failed</TH><TH className="text-right">Opens</TH><TH className="text-right">Google</TH><TH className="text-right">CTR</TH></TR></THead>
                <TBody>
                  {d.campaigns.map((c) => (
                    <TR key={c.campaign_id}>
                      <TD><Link href={`/app/campaigns/${c.campaign_id}`} className="font-medium text-foreground hover:underline">{c.name}</Link><span className="block text-xs text-muted-foreground">{c.channel === "qr" ? "QR" : titleCase(c.channel)}</span></TD>
                      <TD className="hidden sm:table-cell"><StatusBadge status={c.status} /></TD>
                      <TD className="text-right tabular">{formatNumber(c.sent)}</TD>
                      <TD className="hidden md:table-cell text-right tabular">{formatNumber(c.delivered)}</TD>
                      <TD className={cn("hidden md:table-cell text-right tabular", c.failed && "text-danger-foreground")}>{formatNumber(c.failed)}</TD>
                      <TD className="text-right tabular">{formatNumber(c.clicks)}</TD>
                      <TD className="text-right tabular">{formatNumber(c.google_clicks)}</TD>
                      <TD className="text-right tabular font-medium">{formatPercent(c.conversion_rate)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4"><div><CardTitle>Monthly report</CardTitle><CardDescription>Last six months, all locations</CardDescription></div></CardHeader>
            {!d ? <div className="p-5"><Skeleton className="h-32" /></div> : (
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Month</TH><TH className="text-right">Reviews</TH><TH className="text-right">Avg rating</TH><TH className="text-right">Response rate</TH><TH className="text-right">Requests</TH><TH className="text-right">Google clicks</TH></TR></THead>
                <TBody>
                  {[...d.monthly].reverse().map((m) => (
                    <TR key={m.month}>
                      <TD className="font-medium text-foreground">{new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</TD>
                      <TD className="text-right tabular">{formatNumber(m.reviews)}</TD>
                      <TD className="text-right tabular">{m.avg_rating ? `${m.avg_rating.toFixed(2)}★` : "—"}</TD>
                      <TD className="text-right tabular">{formatPercent(m.response_rate, 0)}</TD>
                      <TD className="text-right tabular">{formatNumber(m.requests_sent)}</TD>
                      <TD className="text-right tabular">{formatNumber(m.google_clicks)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
