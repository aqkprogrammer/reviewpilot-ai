"use client";
import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export const C = {
  blue: "#2f7bff",
  cyan: "#22d3ee",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  grid: "var(--chart-grid)",
};
export const PALETTE = [C.blue, C.cyan, C.violet, C.emerald, C.amber, C.rose];

const axis = { fill: "var(--muted-foreground)", fontSize: 11 };

function TooltipCard({ active, payload, label, format, labelFormat }: {
  active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string; format?: (v: number) => string; labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border-strong bg-popover/95 px-3 py-2.5 shadow-lg backdrop-blur">
      {label !== undefined && <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{labelFormat ? labelFormat(String(label)) : label}</p>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 text-foreground-soft">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-semibold text-foreground tabular">{format ? format(Number(p.value ?? 0)) : Number(p.value ?? 0).toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}

const monthLabel = (v: string) => {
  if (/^\d{4}-\d{2}$/.test(v)) return new Date(`${v}-01`).toLocaleDateString("en-IN", { month: "short" });
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return v;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rows = any[];

export function AreaTrend({ data, x, series, height = 260, format, className }: {
  data: Rows; x: string; series: { key: string; name: string; color: string }[]; height?: number; format?: (v: number) => string; className?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} tickFormatter={monthLabel} minTickGap={18} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (format ? format(v) : Intl.NumberFormat("en-IN", { notation: "compact" }).format(v))} />
          <Tooltip content={<TooltipCard format={format} labelFormat={monthLabel} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#${id}-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrend({ data, x, series, height = 240, format, stacked }: {
  data: Rows; x: string; series: { key: string; name: string; color: string }[]; height?: number; format?: (v: number) => string; stacked?: boolean;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} tickFormatter={monthLabel} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (format ? format(v) : Intl.NumberFormat("en-IN", { notation: "compact" }).format(v))} allowDecimals={false} />
          <Tooltip content={<TooltipCard format={format} labelFormat={monthLabel} />} cursor={{ fill: "rgb(47 123 255 / 0.06)" }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? "a" : undefined} radius={stacked && i < series.length - 1 ? 0 : [5, 5, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 200, center, format }: { data: { name: string; value: number }[]; height?: number; center?: React.ReactNode; format?: (v: number) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? data : [{ name: "None", value: 1 }]} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="96%" paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? data : [{ name: "None", value: 1 }]).map((_, i) => <Cell key={i} fill={total ? PALETTE[i % PALETTE.length] : "var(--muted)"} />)}
            </Pie>
            {total > 0 && <Tooltip content={<TooltipCard format={format} />} />}
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <ul className="w-full space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex items-center gap-2 text-foreground-soft">
              <span className="size-2.5 rounded-[3px]" style={{ background: PALETTE[i % PALETTE.length] }} />
              {d.name}
            </span>
            <span className="font-mono text-foreground tabular">
              {format ? format(d.value) : d.value.toLocaleString("en-IN")}
              <span className="ml-2 text-subtle-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
