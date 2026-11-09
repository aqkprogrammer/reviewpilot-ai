"use client";
/**
 * "Instrument" primitives — the technical detailing that gives ReviewPilot its identity.
 * Use sparingly: one or two per view, never decoration for its own sake.
 */
import * as React from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Uppercase monospace metadata label, e.g. SYSTEM STATUS. */
export function MicroLabel({ children, className, as: Tag = "span" }: { children: React.ReactNode; className?: string; as?: "span" | "p" | "div" | "h2" | "h3" }) {
  return <Tag className={cn("micro-label", className)}>{children}</Tag>;
}

/** Label/value readout pair: "LAST SYNC  00:04:21 AGO". */
export function Readout({ label, value, className, valueClassName }: { label: React.ReactNode; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="micro-label">{label}</span>
      <span className={cn("font-mono text-[13px] tabular text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

const DOT_TONES = {
  live: "text-mint",
  ok: "text-success",
  warn: "text-warning",
  error: "text-danger",
  idle: "text-subtle-foreground",
  signal: "text-primary",
} as const;

/** Status indicator. `pulse` adds a soft halo for live/real-time states. */
export function StatusDot({ tone = "ok", pulse, className, label }: { tone?: keyof typeof DOT_TONES; pulse?: boolean; className?: string; label?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", DOT_TONES[tone], className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {pulse && <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping" />}
      <span className="relative inline-flex size-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
    </span>
  );
}

/** Frame with corner brackets — for hero visuals, key metrics, selected states. */
export function TechFrame({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("tech-corners", className)} {...props}>
      {children}
    </div>
  );
}

/** Animated count-up for metrics. Formats with the provided formatter; respects reduced motion. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 0.9, className }: { value: number | null | undefined; format?: (n: number) => string; duration?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (n) => format(n));
  React.useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    if (reduce || !inView) {
      if (reduce) mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, inView, reduce, duration, mv]);
  if (value == null || Number.isNaN(value)) return <span className={className}>—</span>;
  return <motion.span ref={ref} className={cn("tabular", className)}>{text}</motion.span>;
}

/** Fade + rise on first view. Wrap sections, not individual list items. */
export function Reveal({ children, delay = 0, className, y = 14 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Page-level entrance used by app/admin layouts. */
export function PageTransition({ children, className, routeKey }: { children: React.ReactNode; className?: string; routeKey?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={routeKey}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Ambient backdrop: fine grid + radial signal light + grain. Place inside a relative, overflow-hidden parent. */
export function GridBackdrop({ className, drift, light = true }: { className?: string; drift?: boolean; light?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className={cn("absolute inset-0 bg-tech-grid-fade", drift && "motion-safe:bg-tech-grid-drift")} />
      {light && <div className="absolute inset-0 bg-radial-signal" />}
      <div className="absolute inset-0 bg-noise" />
    </div>
  );
}

/** Keyboard key cap. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-border-strong bg-background-subtle px-1 font-mono text-[10.5px] text-muted-foreground", className)}>{children}</kbd>;
}

/** Thin segmented meter (e.g. security / health scores). */
export function SegmentMeter({ value, segments = 12, tone = "primary", className }: { value: number; segments?: number; tone?: "primary" | "success" | "warning" | "danger"; className?: string }) {
  const on = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  const color = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn("h-3 w-[3px] rounded-[1px]", i < on ? cn(color, "shadow-[0_0_6px_-1px_currentColor]") : "bg-border-strong")} />
      ))}
    </span>
  );
}
