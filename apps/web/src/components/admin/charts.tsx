"use client";
/** Console charts — Recharts on the shared chart-kit, token colours only (admin theme: ice / cyan / mint / amber / steel). */
import * as React from "react";
import { useReducedMotion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, ChartTooltip, gridProps } from "@/components/app/chart-kit";
import { cn } from "@/lib/utils";

export const C = {
  ice: "var(--chart-1)",
  cyan: "var(--chart-2)",
  mint: "var(--chart-3)",
  amber: "var(--chart-4)",
  steel: "var(--chart-5)",
  danger: "var(--danger)",
  success: "var(--success)",
} as const;
export const PALETTE = [C.ice, C.cyan, C.mint, C.amber, C.steel];

export type Series = { key: string; name: string; color: string; dashed?: boolean };

export const periodLabel = (v: string | number | undefined) => {
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(s)) return new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
  return s;
};
const longLabel = (v: string | number | undefined) => {
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(s)) return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `Week of ${new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  return s;
};
const compact = (v: number) => Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rows = any[];

function Defs({ id, series }: { id: string; series: Series[] }) {
  return (
    <defs>
      {series.map((s) => (
        <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={s.color} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  );
}

export function AreaTrend({ data, x, series, height = 260, format, className, yWidth = 52 }: {
  data: Rows; x: string; series: Series[]; height?: number; format?: (v: number) => string; className?: string; yWidth?: number;
}) {
  const id = React.useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <Defs id={id} series={series} />
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={x} {...axisProps} tickFormatter={periodLabel} minTickGap={18} dy={6} />
          <YAxis {...axisProps} width={yWidth} tickFormatter={(v) => (format ? format(v) : compact(v))} />
          <Tooltip content={<ChartTooltip labelFormatter={longLabel} valueFormatter={(v) => (format ? format(Number(v ?? 0)) : Number(v ?? 0).toLocaleString("en-IN"))} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={1.75}
              strokeDasharray={s.dashed ? "4 4" : undefined}
              fill={s.dashed ? "transparent" : `url(#${id}-${s.key})`}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--card)", fill: s.color }}
              isAnimationActive={!reduce}
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrend({ data, x, series, height = 240, format, stacked, className, line }: {
  data: Rows; x: string; series: Series[]; height?: number; format?: (v: number) => string; stacked?: boolean; className?: string; line?: Series;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={2}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={x} {...axisProps} tickFormatter={periodLabel} minTickGap={8} dy={6} />
          <YAxis {...axisProps} width={44} tickFormatter={(v) => (format ? format(v) : compact(v))} allowDecimals={false} />
          <Tooltip content={<ChartTooltip labelFormatter={longLabel} valueFormatter={(v) => (format ? format(Number(v ?? 0)) : Number(v ?? 0).toLocaleString("en-IN"))} />} cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} fillOpacity={0.9} stackId={stacked ? "a" : undefined} radius={stacked && i < series.length - 1 ? 0 : [3, 3, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={600} />
          ))}
          {line && <Line type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={!reduce} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars — ranked categories. */
export function RankBars({ data, height, format, color = C.ice }: { data: { name: string; value: number }[]; height?: number; format?: (v: number) => string; color?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="w-full" style={{ height: height ?? Math.max(120, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => (format ? format(v) : compact(v))} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axisProps} width={92} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => (format ? format(Number(v ?? 0)) : Number(v ?? 0).toLocaleString("en-IN"))} />} cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }} />
          <Bar dataKey="value" name="Value" fill={color} radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={!reduce} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, size = 168, center, format, colors = PALETTE }: { data: { name: string; value: number }[]; size?: number; center?: React.ReactNode; format?: (v: number) => string; colors?: string[] }) {
  const reduce = useReducedMotion();
  const total = data.reduce((a, d) => a + d.value, 0);
  const shown = total ? data : [{ name: "None", value: 1 }];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="74%" outerRadius="100%" paddingAngle={total ? 2.5 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduce}>
              {shown.map((_, i) => <Cell key={i} fill={total ? colors[i % colors.length] : "var(--muted)"} />)}
            </Pie>
            {total > 0 && <Tooltip content={<ChartTooltip valueFormatter={(v) => (format ? format(Number(v ?? 0)) : String(v))} />} />}
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 text-foreground-soft">
              <span className="h-2.5 w-[3px] shrink-0 rounded-[1px]" style={{ background: colors[i % colors.length] }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 font-mono tabular text-foreground">
              {format ? format(d.value) : d.value.toLocaleString("en-IN")}
              <span className="ml-2 inline-block w-9 text-right text-subtle-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Axis-free micro trend for metric cells. */
export function Sparkline({ data, color = C.ice, height = 28, className }: { data: number[]; color?: string; height?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  if (!data.length) return null;
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div className={cn("w-full", className)} style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.25} fill={`url(#${id}-s)`} dot={false} isAnimationActive={!reduce} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small inline legend chip row for chart panels. */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className={cn("h-[2px] w-3 rounded-full", i.dashed && "bg-transparent border-t border-dashed")} style={i.dashed ? { borderColor: i.color } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
