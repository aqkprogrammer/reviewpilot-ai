"use client";
/**
 * Command-center building blocks for the Super Admin console.
 * Token-driven only (admin-theme: graphite, ice-blue signal, amber operations) — no hex colours.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api, type Query } from "@/lib/api";
import { cn, formatCurrency, initials, titleCase } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, StatusDot } from "@/components/ui/tech";
import { Tooltip } from "@/components/ui/controls";
import { sectionMeta } from "./nav";

/* ================================================================== data */

export function adminGet<T>(path: string, query?: Query) {
  return api.get<T>(`/admin${path}`, query, { orgId: null });
}
export const adminPost = <T,>(path: string, body?: unknown) => api.post<T>(`/admin${path}`, body, { orgId: null });
export const adminPatch = <T,>(path: string, body?: unknown) => api.patch<T>(`/admin${path}`, body, { orgId: null });
export const adminPut = <T,>(path: string, body?: unknown) => api.put<T>(`/admin${path}`, body, { orgId: null });
export const adminDelete = <T,>(path: string) => api.delete<T>(`/admin${path}`, { orgId: null });

export function useAdmin<T>(path: string, query?: Query, opts?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({
    queryKey: ["admin", path, query ?? {}],
    queryFn: () => adminGet<T>(path, query),
    placeholderData: (prev) => prev,
    ...opts,
  });
}

export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/* ================================================================== formatting */

export const money = (minor: number | null | undefined, opts?: { compact?: boolean }) => formatCurrency(minor ?? 0, "INR", opts);
export const moneyCompact = (minor: number) => formatCurrency(minor, "INR", { compact: true });

export function relTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const abs = Math.abs(diff);
  const fmt = (n: number, u: string) => `${Math.round(n)}${u}${diff < 0 ? " from now" : " ago"}`;
  if (abs < 60) return diff < 0 ? "in a moment" : "just now";
  if (abs < 3600) return fmt(abs / 60, "m");
  if (abs < 86400) return fmt(abs / 3600, "h");
  if (abs < 86400 * 30) return fmt(abs / 86400, "d");
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "10 NOV 14:32:05" — mono timestamp for logs. */
export function stamp(iso: string | null | undefined, seconds = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined, hour12: false });
  return `${date} ${time}`;
}

export const shortId = (id: string | null | undefined, n = 8) => (id ? id.replace(/-/g, "").slice(0, n).toUpperCase() : "—");

/* ================================================================== page chrome */

/** Section header: mono index readout ("04 / 16 · REVENUE"), title, description and actions. */
export function SectionHeader({ title, description, actions, eyebrow, meta }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string; meta?: React.ReactNode }) {
  const path = usePathname();
  const sm = sectionMeta(path);
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {sm && (
            <span className="font-mono text-[10.5px] tabular tracking-[0.14em] text-primary">
              {String(sm.index).padStart(2, "0")}<span className="text-subtle-foreground"> / {sm.total}</span>
            </span>
          )}
          <span aria-hidden className="h-px w-5 bg-border-strong" />
          <span className="micro-label">{eyebrow ?? sm?.group.group}</span>
          {meta && <span className="micro-label hidden sm:inline">· {meta}</span>}
        </div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[24px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Instrument panel with a header rail (title · description · meta · actions). */
export function Panel({ title, description, actions, meta, children, className, bodyClassName, flush, id }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; flush?: boolean; id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-[linear-gradient(180deg,color-mix(in_oklab,var(--card-elevated)_55%,var(--card))_0%,var(--card)_96px)] shadow-sm hairline-top",
        className,
      )}
      aria-labelledby={id && title ? `${id}-title` : undefined}
    >
      {(title || actions || meta) && (
        <header className="flex min-h-[50px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
          <div className="min-w-0 flex-1">
            {title && <h2 id={id ? `${id}-title` : undefined} className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>}
            {description && <p className="truncate text-[11.5px] text-muted-foreground">{description}</p>}
          </div>
          {meta && <span className="micro-label shrink-0 tabular">{meta}</span>}
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("min-w-0 flex-1", !flush && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Holographic instrument surface: translucent graphite, thin signal border, edge lighting, mono label rail. */
export function HoloPanel({ label, title, meta, actions, children, className, bodyClassName }: {
  label?: string; title?: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--primary)_26%,transparent)] bg-[color-mix(in_oklab,var(--card)_72%,transparent)] backdrop-blur-sm",
        "shadow-[inset_0_1px_0_color-mix(in_oklab,var(--primary)_22%,transparent),inset_0_0_40px_-24px_color-mix(in_oklab,var(--primary)_60%,transparent),0_18px_40px_-28px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--primary),transparent)] opacity-70" />
      <span aria-hidden className="pointer-events-none absolute inset-y-6 left-0 w-px bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--primary)_55%,transparent),transparent)]" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid opacity-40 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,#000,transparent)]" />
      {(label || title || meta || actions) && (
        <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color-mix(in_oklab,var(--primary)_14%,var(--border))] px-4 py-2.5">
          <div className="min-w-0 flex-1">
            {label && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{label}</p>}
            {title && <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>}
          </div>
          {meta && <span className="micro-label shrink-0">{meta}</span>}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ================================================================== system status */

export interface HealthProbe {
  api: { status: string; environment?: string; demo_mode?: boolean };
  database: { status: string };
  redis: { status: string };
  worker: { status: string };
  jobs?: { failed_24h: number };
  queue_backlog?: number;
}
/** Derives the console's single status word from GET /admin/system-health — never hard-coded. */
export function systemStatus(h?: HealthProbe | null) {
  if (!h) return { label: "Probing", tone: "idle" as const, detail: "Awaiting first probe" };
  if (h.api.status !== "ok" || h.database.status !== "ok") return { label: "System offline", tone: "error" as const, detail: `api ${h.api.status} · db ${h.database.status}` };
  const issues: string[] = [];
  if (h.redis.status !== "ok") issues.push(`redis ${h.redis.status.replace(/_/g, " ")}`);
  if (h.worker.status !== "ok") issues.push(`worker ${h.worker.status.replace(/_/g, " ")}`);
  if (h.jobs?.failed_24h) issues.push(`${h.jobs.failed_24h} failed jobs`);
  if ((h.queue_backlog ?? 0) > 100) issues.push(`backlog ${h.queue_backlog}`);
  return issues.length ? { label: "Degraded", tone: "warn" as const, detail: issues.join(" · ") } : { label: "System online", tone: "live" as const, detail: "All probes nominal" };
}

/** Mono status readout chip, e.g. ● SYSTEM ONLINE. */
export function SystemStatusChip({ h, className }: { h?: HealthProbe | null; className?: string }) {
  const s = systemStatus(h);
  const color = { idle: "text-subtle-foreground", error: "text-danger-foreground", warn: "text-amber", live: "text-mint" }[s.tone];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-[5px] border border-border bg-background-subtle/70 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em]", color, className)} title={s.detail} role="status">
      <StatusDot tone={s.tone} pulse={s.tone === "live" || s.tone === "error"} />
      {s.label}
    </span>
  );
}

/* ================================================================== metrics */

const TONE_TEXT = {
  signal: "text-primary", ice: "text-ice", cyan: "text-cyan", mint: "text-mint", amber: "text-amber", success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-subtle-foreground",
} as const;
const TONE_BG = {
  signal: "bg-primary", ice: "bg-ice", cyan: "bg-cyan", mint: "bg-mint", amber: "bg-amber", success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-border-strong",
} as const;
export type Tone = keyof typeof TONE_TEXT;
export const toneText = (t: Tone) => TONE_TEXT[t];
export const toneBg = (t: Tone) => TONE_BG[t];

/** Hairline grid container — children are cells separated by 1px rules. */
export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm", className)}>{children}</div>;
}

/** A single metric cell. Numeric `value` counts up; pass `display` for pre-formatted nodes. */
export function Kpi({ label, value, format, display, sub, tone = "neutral", icon: Icon, href, loading, alert, className, children }: {
  label: string; value?: number | null; format?: (n: number) => string; display?: React.ReactNode; sub?: React.ReactNode; tone?: Tone; icon?: React.ComponentType<{ className?: string }>;
  href?: string; loading?: boolean; alert?: boolean; className?: string; children?: React.ReactNode;
}) {
  const body = (
    <>
      <span aria-hidden className={cn("absolute left-0 top-4 h-3.5 w-[2px] rounded-r-full", TONE_BG[tone], tone !== "neutral" && "shadow-[0_0_8px_currentColor]", TONE_TEXT[tone])} />
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label truncate">{label}</span>
        {Icon && <Icon className={cn("size-3.5 shrink-0", alert ? TONE_TEXT[tone] : "text-subtle-foreground")} />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <div className={cn("mt-2.5 text-[24px] font-semibold leading-none tracking-[-0.035em] tabular", alert ? TONE_TEXT[tone] : "text-foreground")}>
          {display ?? <AnimatedNumber value={value ?? null} format={format} />}
        </div>
      )}
      {sub != null && <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{sub}</div>}
      {children}
    </>
  );
  const cls = cn("group relative block min-w-0 bg-card px-4 pb-3.5 pt-3.5 transition-colors", href && "hover:bg-surface-hover focus-visible:bg-surface-hover", className);
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Horizontal meter (share / utilisation). */
export function Meter({ value, max, tone = "signal", className, label }: { value: number; max: number; tone?: Tone; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_BG[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Stacked distribution bar + legend (e.g. subscription states). */
export function StackedMeter({ segments, className, showLegend = true }: { segments: { label: string; value: number; tone: Tone; href?: string }[]; className?: string; showLegend?: boolean }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-[3px] bg-muted" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className={cn("h-full first:rounded-l-[3px] last:rounded-r-[3px]", TONE_BG[s.tone])} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      {showLegend && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {segments.map((s) => {
            const inner = (
              <>
                <span className="flex min-w-0 items-center gap-2 text-foreground-soft"><span className={cn("size-1.5 shrink-0 rounded-[1px]", TONE_BG[s.tone])} /><span className="truncate">{s.label}</span></span>
                <span className="font-mono tabular text-foreground">{s.value}<span className="ml-1.5 text-subtle-foreground">{total ? Math.round((s.value / total) * 100) : 0}%</span></span>
              </>
            );
            return (
              <li key={s.label} className="text-[12px]">
                {s.href ? <Link href={s.href} className="-mx-1 flex items-center justify-between gap-2 rounded px-1 hover:bg-surface-hover">{inner}</Link> : <div className="flex items-center justify-between gap-2">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ================================================================== status */

const PILL: Record<string, BadgeProps["variant"]> = {
  active: "success", succeeded: "success", connected: "success", resolved: "success", published: "success", ok: "success", paid: "success", completed: "success", delivered: "success", enabled: "success",
  trialing: "info", open: "info", scheduled: "info", running: "info", sent: "info", info: "info", inline: "neutral",
  pending: "warning", past_due: "warning", grace_period: "warning", pending_authorization: "warning", paused: "warning", no_heartbeat: "warning", unavailable: "warning", high: "amber", warning: "warning", degraded: "warning", refunded: "amber",
  suspended: "danger", disabled: "danger", failed: "danger", canceled: "danger", expired: "danger", error: "danger", token_expired: "danger", down: "danger", urgent: "danger", critical: "danger",
  closed: "neutral", archived: "neutral", not_connected: "neutral", not_configured: "neutral", low: "neutral", normal: "neutral", queued: "neutral", draft: "neutral", hidden: "neutral", skipped: "neutral",
};
const PILL_LABEL: Record<string, string> = { pending_authorization: "Pending auth", not_connected: "Not connected", not_configured: "Not set", grace_period: "Grace", past_due: "Past due", token_expired: "Token expired", no_heartbeat: "No heartbeat", ok: "OK" };

/** Mono status readout with a glowing dot. */
export function StatusPill({ status, label, dot = true, className }: { status: string | null | undefined; label?: string; dot?: boolean; className?: string }) {
  if (!status) return <span className="font-mono text-[11px] text-subtle-foreground">—</span>;
  return (
    <Badge variant={PILL[status] ?? "neutral"} size="sm" mono dot={dot} className={className}>
      {label ?? PILL_LABEL[status] ?? titleCase(status)}
    </Badge>
  );
}

export function DemoTag({ show = true, label = "Demo" }: { show?: boolean; label?: string }) {
  if (!show) return null;
  return <Badge variant="amber" size="sm" mono className="h-[18px] px-1 text-[9.5px]">{label}</Badge>;
}

const MONO_TONES = [
  "bg-ice-soft text-ice border-[color-mix(in_oklab,var(--ice)_24%,transparent)]",
  "bg-cyan-soft text-cyan border-[color-mix(in_oklab,var(--cyan)_24%,transparent)]",
  "bg-mint-soft text-mint border-[color-mix(in_oklab,var(--mint)_24%,transparent)]",
  "bg-amber-soft text-amber border-[color-mix(in_oklab,var(--amber)_26%,transparent)]",
  "bg-muted text-foreground-soft border-border-strong",
];

/** Token-coloured monogram (orgs: square, people: round). */
export function Monogram({ name, size = 28, round, className }: { name?: string | null; size?: number; round?: boolean; className?: string }) {
  const hash = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center border font-mono font-semibold tracking-[0.02em]", round ? "rounded-full" : "rounded-md", MONO_TONES[hash % MONO_TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(9.5, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/* ================================================================== misc */

export function KeyValue({ items, className, cols = 2 }: { items: [string, React.ReactNode][]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3.5", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="micro-label">{k}</dt>
          <dd className="mt-1 truncate text-[13px] text-foreground">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function QueryState({ query, children, skeleton }: { query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }; children: React.ReactNode; skeleton?: React.ReactNode }) {
  if (query.isLoading) return <>{skeleton ?? <PageSkeleton />}</>;
  if (query.isError)
    return (
      <div className="rounded-xl border border-border bg-card">
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      </div>
    );
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-[104px] rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline", className)} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

/** Mono identifier with a copy affordance. Never use for secrets. */
export function CopyId({ value, display, className }: { value: string; display?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Tooltip content={done ? "Copied" : "Copy"}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => {});
        }}
        className={cn("group/copy inline-flex max-w-full items-center gap-1.5 rounded px-1 -mx-1 font-mono text-[11.5px] text-muted-foreground transition hover:bg-surface-hover hover:text-foreground", className)}
        aria-label={`Copy ${display ?? value}`}
      >
        <span className="truncate">{display ?? value}</span>
        {done ? <Check className="size-3 shrink-0 text-success" /> : <Copy className="size-3 shrink-0 opacity-0 transition group-hover/copy:opacity-100" />}
      </button>
    </Tooltip>
  );
}

/** Empty / note line inside a panel list. */
export function EmptyLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("px-4 py-8 text-center font-mono text-[11.5px] uppercase tracking-[0.1em] text-subtle-foreground", className)}>{children}</p>;
}

/** Inline "signal" note, e.g. demo data disclaimer. */
export function Notice({ tone = "amber", icon: Icon, children, className }: { tone?: "amber" | "ice" | "danger"; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  const cls = {
    amber: "border-[color-mix(in_oklab,var(--amber)_26%,transparent)] bg-amber-soft text-amber",
    ice: "border-[color-mix(in_oklab,var(--ice)_24%,transparent)] bg-ice-soft text-ice",
    danger: "border-[color-mix(in_oklab,var(--danger)_26%,transparent)] bg-danger-soft text-danger-foreground",
  }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed", cls, className)}>
      {Icon && <Icon className="mt-0.5 size-3.5 shrink-0" />}
      <div className="min-w-0 text-foreground-soft">{children}</div>
    </div>
  );
}

export const opts = (values: string[]) => values.map((v) => ({ value: v, label: titleCase(v) }));
