"use client";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Star } from "lucide-react";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { StatusBadge } from "@/components/app/status-badge";
import { SegmentMeter } from "@/components/ui/tech";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { SegBar, TickRing } from "./kit";
import type { Overview } from "./types";

/* Review growth — new reviews (area) + running total (line, right axis). */
export function ReviewGrowthChart({ data, height = 260 }: { data: Overview["series"]; height?: number }) {
  const fmt = (d: string | number | undefined) => (typeof d === "string" ? format(parseISO(d), "d MMM") : "");
  const newTotal = data.reduce((a, d) => a + d.reviews, 0);
  const last = data[data.length - 1]?.cumulative;
  const peak = data.reduce<{ date: string; reviews: number } | null>((m, d) => (!m || d.reviews > m.reviews ? d : m), null);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Legend items={[{ label: "New reviews", color: "var(--chart-1)" }, { label: "Running total", color: "var(--chart-2)" }]} />
        <div className="flex gap-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
          <span>Period <span className="ml-1 text-foreground tabular">{formatNumber(newTotal)}</span></span>
          <span>Total <span className="ml-1 text-foreground tabular">{formatNumber(last)}</span></span>
          {peak && peak.reviews > 0 && <span className="hidden sm:inline">Peak <span className="ml-1 text-foreground tabular">{peak.reviews}</span> · {format(parseISO(peak.date), "d MMM")}</span>}
        </div>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
            <GradientDefs id="g-reviews" color="var(--chart-1)" />
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={fmt} minTickGap={32} />
            <YAxis yAxisId="l" {...axisProps} allowDecimals={false} width={44} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} width={36} allowDecimals={false} />
            <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE, d MMM yyyy") : l)} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 3" }} />
            <Area yAxisId="l" type="monotone" dataKey="reviews" name="New reviews" stroke="var(--chart-1)" strokeWidth={1.75} fill="url(#g-reviews)" activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--card)" }} />
            <Line yAxisId="r" type="monotone" dataKey="cumulative" name="Running total" stroke="var(--chart-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const RATING_TONE: Record<number, string> = { 5: "var(--chart-1)", 4: "var(--chart-2)", 3: "var(--amber)", 2: "var(--danger)", 1: "var(--danger)" };

/* Rating distribution as segmented bars. */
export function RatingBars({ data }: { data: Overview["ratings"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  const avg = total ? data.reduce((a, d) => a + d.rating * d.count, 0) / total : null;
  const sorted = [...data].sort((a, b) => b.rating - a.rating);
  return (
    <div>
      <ul className="space-y-3.5">
        {sorted.map((r) => (
          <li key={r.rating} className="grid grid-cols-[34px_minmax(0,1fr)_72px] items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[12px] tabular text-foreground">
              {r.rating}
              <Star className="size-3 fill-amber text-amber" aria-hidden />
            </span>
            <SegBar value={r.count / max} color={RATING_TONE[r.rating]} height={9} />
            <span className="text-right font-mono text-[11px] tabular text-muted-foreground">
              <span className="text-foreground">{formatNumber(r.count)}</span> · {formatPercent(r.share, 0)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
        <span>{formatNumber(total)} reviews in period</span>
        <span>Mean <span className="text-foreground tabular">{avg ? avg.toFixed(2) : "—"}</span></span>
      </div>
    </div>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--success)",
  neutral: "var(--chart-2)",
  mixed: "var(--amber)",
  negative: "var(--danger)",
  unclassified: "var(--chart-5)",
};
const SENT_ORDER = ["positive", "neutral", "mixed", "negative", "unclassified"];

/* Sentiment as a segmented tick ring. */
export function SentimentRing({ data }: { data: Overview["sentiment"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const sorted = [...data].sort((a, b) => SENT_ORDER.indexOf(a.sentiment) - SENT_ORDER.indexOf(b.sentiment));
  const positive = data.find((d) => d.sentiment === "positive")?.count ?? 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col 2xl:flex-row">
      <TickRing
        label={total ? `${Math.round((positive / total) * 100)}% positive sentiment` : "No sentiment data"}
        data={sorted.map((d) => ({ key: d.sentiment, value: d.count, color: SENTIMENT_COLORS[d.sentiment] ?? "var(--chart-5)" }))}
      >
        <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular">{total ? formatPercent(positive / total, 0) : "—"}</span>
        <span className="micro-label mt-1.5">Positive</span>
      </TickRing>
      <ul className="w-full space-y-2">
        {sorted.map((d) => (
          <li key={d.sentiment} className="grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-3 border-b border-border/70 pb-2 text-[12.5px] last:border-0">
            <span className="flex items-center gap-2 capitalize text-muted-foreground">
              <span className="h-2.5 w-[3px] rounded-[1px]" style={{ background: SENTIMENT_COLORS[d.sentiment] }} />
              {d.sentiment}
            </span>
            <span className="font-mono text-[12px] tabular text-foreground">{formatNumber(d.count)}</span>
            <span className="text-right font-mono text-[10.5px] tabular text-subtle-foreground">{total ? formatPercent(d.count / total, 0) : "—"}</span>
          </li>
        ))}
        {!sorted.length && <li className="text-[12.5px] text-muted-foreground">No classified reviews in this period.</li>}
      </ul>
    </div>
  );
}

/* Campaign performance: sent vs Google clicks per campaign, as paired instrument bars. */
export function CampaignPerformance({ data }: { data: Overview["campaigns"] }) {
  const rows = data.filter((c) => c.channel !== "qr").slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.sent));
  return (
    <div>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_64px] gap-4 border-b border-border pb-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_64px]">
        <span className="micro-label">Campaign</span>
        <span className="micro-label hidden sm:block">Sent / Google clicks</span>
        <span className="micro-label text-right">CTR</span>
      </div>
      <ul className="space-y-1">
        {rows.map((c) => (
          <li key={c.campaign_id}>
            <Link href={`/app/campaigns/${c.campaign_id}`} className="group -mx-2 grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-4 gap-y-2 rounded-lg px-2 py-2.5 outline-none transition hover:bg-surface-hover/60 focus-visible:ring-[1.5px] focus-visible:ring-ring sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_64px]">
              <span className="col-start-1 row-start-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{c.name}</span>
                  <StatusBadge status={c.status} />
                </span>
                <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{c.channel} · {formatNumber(c.delivered)} delivered{c.failed ? ` · ${c.failed} failed` : ""}</span>
              </span>
              <span className="col-span-2 col-start-1 row-start-2 space-y-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 rounded-[2px] transition-[width] duration-700" style={{ width: `${(c.sent / max) * 100}%`, minWidth: c.sent ? 3 : 0, background: "var(--chart-1)" }} />
                  <span className="font-mono text-[10.5px] tabular text-muted-foreground">{formatNumber(c.sent)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 rounded-[2px] transition-[width] duration-700" style={{ width: `${(c.google_clicks / max) * 100}%`, minWidth: c.google_clicks ? 3 : 0, background: "var(--chart-4)" }} />
                  <span className="font-mono text-[10.5px] tabular text-muted-foreground">{formatNumber(c.google_clicks)}</span>
                </span>
              </span>
              <span className="col-start-2 row-start-1 text-right font-mono text-[14px] font-medium tabular text-foreground sm:col-start-3">{c.conversion_rate == null ? "—" : formatPercent(c.conversion_rate, 0)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Legend className="mt-3 border-t border-border pt-3" items={[{ label: "Sent", color: "var(--chart-1)" }, { label: "Google clicks", color: "var(--chart-4)" }]} />
    </div>
  );
}

/* Location performance table. */
export function LocationTable({ data }: { data: Overview["locations"] }) {
  const max = Math.max(1, ...data.map((l) => l.reviews));
  return (
    <Table className="min-w-[620px]">
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Location</TH>
          <TH>Reviews</TH>
          <TH>Avg rating</TH>
          <TH>Reply rate</TH>
          <TH className="text-right">Requests</TH>
        </TR>
      </THead>
      <TBody>
        {data.map((l, i) => {
          const rr = l.response_rate ?? 0;
          return (
            <TR key={l.location_id}>
              <TD>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[10.5px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate font-medium text-foreground">{l.name}</span>
                </span>
              </TD>
              <TD>
                <span className="flex items-center gap-3">
                  <span className="w-24"><SegBar value={l.reviews / max} height={8} /></span>
                  <span className="font-mono text-[12px] tabular text-foreground">{formatNumber(l.reviews)}</span>
                </span>
              </TD>
              <TD>
                <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular text-foreground">
                  <Star className="size-3.5 fill-amber text-amber" aria-hidden />
                  {l.avg_rating?.toFixed(2) ?? "—"}
                </span>
              </TD>
              <TD>
                <span className="flex items-center gap-2.5">
                  <SegmentMeter value={rr * 100} segments={10} tone={rr >= 0.7 ? "success" : rr >= 0.4 ? "warning" : "danger"} />
                  <span className="font-mono text-[11.5px] tabular text-muted-foreground">{formatPercent(l.response_rate, 0)}</span>
                </span>
              </TD>
              <TD className="text-right">
                <Link href="/app/review-requests" className={cn("inline-flex items-center gap-1 font-mono text-[12px] tabular text-foreground-soft hover:text-primary")}>
                  {formatNumber(l.requests_sent)}<ArrowUpRight className="size-3 opacity-50" />
                </Link>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
