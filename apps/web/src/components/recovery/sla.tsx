"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/tech";
import { cn } from "@/lib/utils";
import { CLOCK, SEVERITY, STATUS, type CaseItem, type CaseStatus, type Severity } from "./types";

/** Shared ticking clock (30s) so every countdown on the page re-renders together. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = Date.now();
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
export function useNow() {
  return React.useSyncExternalStore(subscribe, () => current, () => current);
}

export function formatDuration(ms: number) {
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export type SlaState = { tone: "ok" | "warn" | "danger" | "muted" | "signal"; label: string; detail: string };

export function slaState(c: Pick<CaseItem, "status" | "due_at" | "first_response_at" | "created_at" | "breached" | "sla_missed">, now: number): SlaState {
  if (CLOCK.includes(c.status) && c.due_at) {
    const left = new Date(c.due_at).getTime() - now;
    if (left < 0 || c.breached) return { tone: "danger", label: `+${formatDuration(left < 0 ? left : 0)}`, detail: "SLA breached" };
    if (left < 2 * 3600_000) return { tone: "warn", label: formatDuration(left), detail: "Due soon" };
    return { tone: "signal", label: formatDuration(left), detail: "Time left" };
  }
  if (c.first_response_at) {
    const took = new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime();
    return { tone: c.sla_missed ? "warn" : "ok", label: formatDuration(took), detail: c.sla_missed ? "Responded · SLA missed" : "Responded in SLA" };
  }
  return { tone: "muted", label: "—", detail: c.status === "resolved" || c.status === "closed" ? "Closed without outreach" : "No SLA" };
}

const TONE_TEXT = {
  ok: "text-success-foreground",
  warn: "text-amber",
  danger: "text-danger-foreground",
  muted: "text-subtle-foreground",
  signal: "text-foreground",
} as const;

export function SlaClock({ c, className, size = "sm" }: { c: Parameters<typeof slaState>[0]; className?: string; size?: "sm" | "lg" }) {
  const now = useNow();
  const s = slaState(c, now);
  return (
    <span className={cn("inline-flex flex-col", className)} aria-label={`${s.detail}: ${s.label}`}>
      <span className={cn("inline-flex items-center gap-1.5 font-mono tabular", size === "lg" ? "text-[20px] font-medium tracking-[-0.02em]" : "text-[12.5px]", TONE_TEXT[s.tone])}>
        {s.tone === "danger" && <StatusDot tone="error" pulse className={size === "lg" ? "" : "size-1.5"} />}
        {s.tone === "warn" && CLOCK.includes(c.status) && <StatusDot tone="warn" className={size === "lg" ? "" : "size-1.5"} />}
        {s.label}
      </span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground">{s.detail}</span>
    </span>
  );
}

export function SeverityBadge({ severity, size = "sm" }: { severity: Severity; size?: "sm" | "md" }) {
  const s = SEVERITY[severity];
  return <Badge size={size} variant={s.variant} mono>{s.label}</Badge>;
}

export function CaseStatusBadge({ status, size = "sm" }: { status: CaseStatus; size?: "sm" | "md" }) {
  const s = STATUS[status];
  return (
    <Badge size={size} variant={s.variant} mono>
      <StatusDot tone={s.dot} className="size-1.5" />
      {s.label}
    </Badge>
  );
}
