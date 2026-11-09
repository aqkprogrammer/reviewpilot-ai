"use client";
/**
 * Business-app instrument kit (overview, reviews, campaigns, QR):
 * panel headers with section indices, layoutId segmented controls,
 * SVG tick gauges/rings and segmented bars. Tokens only — no hard-coded colours.
 */
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

/* ------------------------------------------------------------------ */
/* Panel header                                                        */
/* ------------------------------------------------------------------ */

export function PanelHeader({
  index, eyebrow, title, description, action, className,
}: {
  index?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4", className)}>
      <div className="min-w-0">
        {(index || eyebrow) && (
          <p className="micro-label mb-1.5 flex items-center gap-2">
            {index && <span className="text-primary/80">{index}</span>}
            {index && eyebrow && <span aria-hidden className="h-px w-3 bg-border-strong" />}
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

/** Small arrow link used in panel headers. */
export function PanelLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition group-hover:text-primary", className)}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Segmented control with shared-layout indicator                      */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number | null;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  id, value, onChange, options, ariaLabel, size = "md", className, mono, fill,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
  mono?: boolean;
  /** Stretch options to fill the width (and wrap into a grid). */
  fill?: boolean;
}) {
  const reduce = useReducedMotion();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const enabled = options.map((o, idx) => (!o.disabled ? idx : -1)).filter((x) => x >= 0);
    const pos = enabled.indexOf(i);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 rounded-lg border border-border bg-background-subtle p-0.5",
        size === "md" ? "min-h-9" : "min-h-8",
        fill && "flex w-full flex-wrap [&>button]:flex-1",
        !fill && "overflow-x-auto scrollbar-thin",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium outline-none transition-colors focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:opacity-45 [&_svg]:size-3.5",
              size === "md" ? "h-8 text-[12.5px]" : "h-7 text-[12px]",
              mono && "font-mono text-[10.5px] uppercase tracking-[0.1em]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={reduce ? { duration: 0 } : SPRING}
                className="absolute inset-0 rounded-md bg-card-elevated shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_38%,transparent),0_1px_2px_rgb(0_0_0/0.2)]"
                aria-hidden
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon && <o.icon className={active ? "text-primary" : undefined} />}
              {o.label}
              {o.count != null && (
                <span className={cn("rounded-[4px] px-1 font-mono text-[10px] tabular", active ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-subtle-foreground")}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tick geometry                                                       */
/* ------------------------------------------------------------------ */

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * Segmented arc gauge (system-health style). `value` 0..max. Lit ticks reveal via a single
 * animated mask stroke. Optional secondary `marker` (e.g. period average) drawn as a notch.
 */
export function ArcGauge({
  value, max = 5, ticks = 41, marker, size = 240, className, label, children,
}: {
  value: number | null | undefined;
  max?: number;
  ticks?: number;
  marker?: number | null;
  size?: number;
  className?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/:/g, "");
  const cx = 120, cy = 120, start = -135, sweep = 270;
  const frac = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const lit = Math.round(frac * ticks);
  const items = Array.from({ length: ticks }, (_, i) => {
    const deg = start + (sweep * i) / (ticks - 1);
    const major = ((ticks - 1) / max) % 1 === 0 && i % ((ticks - 1) / max) === 0;
    const a = polar(cx, cy, major ? 82 : 86, deg);
    const b = polar(cx, cy, 100, deg);
    return { a, b, on: i < lit, i };
  });
  const scale = Array.from({ length: max + 1 }, (_, i) => ({ i, p: polar(cx, cy, 112, start + (sweep * i) / max) }));
  const mk = marker != null ? polar(cx, cy, 72, start + sweep * Math.max(0, Math.min(1, marker / max))) : null;
  const mk2 = marker != null ? polar(cx, cy, 64, start + sweep * Math.max(0, Math.min(1, marker / max))) : null;
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 240 240" className="size-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <mask id={`m-${uid}`} maskUnits="userSpaceOnUse">
            <motion.path
              d={arcPath(cx, cy, 92, start - 2, start + sweep + 2)}
              stroke="#fff"
              strokeWidth={34}
              fill="none"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: frac === 0 ? 0 : Math.min(1, frac + 0.01) }}
              transition={{ duration: 1.3, ease: EASE, delay: 0.15 }}
            />
          </mask>
        </defs>
        <path d={arcPath(cx, cy, 70, start, start + sweep)} fill="none" stroke="var(--border)" strokeWidth={1} />
        <path d={arcPath(cx, cy, 106, start, start + sweep)} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="1 5" />
        <g strokeLinecap="round">
          {items.map((t) => (
            <line key={t.i} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke="var(--border-strong)" strokeWidth={3} />
          ))}
        </g>
        <g mask={`url(#m-${uid})`} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px color-mix(in oklab, var(--primary) 55%, transparent))" }}>
          {items.filter((t) => t.on).map((t) => (
            <line key={t.i} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke="var(--primary)" strokeWidth={3} />
          ))}
        </g>
        {scale.map((s) => (
          <text key={s.i} x={s.p.x} y={s.p.y} textAnchor="middle" dominantBaseline="middle" fill="var(--subtle-foreground)" fontSize={9} fontFamily="var(--font-geist-mono)">{s.i}</text>
        ))}
        {mk && mk2 && <line x1={mk.x} y1={mk.y} x2={mk2.x} y2={mk2.y} stroke="var(--amber)" strokeWidth={2.5} strokeLinecap="round" />}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * Ring of ticks split into coloured categories (sentiment, devices…).
 * Ticks are allocated by share; empty data renders an idle ring.
 */
export function TickRing({
  data, ticks = 72, size = 168, className, label, children,
}: {
  data: { key: string; value: number; color: string }[];
  ticks?: number;
  size?: number;
  className?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/:/g, "");
  const total = data.reduce((a, d) => a + d.value, 0);
  // Largest-remainder allocation so tick counts sum exactly.
  const alloc = React.useMemo(() => {
    if (!total) return [] as string[];
    const raw = data.map((d) => ({ key: d.key, color: d.color, exact: (d.value / total) * ticks }));
    const base = raw.map((r) => ({ ...r, n: Math.floor(r.exact) }));
    let left = ticks - base.reduce((a, b) => a + b.n, 0);
    [...base].sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).forEach((r) => { if (left > 0 && r.exact > 0) { r.n += 1; left -= 1; } });
    return base.flatMap((r) => Array<string>(r.n).fill(r.color));
  }, [data, total, ticks]);
  const cx = 100, cy = 100;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label={label}>
        <defs>
          <mask id={`r-${uid}`} maskUnits="userSpaceOnUse">
            <motion.circle
              cx={cx} cy={cy} r={84} fill="none" stroke="#fff" strokeWidth={30}
              transform={`rotate(-90 ${cx} ${cy})`}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
            />
          </mask>
        </defs>
        <circle cx={cx} cy={cy} r={64} fill="none" stroke="var(--border)" strokeWidth={1} />
        <g strokeLinecap="round">
          {Array.from({ length: ticks }, (_, i) => {
            const deg = (360 * i) / ticks;
            const a = polar(cx, cy, 74, deg);
            const b = polar(cx, cy, 94, deg);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border-strong)" strokeWidth={3} />;
          })}
        </g>
        <g mask={`url(#r-${uid})`} strokeLinecap="round">
          {alloc.map((color, i) => {
            const deg = (360 * i) / ticks;
            const a = polar(cx, cy, 74, deg);
            const b = polar(cx, cy, 94, deg);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={3} />;
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * Segmented horizontal bar: a masked track with a single animated fill.
 * `value` is 0..1 of the track.
 */
export function SegBar({ value, color = "var(--primary)", className, height = 10 }: { value: number; color?: string; className?: string; height?: number; glow?: boolean }) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(1, value || 0));
  const mask = "repeating-linear-gradient(90deg, #000 0 5px, transparent 5px 7px)";
  return (
    <div className={cn("relative w-full overflow-hidden", className)} style={{ height, WebkitMaskImage: mask, maskImage: mask }} aria-hidden>
      <div className="absolute inset-0 bg-border-strong opacity-70" />
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left"
        style={{ background: color }}
        initial={{ scaleX: reduce ? v : 0 }}
        whileInView={{ scaleX: v }}
        viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
      />
    </div>
  );
}

/** Thin solid meter (for table cells). */
export function LineMeter({ value, color = "var(--primary)", className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cn("relative h-1 w-full overflow-hidden rounded-full bg-border", className)} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

/** Mono timestamp chip, e.g. 08 NOV · 14:22 */
export function MonoTime({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em] tabular text-subtle-foreground", className)}>{children}</span>;
}

/** Shared selectable-card styling (wizard choices, templates, etc.). */
export function choiceClass(selected: boolean) {
  return cn(
    "relative rounded-xl border text-left outline-none transition-[border-color,background-color,box-shadow] duration-200 focus-visible:ring-[1.5px] focus-visible:ring-ring",
    selected
      ? "border-[color-mix(in_oklab,var(--primary)_60%,transparent)] bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent),0_0_22px_-10px_var(--primary)]"
      : "border-border bg-background-subtle/40 hover:border-border-strong hover:bg-surface-hover/60",
  );
}
