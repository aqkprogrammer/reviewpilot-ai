import * as React from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

/** Accent colour of the card's top hairline for each honest connection state. */
const STATE_ACCENT: Record<string, string> = {
  connected: "bg-success shadow-[0_0_10px_var(--success)]",
  simulated: "bg-mint/70",
  pending_authorization: "bg-warning",
  token_expired: "bg-warning",
  error: "bg-danger shadow-[0_0_10px_var(--danger)]",
};

export function IntegrationCard({
  icon, name, tagline, status, children, footer, className, code, meta,
}: {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  status: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Short mono identifier shown above the name, e.g. "GBP · OAUTH 2.0". */
  code?: string;
  /** Extra readout in the header (right side). */
  meta?: React.ReactNode;
}) {
  return (
    <Card className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}>
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", STATE_ACCENT[status] ?? "bg-border-strong")} />
      <div className="flex items-start gap-4 p-5">
        <span className="tech-corners flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-card-elevated text-subtle-foreground [&_svg]:size-[22px]">{icon}</span>
        <div className="min-w-0 flex-1">
          {code && <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">{code}</p>}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-[-0.015em]">{name}</h3>
            <StatusBadge status={status} size="md" />
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{tagline}</p>
        </div>
        {meta && <div className="hidden shrink-0 sm:block">{meta}</div>}
      </div>
      {children && <div className="flex-1 space-y-4 border-t border-border px-5 py-4">{children}</div>}
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background-subtle/70 px-5 py-3">{footer}</div>}
    </Card>
  );
}

export function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px]">
      <span className="micro-label shrink-0">{label}</span>
      <span className={cn("min-w-0 truncate text-right text-foreground", mono && "font-mono text-xs")}>{value ?? "—"}</span>
    </div>
  );
}

/** Groups KV rows in a hairline-divided block. */
export function KVGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border rounded-lg border border-border bg-background-subtle/50", className)}>{children}</div>;
}

/** Numbered setup guidance. */
export function SetupSteps({ steps, title = "Setup guide" }: { steps: React.ReactNode[]; title?: string }) {
  return (
    <div>
      <p className="micro-label mb-2">{title}</p>
      <ol className="space-y-0 overflow-hidden rounded-lg border border-border">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 border-b border-border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground-soft last:border-0">
            <span className="mt-px font-mono text-[10.5px] text-primary">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The five honest connection states with the current one highlighted. */
export const HONEST_STATES = [
  { key: "connected", label: "Connected" },
  { key: "not_connected", label: "Not connected" },
  { key: "pending_authorization", label: "Pending auth" },
  { key: "token_expired", label: "Token expired" },
  { key: "error", label: "Error" },
] as const;

export function StateRail({ status }: { status: string }) {
  const tone: Record<string, string> = { connected: "text-success-foreground", not_connected: "text-foreground", pending_authorization: "text-warning-foreground", token_expired: "text-warning-foreground", error: "text-danger-foreground" };
  return (
    <div className="flex flex-wrap gap-1" aria-label="Connection state">
      {HONEST_STATES.map((s) => {
        const on = s.key === status || (status === "not_configured" && s.key === "not_connected");
        return (
          <span key={s.key} aria-current={on ? "true" : undefined} className={cn("inline-flex h-6 items-center gap-1.5 rounded-[5px] border px-2 font-mono text-[9.5px] uppercase tracking-[0.1em] transition-colors", on ? cn("border-border-strong bg-card-elevated", tone[s.key]) : "border-transparent text-subtle-foreground/60")}>
            <span className={cn("size-1.5 rounded-full", on ? "bg-current shadow-[0_0_6px_currentColor]" : "bg-border-strong")} aria-hidden />
            {s.label}
          </span>
        );
      })}
    </div>
  );
}
