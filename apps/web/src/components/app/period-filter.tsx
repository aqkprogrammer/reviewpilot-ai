"use client";
import * as React from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Period = { period: "7d" | "30d" | "90d" | "custom"; date_from?: string; date_to?: string };

const OPTIONS: { value: Period["period"]; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

export function usePeriod(initial: Period["period"] = "30d") {
  const [value, setValue] = React.useState<Period>({ period: initial });
  return [value, setValue] as const;
}

/** Converts a Period into API query params. */
export function periodQuery(p: Period) {
  return p.period === "custom" ? { period: "custom", date_from: p.date_from, date_to: p.date_to } : { period: p.period };
}

export function PeriodFilter({ value, onChange, className }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  const [from, setFrom] = React.useState(value.date_from ?? "");
  const [to, setTo] = React.useState(value.date_to ?? "");
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-background-subtle p-0.5", className)} role="group" aria-label="Date range">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange({ period: o.value })}
          className={cn("h-full rounded-md px-3 font-mono text-[11px] font-medium tracking-[0.06em] transition", value.period === o.value ? "bg-card-elevated text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]" : "text-muted-foreground hover:text-foreground")}
          aria-pressed={value.period === o.value}
        >
          {o.label}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={cn("flex h-full items-center gap-1.5 rounded-md px-3 font-mono text-[11px] font-medium tracking-[0.06em] transition", value.period === "custom" ? "bg-card-elevated text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]" : "text-muted-foreground hover:text-foreground")}>
            <CalendarRange className="size-3.5" />
            {value.period === "custom" && value.date_from ? `${value.date_from} → ${value.date_to}` : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <p className="text-sm font-medium">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">From<Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">To<Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <Button size="sm" className="w-full" disabled={!from || !to} onClick={() => { onChange({ period: "custom", date_from: from, date_to: to }); setOpen(false); }}>Apply range</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
