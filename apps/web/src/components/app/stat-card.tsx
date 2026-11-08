import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const ACCENTS = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  blue: "bg-blue-soft text-blue",
  purple: "bg-purple-soft text-purple",
  cyan: "bg-cyan-soft text-cyan",
  success: "bg-success-soft text-success-foreground",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-danger-soft text-danger-foreground",
} as const;

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
    <Card className={cn("card-hover relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          {label}
          {definition && (
            <Tooltip content={definition}>
              <button aria-label={`About ${label}`} className="text-subtle-foreground hover:text-foreground"><Info className="size-3.5" /></button>
            </Tooltip>
          )}
        </div>
        {Icon && <span className={cn("flex size-9 items-center justify-center rounded-xl", ACCENTS[accent])}><Icon className="size-[18px]" /></span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular text-foreground">{value}</span>
          {delta != null && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular", good ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground")}>
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}
