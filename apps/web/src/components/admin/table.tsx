"use client";
/** Data-table toolkit for the console: sorting, selection, row menus, toolbar, pagination, bulk bar. */
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, Search, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";

/* ================================================================== sorting (client-side, current page) */

export type SortState = { key: string; dir: "asc" | "desc" } | null;
type Accessor<T> = (row: T) => string | number | boolean | null | undefined;

export function useClientSort<T>(rows: T[] | undefined, accessors: Record<string, Accessor<T>>, initial: SortState = null) {
  const [sort, setSort] = React.useState<SortState>(initial);
  const toggle = React.useCallback((key: string) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }, []);
  const sorted = React.useMemo(() => {
    const list = rows ?? [];
    if (!sort || !accessors[sort.key]) return list;
    const get = accessors[sort.key];
    return [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "en", { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { sorted, sort, toggle };
}

/* ================================================================== selection */

export function useSelection(ids: string[]) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const key = ids.join("|");
  // Drop selections that left the current page / filter.
  React.useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => ids.includes(id)));
      return next.size === s.size ? s : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  const toggleAll = () => setSelected(all ? new Set() : new Set(ids));
  const clear = () => setSelected(new Set());
  return { selected, toggle, toggleAll, clear, all, some, count: selected.size };
}

/* ================================================================== table */

export function DataTable({ head, children, loading, empty, colSpan, minWidth = 720, maxHeight = 640, className, caption }: {
  head: React.ReactNode; children: React.ReactNode; loading?: boolean; empty?: boolean | React.ReactNode; colSpan: number; minWidth?: number; maxHeight?: number | "none"; className?: string; caption?: string;
}) {
  return (
    <div className={cn("relative overflow-auto scrollbar-thin", className)} style={{ maxHeight: maxHeight === "none" ? undefined : maxHeight }}>
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-[color-mix(in_oklab,var(--card-elevated)_92%,transparent)] backdrop-blur-sm">
          <tr className="border-b border-border">{head}</tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={colSpan} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            : empty
              ? (
                <tr>
                  <td colSpan={colSpan}>{typeof empty === "boolean" ? <EmptyState compact icon={Search} title="Nothing matches" description="Adjust the search or filters." /> : empty}</td>
                </tr>
              )
              : children}
        </tbody>
      </table>
    </div>
  );
}

export function Th({ children, className, align, sortKey, sort, onSort, srOnly }: {
  children?: React.ReactNode; className?: string; align?: "right" | "center"; sortKey?: string; sort?: SortState; onSort?: (k: string) => void; srOnly?: boolean;
}) {
  const active = sortKey && sort?.key === sortKey;
  const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : sortKey ? "none" : undefined;
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "h-9 whitespace-nowrap px-3 text-left align-middle font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-subtle-foreground first:pl-4 last:pr-4",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase transition-colors hover:text-foreground", active && "text-primary", align === "right" && "flex-row-reverse")}
        >
          {children}
          {active ? (sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
        </button>
      ) : srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

export function Td({ children, className, align, onClick }: { children?: React.ReactNode; className?: string; align?: "right" | "center"; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <td onClick={onClick} className={cn("px-3 py-2.5 align-middle text-foreground-soft first:pl-4 last:pr-4", align === "right" && "text-right tabular", align === "center" && "text-center", className)}>
      {children}
    </td>
  );
}

export function Row({ children, onClick, selected, className }: { children: React.ReactNode; onClick?: () => void; selected?: boolean; className?: string }) {
  const interactive = !!onClick;
  return (
    <tr
      data-state={selected ? "selected" : undefined}
      className={cn(
        "group/row border-b border-border transition-colors hover:bg-surface-hover/55",
        selected && "bg-primary-soft hover:bg-primary-soft [&>td:first-child]:shadow-[inset_2px_0_0_var(--primary)]",
        interactive && "cursor-pointer",
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => { if (interactive && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onClick?.(); } }}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
    </tr>
  );
}

/** Checkbox header cell (select all on the current page). */
export function SelectHead({ all, some, onToggle, label = "Select all rows on this page" }: { all: boolean; some: boolean; onToggle: () => void; label?: string }) {
  return (
    <th scope="col" className="h-9 w-10 pl-4 pr-1 align-middle">
      <Checkbox checked={all ? true : some ? "indeterminate" : false} onCheckedChange={onToggle} aria-label={label} />
    </th>
  );
}

export function SelectCell({ checked, onToggle, label, disabled }: { checked: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <td className="w-10 pl-4 pr-1 align-middle" onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} disabled={disabled} />
    </td>
  );
}

/* ================================================================== row menu */

export type MenuItem =
  | { label: string; icon?: React.ComponentType<{ className?: string }>; onSelect?: () => void; href?: string; destructive?: boolean; disabled?: boolean; hint?: string }
  | "separator"
  | { heading: string };

export function RowMenu({ items, label = "Row actions", align = "end" }: { items: MenuItem[]; label?: string; align?: "end" | "start" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label} onClick={(e) => e.stopPropagation()} className="text-subtle-foreground data-[state=open]:bg-surface-hover data-[state=open]:text-foreground">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56" onClick={(e) => e.stopPropagation()}>
        {items.map((it, i) => {
          if (it === "separator") return <DropdownMenuSeparator key={i} />;
          if ("heading" in it) return <DropdownMenuLabel key={i}>{it.heading}</DropdownMenuLabel>;
          const Icon = it.icon;
          const content = (
            <>
              {Icon && <Icon />}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="font-mono text-[10px] text-subtle-foreground">{it.hint}</span>}
            </>
          );
          return it.href ? (
            <DropdownMenuItem key={i} asChild disabled={it.disabled} destructive={it.destructive}><Link href={it.href}>{content}</Link></DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={i} onSelect={it.onSelect} disabled={it.disabled} destructive={it.destructive}>{content}</DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ================================================================== toolbar */

export function Toolbar({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 border-b border-border px-4 py-2.5 md:flex-row md:items-center", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
/** @deprecated alias */
export const FilterBar = Toolbar;

export function SearchInput({ value, onChange, placeholder = "Search…", className, label }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
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
        onKeyDown={(e) => { if (e.key === "Escape" && local) { e.stopPropagation(); setLocal(""); onChange(""); } }}
        placeholder={placeholder}
        leading={<Search />}
        className="h-8 text-[13px]"
        aria-label={label ?? placeholder}
        trailing={local ? (
          <button type="button" onClick={() => { setLocal(""); onChange(""); }} className="rounded p-1 text-subtle-foreground hover:text-foreground" aria-label="Clear search">
            <X className="size-3.5" />
          </button>
        ) : undefined}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, placeholder, className, label }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; className?: string; label?: string;
}) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger size="sm" className={cn("h-8 w-full sm:w-40", value && "border-[color-mix(in_oklab,var(--primary)_40%,transparent)] text-foreground", className)} aria-label={label ?? placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** "Clear filters" chip shown when any filter is active. */
export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null;
  return (
    <button type="button" onClick={onClear} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground transition hover:bg-surface-hover hover:text-foreground">
      <X className="size-3" /> Clear
    </button>
  );
}

/** Mono note that sorting applies to the current page only. */
export function SortNote({ sort, base = "Newest first" }: { sort: SortState; base?: string }) {
  return (
    <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground lg:inline" title="The API returns newest first; column sorting re-orders the rows on this page only.">
      {sort ? `Sorted · ${sort.key.replace(/_/g, " ")} ${sort.dir} · this page` : `${base} · sort columns per page`}
    </span>
  );
}

/* ================================================================== status tabs */

export function StatusTabs({ value, onChange, items, id, className }: {
  value: string; onChange: (v: string) => void; items: { value: string; label: string; count?: number; tone?: "danger" | "warning" }[]; id: string; className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div role="tablist" aria-label="Filter by status" className={cn("flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-background-subtle p-0.5 scrollbar-thin", className)}>
      {items.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn("relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {active && (
              <motion.span
                layoutId={`tabs-${id}`}
                className="absolute inset-0 rounded-md border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-card-elevated"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className="relative">{t.label}</span>
            {t.count != null && (
              <span className={cn("relative font-mono text-[10px] tabular", active ? "text-primary" : t.tone === "danger" && t.count ? "text-danger-foreground" : t.tone === "warning" && t.count ? "text-warning" : "text-subtle-foreground")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== pagination */

export function Pagination({ page, pages, total, onPage, label = "results", pageSize, onPageSize, sizes = [10, 25, 50, 100] }: {
  page: number; pages: number; total: number; onPage: (p: number) => void; label?: string; pageSize?: number; onPageSize?: (n: number) => void; sizes?: number[];
}) {
  const start = total === 0 ? 0 : (page - 1) * (pageSize ?? 0) + 1;
  const end = pageSize ? Math.min(total, page * pageSize) : total;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
      <span className="font-mono text-[11px] tabular tracking-[0.04em]">
        {pageSize ? <><span className="text-foreground">{formatNumber(start)}–{formatNumber(end)}</span> of {formatNumber(total)} {label}</> : <>{formatNumber(total)} {label}</>}
      </span>
      <div className="flex items-center gap-3">
        {onPageSize && pageSize && (
          <label className="hidden items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] sm:flex">
            Rows
            <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
              <SelectTrigger size="sm" className="h-7 w-[68px] font-mono text-[11.5px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
              <SelectContent>{sizes.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-xs" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <span className="min-w-[64px] text-center font-mono text-[11px] tabular">{String(page).padStart(2, "0")} / {String(Math.max(1, pages)).padStart(2, "0")}</span>
          <Button variant="outline" size="icon-xs" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== bulk bar */

/** Floating selection rail shown while rows are selected. */
export function BulkBar({ count, noun = "selected", onClear, children }: { count: number; noun?: string; onClear: () => void; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-2 border-b border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft px-4 py-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-primary">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-primary px-1 text-[10.5px] font-semibold text-primary-foreground tabular">{count}</span>
            {noun}
          </span>
          <span aria-hidden className="mx-1 h-4 w-px bg-[color-mix(in_oklab,var(--primary)_30%,transparent)]" />
          <div className="flex flex-wrap items-center gap-1.5">{children}</div>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onClear}><X /> Clear</Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================== responsive helpers */

/** Renders the table from `md` up and stacked cards below. */
export function Responsive({ table, cards }: { table: React.ReactNode; cards: React.ReactNode }) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{cards}</div>
    </>
  );
}

export function MobileCard({ children, onClick, selected, className }: { children: React.ReactNode; onClick?: () => void; selected?: boolean; className?: string }) {
  return (
    <div
      className={cn("border-b border-border px-4 py-3 last:border-0", onClick && "cursor-pointer active:bg-surface-hover", selected && "bg-primary-soft shadow-[inset_2px_0_0_var(--primary)]", className)}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && e.key === "Enter" && e.target === e.currentTarget) onClick(); }}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/** Small label:value line for mobile cards. */
export function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground">{label}</p>
      <div className="mt-0.5 truncate text-[12.5px] text-foreground-soft">{children}</div>
    </div>
  );
}
