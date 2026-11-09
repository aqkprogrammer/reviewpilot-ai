"use client";
/**
 * Console kit — shared "Instrument" building blocks for the business-app workspace pages
 * (customers, AI assistant, analytics, locations, team, integrations, billing, settings).
 * Everything is token-driven; no hard-coded colours.
 */
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";

/* ------------------------------------------------------------------------------------------------
 * Eyebrow: "01 · CRM / CONTACT REGISTRY" style breadcrumb label for page headers.
 * ---------------------------------------------------------------------------------------------- */
export function Eyebrow({ parts, live }: { parts: React.ReactNode[]; live?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">
      {live && <span className="relative inline-flex size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" aria-hidden />}
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-border-strong" aria-hidden>/</span>}
          <span className={i === parts.length - 1 ? "text-muted-foreground" : undefined}>{p}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Readout strip: a horizontal telemetry row of label/value pairs separated by hairlines.
 * Only feed it values that come from the API.
 * ---------------------------------------------------------------------------------------------- */
export type StripItem = { label: string; value: React.ReactNode; tone?: "default" | "signal" | "ok" | "warn" | "danger" | "muted"; hint?: string };
const STRIP_TONE = {
  default: "text-foreground",
  signal: "text-primary",
  ok: "text-success-foreground",
  warn: "text-warning-foreground",
  danger: "text-danger-foreground",
  muted: "text-muted-foreground",
} as const;

export function ReadoutStrip({ items, className }: { items: StripItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:flex", className)}>
      {items.map((it) => (
        <div key={it.label} title={it.hint} className="min-w-0 bg-background-subtle px-4 py-3 sm:flex-1 [&:last-child:nth-child(odd)]:col-span-2">
          <dt className="micro-label truncate">{it.label}</dt>
          <dd className={cn("mt-1.5 truncate font-mono text-[14px] font-medium tabular", STRIP_TONE[it.tone ?? "default"])}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Panel: card with an instrument header (index · micro-label, title, description, actions).
 * ---------------------------------------------------------------------------------------------- */
export function Panel({
  index, label, title, description, actions, icon: Icon, children, className, bodyClassName, flush, id,
}: {
  index?: string;
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Body without padding (tables, lists). */
  flush?: boolean;
  id?: string;
}) {
  const hasHead = index || label || title || actions;
  return (
    <Card className={cn("flex min-w-0 flex-col overflow-hidden", className)} id={id}>
      {hasHead && (
        <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-4", flush ? "border-b border-border pb-4" : "pb-1")}>
          <div className="min-w-0">
            {(index || label) && (
              <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">
                {index && <span className="text-primary/80">{index}</span>}
                {index && label && <span className="h-px w-3 bg-border-strong" aria-hidden />}
                {label}
              </p>
            )}
            {title && (
              <h3 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">
                {Icon && <Icon className="size-4 text-primary" />}
                {title}
              </h3>
            )}
            {description && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("min-w-0 flex-1", !flush && "p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Monogram: token-tinted initials tile (replaces the generic round avatar in workspace tables).
 * ---------------------------------------------------------------------------------------------- */
const MONO_TONES = [
  "bg-cyan-soft text-cyan border-[color-mix(in_oklab,var(--cyan)_22%,transparent)]",
  "bg-ice-soft text-ice border-[color-mix(in_oklab,var(--ice)_22%,transparent)]",
  "bg-mint-soft text-mint border-[color-mix(in_oklab,var(--mint)_22%,transparent)]",
  "bg-amber-soft text-amber border-[color-mix(in_oklab,var(--amber)_24%,transparent)]",
  "bg-muted text-foreground-soft border-border-strong",
];

export function Monogram({ name, src, size = 32, className, tone }: { name?: string | null; src?: string | null; size?: number; className?: string; tone?: number }) {
  const hash = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [failed, setFailed] = React.useState(false);
  return (
    <span
      className={cn("relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden border font-mono font-semibold uppercase", MONO_TONES[(tone ?? hash) % MONO_TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(9.5, size * 0.33), borderRadius: Math.max(6, size * 0.26) }}
      aria-hidden
    >
      {src && !failed ? <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Console tabs: Radix tabs with a shared-layout (layoutId) signal underline.
 * Must be used with a controlled `value` so the indicator knows which trigger is active.
 * ---------------------------------------------------------------------------------------------- */
export function ConsoleTabsList({
  id, value, items, className,
}: {
  id: string;
  value: string;
  items: { value: string; label: string; icon?: React.ComponentType<{ className?: string }>; count?: React.ReactNode }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 scrollbar-thin sm:mx-0 sm:px-0", className)}>
      <T.List className="relative flex min-w-max items-center gap-1 border-b border-border">
        {items.map((it) => {
          const active = it.value === value;
          return (
            <T.Trigger
              key={it.value}
              value={it.value}
              className={cn(
                "group relative inline-flex h-10 items-center gap-2 rounded-t-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:bg-surface-hover",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {it.icon && <it.icon className={cn("size-3.5 transition-colors", active ? "text-primary" : "text-subtle-foreground group-hover:text-muted-foreground")} />}
              {it.label}
              {it.count != null && <span className={cn("rounded-[4px] px-1 font-mono text-[10px] tabular", active ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-subtle-foreground")}>{it.count}</span>}
              {active && (
                <motion.span
                  layoutId={`${id}-tab-indicator`}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
                  aria-hidden
                />
              )}
            </T.Trigger>
          );
        })}
      </T.List>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Segmented choice with a sliding layoutId thumb (interval toggles, tone pickers, etc.).
 * ---------------------------------------------------------------------------------------------- */
export function SlideToggle<V extends string>({
  id, value, onChange, options, label, size = "md", className,
}: {
  id: string;
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: React.ReactNode }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-background-subtle p-0.5", size === "sm" ? "h-8" : "h-9", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex h-full items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-[1.5px] focus-visible:ring-ring",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-md bg-card-elevated shadow-[inset_0_0_0_1px_var(--border-strong)]"
                aria-hidden
              />
            )}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Thin meter bar with optional tone; animates width on mount.
 * ---------------------------------------------------------------------------------------------- */
const METER_TONES = { primary: "bg-primary", ice: "bg-ice", mint: "bg-mint", amber: "bg-amber", success: "bg-success", warning: "bg-warning", danger: "bg-danger", muted: "bg-subtle-foreground" } as const;
export type MeterTone = keyof typeof METER_TONES;

export function MeterBar({ value, max = 1, tone = "primary", className, glow, label }: { value: number; max?: number; tone?: MeterTone; className?: string; glow?: boolean; label?: string }) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)} role={label ? "meter" : undefined} aria-label={label} aria-valuenow={label ? Math.round(pct) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}>
      <motion.div
        className={cn("h-full rounded-full", METER_TONES[tone], glow && "shadow-[0_0_8px_currentColor]")}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Key/value list in mono (connection details, session metadata).
 * ---------------------------------------------------------------------------------------------- */
export function KVList({ items, className }: { items: { label: string; value: React.ReactNode; mono?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border rounded-lg border border-border bg-background-subtle/50", className)}>
      {items.map((i) => (
        <div key={i.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
          <dt className="micro-label shrink-0">{i.label}</dt>
          <dd className={cn("min-w-0 truncate text-right text-[12.5px] text-foreground", i.mono !== false && "font-mono tabular")}>{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Icon tile: framed square for entity / provider icons.
 * ---------------------------------------------------------------------------------------------- */
export function IconTile({ children, className, size = 40, signal }: { children: React.ReactNode; className?: string; size?: number; signal?: boolean }) {
  return (
    <span
      className={cn(
        "tech-corners relative flex shrink-0 items-center justify-center rounded-lg border bg-card-elevated [&_svg]:size-[45%]",
        signal ? "border-[color-mix(in_oklab,var(--primary)_40%,var(--border-strong))] text-primary shadow-[0_0_18px_-6px_var(--primary)]" : "border-border-strong text-foreground-soft",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Filter chip that shows an active filter and clears it.
 * ---------------------------------------------------------------------------------------------- */
export function FilterChip({ label, onClear }: { label: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft pl-2 pr-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-primary-soft-foreground">
      {label}
      <button type="button" onClick={onClear} className="rounded-[3px] px-1 text-[12px] leading-none opacity-70 transition hover:bg-primary-soft hover:opacity-100" aria-label={`Clear filter ${typeof label === "string" ? label : ""}`}>
        ×
      </button>
    </span>
  );
}

/** Format a number as a two-digit index ("01"). */
export const pad2 = (n: number) => String(n).padStart(2, "0");
