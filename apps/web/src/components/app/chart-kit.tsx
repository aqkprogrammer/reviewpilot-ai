"use client";
/** Shared Recharts styling: axis props, gradients and a tooltip matching the design system. */
import * as React from "react";
import { cn } from "@/lib/utils";

export const axisProps = {
  stroke: "var(--subtle-foreground)",
  fontSize: 10.5,
  fontFamily: "var(--font-geist-mono)",
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = { stroke: "var(--chart-grid)", strokeDasharray: "2 4", vertical: false } as const;

export function GradientDefs({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.32} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

interface TooltipPayload { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export function ChartTooltip({
  active, payload, label, labelFormatter, valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  labelFormatter?: (l: string | number | undefined) => React.ReactNode;
  valueFormatter?: (v: number | string | undefined, name?: string) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border-strong bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur">
      <p className="mb-2 border-b border-border pb-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{labelFormatter ? labelFormatter(label) : label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-[3px] rounded-[1px]" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
              {p.name}
            </span>
            <span className="font-mono font-medium tabular text-foreground">{valueFormatter ? valueFormatter(p.value, p.name) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <span className="font-semibold text-foreground tabular">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}
