"use client";
import * as React from "react";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Star } from "lucide-react";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { Overview } from "./types";

export function ReviewGrowthChart({ data, height = 260 }: { data: Overview["series"]; height?: number }) {
  const fmt = (d: string | number | undefined) => (typeof d === "string" ? format(parseISO(d), "d MMM") : "");
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <GradientDefs id="g-reviews" color="var(--chart-1)" />
          <defs>
            <linearGradient id="g-cumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={fmt} minTickGap={28} />
          <YAxis yAxisId="l" {...axisProps} allowDecimals={false} width={44} />
          <YAxis yAxisId="r" orientation="right" {...axisProps} hide />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE, d MMM yyyy") : l)} />} cursor={{ stroke: "var(--border-strong)" }} />
          <Area yAxisId="r" type="monotone" dataKey="cumulative" name="Total reviews" stroke="var(--chart-2)" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#g-cumulative)" />
          <Area yAxisId="l" type="monotone" dataKey="reviews" name="New reviews" stroke="var(--chart-1)" strokeWidth={2.25} fill="url(#g-reviews)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const RATING_COLORS: Record<number, string> = { 5: "var(--success)", 4: "#22c55e", 3: "var(--warning)", 2: "#fb923c", 1: "var(--danger)" };

export function RatingBars({ data }: { data: Overview["ratings"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.rating} className="flex items-center gap-3">
          <span className="flex w-8 shrink-0 items-center gap-1 text-[13px] font-medium tabular text-foreground">
            {r.rating}
            <Star className="size-3 fill-[#f5a524] text-[#f5a524]" />
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(r.count / max) * 100}%`, background: RATING_COLORS[r.rating] }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular text-muted-foreground">
            <span className="font-semibold text-foreground">{formatNumber(r.count)}</span> · {formatPercent(r.share, 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--success)",
  neutral: "var(--chart-2)",
  mixed: "var(--warning)",
  negative: "var(--danger)",
  unclassified: "var(--border-strong)",
};

export function SentimentDonut({ data }: { data: Overview["sentiment"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const order = ["positive", "neutral", "mixed", "negative", "unclassified"];
  const sorted = [...data].sort((a, b) => order.indexOf(a.sentiment) - order.indexOf(b.sentiment));
  const positive = data.find((d) => d.sentiment === "positive")?.count ?? 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sorted} dataKey="count" nameKey="sentiment" innerRadius="70%" outerRadius="100%" paddingAngle={total ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
              {sorted.map((d) => (
                <Cell key={d.sentiment} fill={SENTIMENT_COLORS[d.sentiment] ?? "var(--muted)"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular tracking-tight">{total ? formatPercent(positive / total, 0) : "—"}</span>
          <span className="text-[11px] text-muted-foreground">positive</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {sorted.map((d) => (
          <li key={d.sentiment} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 capitalize text-muted-foreground">
              <span className="size-2.5 rounded-[3px]" style={{ background: SENTIMENT_COLORS[d.sentiment] }} />
              {d.sentiment}
            </span>
            <span className="tabular font-medium">{formatNumber(d.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampaignBars({ data, height = 220 }: { data: Overview["campaigns"]; height?: number }) {
  const rows = data.filter((c) => c.channel !== "qr").map((c) => ({ ...c, short: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name }));
  return (
    <div>
      <Legend className="mb-3" items={[{ label: "Sent", color: "var(--chart-1)" }, { label: "Google clicks", color: "var(--chart-4)" }]} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, left: -22, bottom: 0 }} barGap={4}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="short" {...axisProps} interval={0} tick={{ fontSize: 10.5 }} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Bar dataKey="sent" name="Sent" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={22} />
            <Bar dataKey="google_clicks" name="Google clicks" fill="var(--chart-4)" radius={[5, 5, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LocationTable({ data }: { data: Overview["locations"] }) {
  const max = Math.max(1, ...data.map((l) => l.reviews));
  return (
    <div className="divide-y divide-border">
      {data.map((l, i) => (
        <div key={l.location_id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", ["bg-primary-soft text-primary-soft-foreground", "bg-blue-soft text-blue", "bg-purple-soft text-purple", "bg-cyan-soft text-cyan"][i % 4])}>
              {l.name[0]}
            </span>
            <span className="truncate text-[13px] font-medium">{l.name}</span>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(l.reviews / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-xs tabular text-muted-foreground">{l.reviews}</span>
          </div>
          <span className="flex items-center gap-1 text-[13px] font-semibold tabular">
            <Star className="size-3.5 fill-[#f5a524] text-[#f5a524]" />
            {l.avg_rating?.toFixed(2) ?? "—"}
          </span>
          <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{formatPercent(l.response_rate, 0)} replied</span>
        </div>
      ))}
    </div>
  );
}
