"use client";
/** Admin console building blocks (navy console look; wraps components/ui primitives). */
import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api, type Query } from "@/lib/api";
import { cn, formatCurrency, formatNumber, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

/* ------------------------------------------------------------------ data */

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

export const money = (minor: number | null | undefined, opts?: { compact?: boolean }) => formatCurrency(minor ?? 0, "INR", opts);

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

/* ------------------------------------------------------------------ layout */

export function SectionHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-primary-soft-foreground">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName, flush }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; flush?: boolean;
}) {
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.07),transparent)]" />
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "mt-3" : "p-5", title && !flush && "pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const ACCENTS = {
  blue: { line: "from-[#2f7bff] to-[#2f7bff]/0", glow: "rgb(47 123 255 / 0.22)", chip: "bg-blue-soft text-[#7eaaff]", border: "border-[#2f7bff]/35" },
  emerald: { line: "from-[#10b981] to-[#10b981]/0", glow: "rgb(16 185 129 / 0.18)", chip: "bg-success-soft text-success-foreground", border: "border-[#10b981]/30" },
  violet: { line: "from-[#8b5cf6] to-[#8b5cf6]/0", glow: "rgb(139 92 246 / 0.2)", chip: "bg-purple-soft text-[#b9a1ff]", border: "border-[#8b5cf6]/35" },
  amber: { line: "from-[#f59e0b] to-[#f59e0b]/0", glow: "rgb(245 158 11 / 0.16)", chip: "bg-warning-soft text-warning-foreground", border: "border-[#f59e0b]/30" },
  cyan: { line: "from-[#22d3ee] to-[#22d3ee]/0", glow: "rgb(34 211 238 / 0.16)", chip: "bg-cyan-soft text-[#67e8f9]", border: "border-[#22d3ee]/30" },
  rose: { line: "from-[#f43f5e] to-[#f43f5e]/0", glow: "rgb(244 63 94 / 0.16)", chip: "bg-danger-soft text-danger-foreground", border: "border-[#f43f5e]/30" },
} as const;
export type Accent = keyof typeof ACCENTS;

export function MetricCard({ label, value, icon: Icon, accent = "blue", delta, hint, loading }: {
  label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent?: Accent; delta?: number | null; hint?: React.ReactNode; loading?: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border bg-card px-5 pb-4 pt-5 shadow-sm transition-colors", a.border)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r", a.line)} />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full blur-2xl" style={{ background: a.glow }} />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-foreground-soft">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-full", a.chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="relative mt-2 flex items-end gap-2.5">
        {loading ? <Skeleton className="h-8 w-24" /> : <span className="font-mono text-[26px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular">{value}</span>}
        {delta !== undefined && delta !== null && !loading && (
          <span className={cn("mb-0.5 inline-flex items-center gap-0.5 text-[11.5px] font-medium", delta >= 0 ? "text-success-foreground" : "text-danger-foreground")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>
      {hint && <p className="relative mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PILL: Record<string, string> = {
  active: "success", succeeded: "success", connected: "success", resolved: "success", published: "success", ok: "success", paid: "success", completed: "success", delivered: "success",
  trialing: "info", open: "info", pending: "warning", scheduled: "info", running: "info", queued: "neutral", inline: "neutral",
  past_due: "warning", grace_period: "warning", pending_authorization: "warning", paused: "warning", no_heartbeat: "warning", unavailable: "warning", high: "warning", draft: "neutral",
  suspended: "danger", disabled: "danger", failed: "danger", canceled: "danger", expired: "danger", error: "danger", token_expired: "danger", down: "danger", urgent: "danger", critical: "danger",
  closed: "neutral", archived: "neutral", not_connected: "neutral", not_configured: "neutral", low: "neutral", normal: "neutral", info: "info", warning: "warning",
};

export function StatusPill({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <span className="text-subtle-foreground">—</span>;
  const tone = PILL[status] ?? "neutral";
  const cls = {
    success: "border-[#10b981]/25 bg-success-soft text-success-foreground",
    info: "border-[#2f7bff]/25 bg-blue-soft text-[#7eaaff]",
    warning: "border-[#f59e0b]/25 bg-warning-soft text-warning-foreground",
    danger: "border-[#f43f5e]/25 bg-danger-soft text-danger-foreground",
    neutral: "border-border-strong bg-muted text-foreground-soft",
  }[tone];
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium", cls)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? titleCase(status)}
    </span>
  );
}

export function DemoTag({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return <span className="rounded border border-[#f59e0b]/30 bg-warning-soft px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-wider text-warning-foreground">Demo</span>;
}

/* ------------------------------------------------------------------ table */

export function DataTable({ head, children, loading, empty, colSpan, minWidth = 720 }: {
  head: React.ReactNode; children: React.ReactNode; loading?: boolean; empty?: boolean | React.ReactNode; colSpan: number; minWidth?: number;
}) {
  return (
    <div className="relative max-h-[640px] overflow-auto scrollbar-thin">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead className="sticky top-0 z-10 bg-card-elevated/95 backdrop-blur">
          <tr className="border-b border-border">{head}</tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={colSpan} className="px-5 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            : empty
              ? (
                <tr>
                  <td colSpan={colSpan}>{typeof empty === "boolean" ? <EmptyState compact icon={Search} title="Nothing matches" description="Try adjusting the filters." /> : empty}</td>
                </tr>
              )
              : children}
        </tbody>
      </table>
    </div>
  );
}

export function Th({ children, className, align }: { children?: React.ReactNode; className?: string; align?: "right" }) {
  return (
    <th className={cn("h-10 whitespace-nowrap px-4 text-left align-middle font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-subtle-foreground first:pl-5 last:pr-5", align === "right" && "text-right", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, align }: { children?: React.ReactNode; className?: string; align?: "right" }) {
  return <td className={cn("px-4 py-3 align-middle text-foreground-soft first:pl-5 last:pr-5", align === "right" && "text-right tabular", className)}>{children}</td>;
}

export function Row({ children, onClick, href, className }: { children: React.ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const interactive = !!(onClick || href);
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-[rgb(47_123_255/0.045)]", interactive && "cursor-pointer", className)}
      onClick={onClick}
      onKeyDown={(e) => { if (interactive && e.key === "Enter") onClick?.(); }}
      tabIndex={interactive ? 0 : undefined}
    >
      {href ? React.Children.map(children, (c) => c) : children}
    </tr>
  );
}

export function Pagination({ page, pages, total, onPage, label = "results" }: { page: number; pages: number; total: number; onPage: (p: number) => void; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
      <span className="tabular">
        {formatNumber(total)} {label} · page {page} of {Math.max(1, pages)}
      </span>
      <div className="flex gap-1.5">
        <Button variant="outline" size="icon-xs" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-xs" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ filters */

export function SearchInput({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  React.useEffect(() => {
    const t = setTimeout(() => { if (local !== value) onChange(local); }, 300);
    return () => clearTimeout(t);
  }, [local, value, onChange]);
  return (
    <div className={cn("w-full sm:w-64", className)}>
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        leading={<Search />}
        className="h-9"
        aria-label={placeholder}
        trailing={local ? (
          <button type="button" onClick={() => { setLocal(""); onChange(""); }} className="rounded p-1 text-subtle-foreground hover:text-foreground" aria-label="Clear search">
            <X className="size-3.5" />
          </button>
        ) : undefined}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; className?: string;
}) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger size="sm" className={cn("h-9 w-full sm:w-40", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-border px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

export const opts = (values: string[]) => values.map((v) => ({ value: v, label: titleCase(v) }));

/* ------------------------------------------------------------------ misc */

export function KeyValue({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">{k}</dt>
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
      <div className="rounded-2xl border border-border bg-card">
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
      </div>
    );
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline-offset-4 hover:text-primary-soft-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export function Bar({ value, max, accent = "#2f7bff" }: { value: number; max: number; accent?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}99, ${accent})` }} />
    </div>
  );
}
