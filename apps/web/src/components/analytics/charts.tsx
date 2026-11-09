"use client";
import * as React from "react";
import { format } from "date-fns";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { MeterBar } from "@/components/console/kit";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";
import type { Detailed } from "./types";

export function ReviewTrendChart({ data }: { data: Detailed["series"] }) {
  const short = data.length <= 45;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -8, right: 4, top: 8 }}>
          <GradientDefs id="trend-pos" color="var(--chart-1)" />
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} minTickGap={24} tickFormatter={(d) => format(new Date(d), short ? "d MMM" : "MMM d")} />
          <YAxis yAxisId="n" {...axisProps} allowDecimals={false} width={36} />
          <YAxis yAxisId="r" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} width={28} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "EEE, d MMM yyyy")} valueFormatter={(v, n) => (n === "Avg rating" ? (v == null ? "—" : `${Number(v).toFixed(2)}★`) : formatNumber(Number(v)))} />} />
          <Bar yAxisId="n" dataKey="positive" stackId="r" name="4–5★" fill="url(#trend-pos)" stroke="var(--chart-1)" strokeWidth={1} maxBarSize={16} />
          <Bar yAxisId="n" dataKey="negative" stackId="r" name="1–2★" fill="var(--danger)" fillOpacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={16} />
          <Line yAxisId="r" type="monotone" dataKey="avg_rating" name="Avg rating" stroke="var(--chart-4)" strokeWidth={1.75} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeChart({ data }: { data: Detailed["series"] }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
          <GradientDefs id="cum-fill" color="var(--chart-2)" />
          <XAxis dataKey="date" hide />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => format(new Date(String(l)), "d MMM yyyy")} />} />
          <Area type="monotone" dataKey="cumulative" name="Total reviews" stroke="var(--chart-2)" strokeWidth={1.75} fill="url(#cum-fill)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const RATING_TONE = { 5: "success", 4: "ice", 3: "amber", 2: "warning", 1: "danger" } as const;

export function RatingBars({ data }: { data: Detailed["ratings"] }) {
  const max = Math.max(0.0001, ...data.map((r) => r.share));
  return (
    <ul className="space-y-2.5">
      {data.map((r) => (
        <li key={r.rating} className="grid grid-cols-[28px_minmax(0,1fr)_44px_40px] items-center gap-3 text-[13px]">
          <span className="font-mono text-[12px] tabular text-foreground-soft">{r.rating}★</span>
          <MeterBar value={r.share} max={max} tone={RATING_TONE[r.rating as 1 | 2 | 3 | 4 | 5] ?? "muted"} className="h-1.5" />
          <span className="text-right font-mono text-[12px] tabular text-foreground">{formatNumber(r.count)}</span>
          <span className="text-right font-mono text-[11px] tabular text-subtle-foreground">{formatPercent(r.share, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

const SENT_COLORS: Record<string, string> = { positive: "var(--success)", neutral: "var(--chart-5)", negative: "var(--danger)", mixed: "var(--warning)", unclassified: "var(--border-strong)" };
/** Google, demo and private feedback are distinct sources — each keeps its own colour and row. */
const SOURCE_COLORS: Record<string, string> = { google: "var(--chart-2)", demo: "var(--chart-3)", private_feedback: "var(--chart-4)" };

export function Donut({ items, center }: { items: { key: string; label: string; value: number; color: string }[]; center: React.ReactNode }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
      <div className="relative size-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? items : [{ key: "empty", label: "", value: 1, color: "var(--muted)" }]} dataKey="value" nameKey="label" innerRadius={50} outerRadius={66} paddingAngle={total ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
              {(total ? items : [{ color: "var(--muted)" }]).map((i, k) => <Cell key={k} fill={i.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={<ChartTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      <ul className="w-full space-y-1.5">
        {items.map((i) => (
          <li key={i.key} className="grid grid-cols-[10px_minmax(0,1fr)_auto_40px] items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-surface-hover/60">
            <span className="h-2.5 w-[3px] rounded-[1px]" style={{ background: i.color, boxShadow: `0 0 6px ${i.color}` }} />
            <span className="truncate text-foreground-soft">{i.label}</span>
            <span className="font-mono text-[12px] tabular text-foreground">{formatNumber(i.value)}</span>
            <span className="text-right font-mono text-[11px] tabular text-subtle-foreground">{total ? formatPercent(i.value / total, 0) : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Center({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <>
      <span className="text-[20px] font-semibold leading-none tracking-[-0.03em] tabular">{value}</span>
      <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground">{label}</span>
    </>
  );
}

export function SentimentDonut({ data }: { data: Detailed["sentiment"] }) {
  const items = data.map((d) => ({ key: d.sentiment, label: titleCase(d.sentiment), value: d.count, color: SENT_COLORS[d.sentiment] ?? "var(--chart-5)" }));
  const pos = data.find((d) => d.sentiment === "positive")?.count ?? 0;
  const total = data.reduce((a, b) => a + b.count, 0);
  return <Donut items={items} center={<Center value={total ? formatPercent(pos / total, 0) : "—"} label="positive" />} />;
}

export function SourceDonut({ data }: { data: Detailed["sources"] }) {
  const items = data.map((d) => ({ key: d.source, label: d.label, value: d.count, color: SOURCE_COLORS[d.source] ?? "var(--chart-5)" }));
  const total = data.reduce((a, b) => a + b.count, 0);
  return <Donut items={items} center={<Center value={formatNumber(total)} label="items" />} />;
}

export function TopicsList({ data }: { data: Detailed["topics"] }) {
  const max = Math.max(1, ...data.map((d) => d.mentions));
  return (
    <ul className="space-y-3">
      {data.map((t) => {
        const tone = t.avg_rating >= 4 ? "success" : t.avg_rating < 3 ? "danger" : "warning";
        return (
          <li key={t.topic}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
              <span className="truncate font-medium">{titleCase(t.topic)}</span>
              <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular">
                <span className="text-subtle-foreground">{t.mentions}×</span>
                <span className={cn("font-semibold", tone === "success" ? "text-success-foreground" : tone === "danger" ? "text-danger-foreground" : "text-warning-foreground")}>{t.avg_rating.toFixed(1)}★</span>
              </span>
            </div>
            <MeterBar value={t.mentions} max={max} tone={tone} />
          </li>
        );
      })}
    </ul>
  );
}

export { Legend };
