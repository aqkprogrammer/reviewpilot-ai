"use client";
import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const ACCENTS = {
  primary: "text-primary",
  blue: "text-ice",
  ice: "text-ice",
  mint: "text-mint",
  cyan: "text-cyan",
  amber: "text-amber",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * Metric instrument: mono micro-label, large tabular value, delta chip and an accent
 * hairline that illuminates on hover. `value` may be a node (pre-formatted) — pair with
 * <AnimatedNumber> from components/ui/tech for count-up.
 */
export function StatCard({
  label, value, delta, icon: Icon, accent = "primary", definition, footer, loading, invertDelta, className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: keyof typeof ACCENTS;
  definition?: string;
  footer?: React.ReactNode;
  loading?: boolean;
  invertDelta?: boolean;
  className?: string;
}) {
  const good = delta != null && (invertDelta ? delta < 0 : delta > 0);
  return (
    <Card className={cn("group card-hover overflow-hidden p-5", className)}>
      <span aria-hidden className={cn("absolute inset-x-5 top-0 h-px bg-current opacity-30 transition-opacity duration-300 group-hover:opacity-90", ACCENTS[accent])} />
      <span aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-current opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.10]", ACCENTS[accent])} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="micro-label">{label}</span>
          {definition && (
            <Tooltip content={definition}>
              <button aria-label={`About ${label}`} className="text-subtle-foreground transition hover:text-foreground"><Info className="size-3" /></button>
            </Tooltip>
          )}
        </div>
        {Icon && <Icon className={cn("size-4 opacity-80", ACCENTS[accent])} />}
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-8 w-24" />
      ) : (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.035em] tabular text-foreground">{value}</span>
          {delta != null && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-[4px] px-1 py-0.5 font-mono text-[10.5px] font-medium tabular", good ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground")}>
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {footer && <div className="mt-3 border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">{footer}</div>}
    </Card>
  );
}
