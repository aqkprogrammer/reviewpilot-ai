"use client";
import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, ChevronDown, Download, FileText, FlaskConical, MessageSquareText, MousePointerClick, QrCode, Reply, Send, Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Legend } from "@/components/app/chart-kit";
import { PeriodFilter, periodQuery, usePeriod } from "@/components/app/period-filter";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { CumulativeChart, RatingBars, ReviewTrendChart, SentimentDonut, SourceDonut, TopicsList } from "@/components/analytics/charts";
import type { Detailed, Kpis } from "@/components/analytics/types";
import { QueryErrorState, ReadOnlyNotice } from "@/components/billing/plan-gate";
import { Eyebrow, MeterBar, Panel } from "@/components/console/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { AnimatedNumber, Reveal, StatusDot } from "@/components/ui/tech";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";

const DEF_LABELS: Record<string, string> = {
  total_reviews: "Total reviews", average_rating: "Average rating", new_reviews: "New reviews", requests_sent: "Requests sent",
  conversion_rate: "Google click-through", response_rate: "Response rate", qr_scans: "QR scans",
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const CH = (c: string) => ({ qr: "QR", sms: "SMS", whatsapp: "WhatsApp" })[c] ?? titleCase(c);

export default function AnalyticsPage() {
  const reduce = useReducedMotion();
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
      toast.success(kind === "csv" ? "CSV export downloaded" : "PDF report downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const d = query.data;
  const k = d?.kpis;
  const fk: Kpis | undefined = d?.filtered_kpis;
  const scoped = fk ?? k;
  const filteredBy = [campaign !== "all" && "campaign", channel !== "all" && "channel"].filter(Boolean) as string[];
  const maxLocReviews = Math.max(1, ...(d?.locations.map((l) => l.reviews) ?? [1]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        className="mb-0"
        eyebrow={<Eyebrow parts={["Intelligence", "Performance analytics"]} />}
        description="Every metric is computed from stored records. Google review data and private feedback are always reported separately."
        actions={
          <>
            <Button variant="outline" loading={busy === "csv"} onClick={() => exportFile("csv")}><Download /> CSV</Button>
            <Button variant="outline" loading={busy === "pdf"} onClick={() => exportFile("pdf")}><FileText /> PDF report</Button>
          </>
        }
      />

      {/* Control strip */}
      <Card className="p-3 sm:p-4">
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
                {["whatsapp", "email", "sms", "qr"].map((c) => <SelectItem key={c} value={c}>{CH(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">
          <span className="flex items-center gap-2"><StatusDot tone={query.isFetching ? "signal" : "ok"} pulse={query.isFetching} />{query.isFetching ? "Computing" : "Up to date"}</span>
          {d?.range && <span>Range <span className="text-foreground-soft">{format(new Date(d.range.start), "d MMM yyyy")} → {format(new Date(d.range.end), "d MMM yyyy")}</span></span>}
          {d && <span>Points <span className="text-foreground-soft">{d.series.length}</span></span>}
          {filteredBy.length > 0 && <span className="text-primary">Funnel metrics filtered by {filteredBy.join(" + ")}</span>}
          {d?.is_demo && <Badge variant="amber" mono size="sm" className="ml-auto"><FlaskConical />Demo data</Badge>}
        </div>
      </Card>

      {d?.is_demo && (
        <p className="-mt-2 flex items-start gap-2 text-[12.5px] text-muted-foreground"><FlaskConical className="mt-0.5 size-3.5 shrink-0 text-amber" />This organization contains sample reviews, customers and simulated messages. Numbers below are for demonstration only.</p>
      )}

      {query.error ? (
        <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity", query.isFetching && !query.isLoading && "opacity-70")}>
            <StatCard loading={!k} label="Total reviews" value={<AnimatedNumber value={k?.total_reviews} />} icon={MessageSquareText} definition={d?.definitions.total_reviews} footer={k && <span className="font-mono">{formatNumber(k.new_reviews)} new in period</span>} delta={d?.deltas.new_reviews} />
            <StatCard loading={!k} label="Average rating" value={<AnimatedNumber value={k?.average_rating} format={(n) => n.toFixed(2)} />} icon={Star} accent="amber" definition={d?.definitions.average_rating} footer={k && <span className="font-mono">Period avg {k.period_average_rating?.toFixed(2) ?? "—"}★</span>} delta={d?.deltas.period_average_rating} />
            <StatCard loading={!k} label="Google click-through" value={scoped?.conversion_rate == null ? "—" : <AnimatedNumber value={scoped.conversion_rate} format={pct} />} icon={MousePointerClick} accent="mint" definition={d?.definitions.conversion_rate} footer={scoped && <span className="font-mono">{formatNumber(scoped.google_clicks)} clicks · {formatNumber(scoped.requests_sent)} sent</span>} delta={fk ? null : d?.deltas.conversion_rate} />
            <StatCard loading={!k} label="Response rate" value={k?.response_rate == null ? "—" : <AnimatedNumber value={k.response_rate} format={pct} />} icon={Reply} accent="success" definition={d?.definitions.response_rate} delta={d?.deltas.response_rate} footer={<span className="font-mono">{d?.responses.avg_response_hours != null ? `Avg reply in ${d.responses.avg_response_hours}h` : "No replies in period"}</span>} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard loading={!k} label="Requests sent" value={<AnimatedNumber value={scoped?.requests_sent} />} icon={Send} accent="ice" definition={d?.definitions.requests_sent} footer={scoped && <span className="font-mono">{formatNumber(scoped.requests_delivered)} delivered · {formatNumber(scoped.requests_failed)} failed</span>} />
            <StatCard loading={!k} label="Feedback page opens" value={<AnimatedNumber value={scoped?.page_opens} />} icon={TrendingUp} accent="cyan" footer="From tracked review-request links" />
            <StatCard loading={!k} label="QR scans" value={<AnimatedNumber value={k?.qr_scans} />} icon={QrCode} accent="primary" definition={d?.definitions.qr_scans} delta={d?.deltas.qr_scans} />
          </div>

          <Card className="overflow-hidden">
            <button onClick={() => setShowDefs((s) => !s)} className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-[13px] font-medium transition-colors hover:bg-surface-hover/50" aria-expanded={showDefs} aria-controls="metric-defs">
              <BookOpen className="size-4 text-primary" /> Metric definitions
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{d ? Object.keys(d.definitions).length : 0} entries</span>
              <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", showDefs && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {showDefs && d && (
                <motion.div id="metric-defs" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                  <dl className="grid gap-px border-t border-border bg-border md:grid-cols-2">
                    {Object.entries(d.definitions).map(([key, text]) => (
                      <div key={key} className="bg-card px-5 py-3.5">
                        <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-primary">{DEF_LABELS[key] ?? titleCase(key)}</dt>
                        <dd className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{text}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Reveal>
            <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
              <Panel index="01" label="Volume" title="Review volume & rating" description="Positive (4–5★) and negative (1–2★) reviews with the average rating line"
                actions={<Legend className="hidden sm:flex" items={[{ label: "4–5★", color: "var(--chart-1)" }, { label: "1–2★", color: "var(--danger)" }, { label: "Avg rating", color: "var(--chart-4)" }]} />}>
                {d ? (d.series.some((s) => s.reviews) ? <ReviewTrendChart data={d.series} /> : <EmptyState compact icon={TrendingUp} title="No reviews in this period" />) : <Skeleton className="h-72" />}
              </Panel>
              <Panel index="02" label="Distribution" title="Rating distribution" description="Reviews created in the period">
                <div className="space-y-5">
                  {d ? <RatingBars data={d.ratings} /> : <Skeleton className="h-36" />}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-baseline justify-between"><p className="micro-label">Total reviews over time</p>{d?.series.length ? <span className="font-mono text-[12px] tabular text-foreground">{formatNumber(d.series[d.series.length - 1].cumulative)}</span> : null}</div>
                    {d ? <CumulativeChart data={d.series} /> : <Skeleton className="mt-2 h-36" />}
                  </div>
                </div>
              </Panel>
            </div>
          </Reveal>

          <Reveal>
            <div className="grid gap-5 lg:grid-cols-3">
              <Panel index="03" label="Sources" title="Where reviews come from" description="Google, demo and private feedback — never merged">
                {d ? <SourceDonut data={d.sources} /> : <Skeleton className="h-40" />}
              </Panel>
              <Panel index="04" label="Sentiment" title="Sentiment" description="Classified from review text and rating">
                {d ? <SentimentDonut data={d.sentiment} /> : <Skeleton className="h-40" />}
              </Panel>
              <Panel index="05" label="Topics" title="Top topics" description="Mentions and average rating per topic">
                {d ? (d.topics.length ? <TopicsList data={d.topics.slice(0, 6)} /> : <p className="text-[13px] text-muted-foreground">No topics detected in this period.</p>) : <Skeleton className="h-40" />}
              </Panel>
            </div>
          </Reveal>

          <Reveal>
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel index="06" label="Comparison" title="Locations" description="Compare performance across branches" flush>
                {d ? (
                  <Table>
                    <THead><TR className="hover:bg-transparent"><TH>Location</TH><TH className="text-right">Reviews</TH><TH className="text-right">Avg</TH><TH className="text-right">Response</TH><TH className="hidden sm:table-cell text-right">Requests</TH></TR></THead>
                    <TBody>
                      {d.locations.map((l) => (
                        <TR key={l.location_id}>
                          <TD className="min-w-[160px]">
                            <Link href={`/app/locations/${l.location_id}`} className="font-medium text-foreground transition-colors hover:text-primary">{l.name}</Link>
                            <MeterBar value={l.reviews} max={maxLocReviews} tone="ice" className="mt-1.5 max-w-40" />
                          </TD>
                          <TD className="text-right font-mono tabular">{formatNumber(l.reviews)}</TD>
                          <TD className={cn("text-right font-mono tabular", l.avg_rating != null && (l.avg_rating >= 4 ? "text-success-foreground" : l.avg_rating < 3 ? "text-danger-foreground" : "text-warning-foreground"))}>{l.avg_rating ? `${l.avg_rating.toFixed(2)}★` : "—"}</TD>
                          <TD className="text-right font-mono tabular">{formatPercent(l.response_rate, 0)}</TD>
                          <TD className="hidden sm:table-cell text-right font-mono tabular">{formatNumber(l.requests_sent)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : <div className="p-5"><Skeleton className="h-40" /></div>}
              </Panel>
              <Panel index="07" label="Delivery" title="Delivery by channel" description="Review requests created in the period">
                {!d ? <Skeleton className="h-40" /> : !d.channels.length ? <EmptyState compact icon={Send} title="No requests sent in this period" /> : (
                  <div className="space-y-4">
                    {d.channels.map((c) => {
                      const total = Math.max(1, c.sent + c.failed + c.skipped);
                      const segs = [
                        { w: c.delivered, cls: "bg-success", t: "Delivered" },
                        { w: Math.max(0, c.sent - c.delivered), cls: "bg-ice", t: "Sent" },
                        { w: c.failed, cls: "bg-danger", t: "Failed" },
                        { w: c.skipped, cls: "bg-border-strong", t: "Skipped" },
                      ];
                      return (
                        <div key={c.channel}>
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                            <span className="font-medium">{CH(c.channel)}</span>
                            <span className="font-mono text-[11px] tabular text-muted-foreground">{formatNumber(c.sent)} sent · {formatNumber(c.google_clicks)} Google clicks</span>
                          </div>
                          <div className="flex h-2 gap-px overflow-hidden rounded-[3px] bg-muted">
                            {segs.map((s) => s.w > 0 && (
                              <motion.div key={s.t} className={s.cls} title={`${s.t}: ${s.w}`} initial={reduce ? false : { width: 0 }} animate={{ width: `${(s.w / total) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <Legend items={[{ label: "Delivered", color: "var(--success)" }, { label: "Sent", color: "var(--ice)" }, { label: "Failed", color: "var(--danger)" }, { label: "Skipped (no consent / opted out)", color: "var(--border-strong)" }]} />
                  </div>
                )}
                {d && (
                  <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
                    {([["Pending", d.responses.pending, "text-warning-foreground"], ["Responded", d.responses.responded, "text-success-foreground"], ["Handled", d.responses.handled, "text-foreground"]] as const).map(([l, v, c]) => (
                      <div key={l} className="bg-card px-4 py-3"><p className="micro-label">{l}</p><p className={cn("mt-1 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular", c)}><AnimatedNumber value={v} /></p></div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </Reveal>

          <Reveal>
            <Panel index="08" label="Campaigns" title="Campaign performance" flush description="Google click-through = clicks on “Review on Google” ÷ requests sent. We can't confirm a review was posted.">
              {!d ? <div className="p-5"><Skeleton className="h-40" /></div> : !d.campaigns.length ? <EmptyState compact icon={Send} title="No campaigns yet" action={<Button asChild size="sm"><Link href="/app/campaigns">Create a campaign</Link></Button>} /> : (
                <Table>
                  <THead><TR className="hover:bg-transparent"><TH>Campaign</TH><TH className="hidden sm:table-cell">Status</TH><TH className="text-right">Sent</TH><TH className="hidden md:table-cell text-right">Delivered</TH><TH className="hidden md:table-cell text-right">Failed</TH><TH className="text-right">Opens</TH><TH className="text-right">Google</TH><TH className="text-right">CTR</TH></TR></THead>
                  <TBody>
                    {d.campaigns.map((c) => (
                      <TR key={c.campaign_id}>
                        <TD className="min-w-[160px]"><Link href={`/app/campaigns/${c.campaign_id}`} className="font-medium text-foreground transition-colors hover:text-primary">{c.name}</Link><span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{CH(c.channel)}</span></TD>
                        <TD className="hidden sm:table-cell"><StatusBadge status={c.status} /></TD>
                        <TD className="text-right font-mono tabular">{formatNumber(c.sent)}</TD>
                        <TD className="hidden md:table-cell text-right font-mono tabular">{formatNumber(c.delivered)}</TD>
                        <TD className={cn("hidden md:table-cell text-right font-mono tabular", c.failed && "text-danger-foreground")}>{formatNumber(c.failed)}</TD>
                        <TD className="text-right font-mono tabular">{formatNumber(c.clicks)}</TD>
                        <TD className="text-right font-mono tabular">{formatNumber(c.google_clicks)}</TD>
                        <TD className="text-right font-mono font-medium tabular text-primary">{formatPercent(c.conversion_rate)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Panel>
          </Reveal>

          <Reveal>
            <Panel index="09" label="Report" title="Monthly report" description="Last six months, all locations" flush
              actions={<Button variant="ghost" size="xs" loading={busy === "pdf"} onClick={() => exportFile("pdf")}><FileText /> Export PDF</Button>}>
              {!d ? <div className="p-5"><Skeleton className="h-32" /></div> : (
                <Table>
                  <THead><TR className="hover:bg-transparent"><TH>Month</TH><TH className="text-right">Reviews</TH><TH className="text-right">Avg rating</TH><TH className="text-right">Response</TH><TH className="hidden sm:table-cell text-right">Requests</TH><TH className="text-right">Google clicks</TH></TR></THead>
                  <TBody>
                    {[...d.monthly].reverse().map((m) => (
                      <TR key={m.month}>
                        <TD className="whitespace-nowrap font-medium text-foreground">
                          {new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                        </TD>
                        <TD className="text-right font-mono tabular">{formatNumber(m.reviews)}</TD>
                        <TD className="text-right font-mono tabular">{m.avg_rating ? `${m.avg_rating.toFixed(2)}★` : "—"}</TD>
                        <TD className="text-right font-mono tabular">{formatPercent(m.response_rate, 0)}</TD>
                        <TD className="hidden sm:table-cell text-right font-mono tabular">{formatNumber(m.requests_sent)}</TD>
                        <TD className="text-right font-mono tabular">{formatNumber(m.google_clicks)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Panel>
          </Reveal>
        </>
      )}
    </div>
  );
}
