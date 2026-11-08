"use client";
import * as React from "react";
import { format } from "date-fns";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";
import type { Detailed } from "./types";

export function ReviewTrendChart({ data }: { data: Detailed["series"] }) {
  const short = data.length <= 45;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -8, right: 4, top: 8 }}>
          <GradientDefs id="trend-fill" color="var(--chart-1)" />
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} minTickGap={24} tickFormatter={(d) => format(new Date(d), short ? "d MMM" : "MMM d")} />
          <YAxis yAxisId="n" {...axisProps} allowDecimals={false} width={36} />
          <YAxis yAxisId="r" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} width={28} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "EEE, d MMM yyyy")} valueFormatter={(v, n) => (n === "Avg rating" ? (v == null ? "—" : `${Number(v).toFixed(2)}★`) : formatNumber(Number(v)))} />} />
          <Bar yAxisId="n" dataKey="positive" stackId="r" name="4–5★" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={18} />
          <Bar yAxisId="n" dataKey="negative" stackId="r" name="1–2★" fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Line yAxisId="r" type="monotone" dataKey="avg_rating" name="Avg rating" stroke="var(--warning)" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeChart({ data }: { data: Detailed["series"] }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -8, right: 4 }}>
          <GradientDefs id="cum-fill" color="var(--chart-2)" />
          <XAxis dataKey="date" hide />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "d MMM yyyy")} />} />
          <Area type="monotone" dataKey="cumulative" name="Total reviews" stroke="var(--chart-2)" strokeWidth={2} fill="url(#cum-fill)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const RATING_COLORS: Record<number, string> = { 5: "var(--success)", 4: "var(--chart-2)", 3: "var(--warning)", 2: "#fb923c", 1: "var(--danger)" };

export function RatingBars({ data }: { data: Detailed["ratings"] }) {
  return (
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.rating} className="flex items-center gap-3 text-[13px]">
          <span className="w-7 font-medium tabular text-foreground-soft">{r.rating}★</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${r.share * 100}%`, background: RATING_COLORS[r.rating] }} />
          </div>
          <span className="w-10 text-right tabular font-medium">{formatNumber(r.count)}</span>
          <span className="w-12 text-right tabular text-xs text-muted-foreground">{formatPercent(r.share, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

const SENT_COLORS: Record<string, string> = { positive: "var(--success)", neutral: "var(--subtle-foreground)", negative: "var(--danger)", mixed: "var(--warning)", unclassified: "var(--border-strong)" };
const SOURCE_COLORS: Record<string, string> = { google: "var(--chart-2)", demo: "var(--chart-3)", private_feedback: "var(--chart-4)" };

export function Donut({ items, center }: { items: { key: string; label: string; value: number; color: string }[]; center: React.ReactNode }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? items : [{ key: "empty", label: "", value: 1, color: "var(--muted)" }]} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? items : [{ color: "var(--muted)" }]).map((i, k) => <Cell key={k} fill={i.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={<ChartTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      <ul className="w-full space-y-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 rounded-full" style={{ background: i.color }} />
            <span className="flex-1 text-foreground-soft">{i.label}</span>
            <span className="font-medium tabular">{formatNumber(i.value)}</span>
            <span className="w-11 text-right text-xs tabular text-muted-foreground">{total ? formatPercent(i.value / total, 0) : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SentimentDonut({ data }: { data: Detailed["sentiment"] }) {
  const items = data.map((d) => ({ key: d.sentiment, label: titleCase(d.sentiment), value: d.count, color: SENT_COLORS[d.sentiment] ?? "var(--chart-5)" }));
  const pos = data.find((d) => d.sentiment === "positive")?.count ?? 0;
  const total = data.reduce((a, b) => a + b.count, 0);
  return <Donut items={items} center={<><span className="text-xl font-semibold tabular">{total ? formatPercent(pos / total, 0) : "—"}</span><span className="text-[11px] text-muted-foreground">positive</span></>} />;
}

export function SourceDonut({ data }: { data: Detailed["sources"] }) {
  const items = data.map((d) => ({ key: d.source, label: d.label, value: d.count, color: SOURCE_COLORS[d.source] ?? "var(--chart-5)" }));
  const total = data.reduce((a, b) => a + b.count, 0);
  return <Donut items={items} center={<><span className="text-xl font-semibold tabular">{formatNumber(total)}</span><span className="text-[11px] text-muted-foreground">items</span></>} />;
}

export function TopicsList({ data }: { data: Detailed["topics"] }) {
  const max = Math.max(1, ...data.map((d) => d.mentions));
  return (
    <ul className="space-y-3">
      {data.map((t) => (
        <li key={t.topic}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-medium">{titleCase(t.topic)}</span>
            <span className="flex items-center gap-3 text-xs tabular">
              <span className="text-muted-foreground">{t.mentions} mentions</span>
              <span className={cn("font-semibold", t.avg_rating >= 4 ? "text-success-foreground" : t.avg_rating < 3 ? "text-danger-foreground" : "text-warning-foreground")}>{t.avg_rating.toFixed(1)}★</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(t.mentions / max) * 100}%`, background: t.avg_rating >= 4 ? "var(--success)" : t.avg_rating < 3 ? "var(--danger)" : "var(--warning)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export { Legend };
