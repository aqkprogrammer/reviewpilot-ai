"use client";
/**
 * Holographic interface primitives shared by marketing, auth, the business dashboard and
 * the admin command center. All colour comes from tokens; motion respects reduced motion.
 */
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ TechnicalLabel */

export function TechnicalLabel({
  children, index, tone = "muted", className, bracket = false,
}: {
  children: React.ReactNode;
  index?: string;
  tone?: "muted" | "signal" | "mint" | "amber";
  className?: string;
  bracket?: boolean;
}) {
  const color = { muted: "text-subtle-foreground", signal: "text-primary", mint: "text-mint", amber: "text-amber" }[tone];
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]", color, className)}>
      {index && <span className="text-subtle-foreground">{index}</span>}
      {index && <span aria-hidden className="h-px w-4 bg-current opacity-40" />}
      {bracket ? <span>[ {children} ]</span> : <span>{children}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ HolographicPanel */

/**
 * Translucent operational display: thin signal border, edge lighting, corner ticks,
 * mono header, optional perspective tilt. `active` brightens the edge light.
 */
export function HolographicPanel({
  label, status, statusTone = "signal", active, tilt, className, children, delay = 0, as: Tag = "div",
}: {
  label: string;
  status?: string;
  statusTone?: "signal" | "mint" | "amber" | "ice" | "muted";
  active?: boolean;
  tilt?: "left" | "right";
  className?: string;
  children: React.ReactNode;
  delay?: number;
  as?: "div" | "section" | "article";
}) {
  const reduce = useReducedMotion();
  const tone = { signal: "text-primary", mint: "text-mint", amber: "text-amber", ice: "text-ice", muted: "text-subtle-foreground" }[statusTone];
  const MotionTag = motion[Tag];
  const panel = (
    <MotionTag
      initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group/holo relative overflow-hidden rounded-lg border bg-[color-mix(in_oklab,var(--card)_58%,transparent)] backdrop-blur-[10px] transition-[border-color,box-shadow] duration-500",
        active
          ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_18%,transparent),0_18px_50px_-18px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          : "border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] shadow-[0_18px_44px_-22px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      {/* edge lighting */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_80%,transparent),transparent)] opacity-70" />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_60%,transparent),transparent_70%)] opacity-60" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_45%)]" />
      {/* corner ticks */}
      <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 size-2 border-r border-t border-[color-mix(in_oklab,var(--primary)_60%,transparent)]" />
      <span aria-hidden className="pointer-events-none absolute bottom-1.5 left-1.5 size-2 border-b border-l border-[color-mix(in_oklab,var(--primary)_40%,transparent)]" />
      <div className="relative flex items-center justify-between gap-3 border-b border-[color-mix(in_oklab,var(--primary)_14%,var(--border))] px-3 py-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-foreground-soft">{label}</span>
        {status && (
          <span className={cn("flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em]", tone)}>
            <span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            {status}
          </span>
        )}
      </div>
      <div className="relative px-3 py-2.5">{children}</div>
    </MotionTag>
  );
  if (!tilt) return panel;
  // Perspective lives on a wrapper so Motion's own transform (entrance) doesn't override it.
  return (
    <div style={{ transform: `perspective(1200px) rotateY(${tilt === "left" ? 7 : -7}deg)`, transformStyle: "preserve-3d" }}>{panel}</div>
  );
}

/* ------------------------------------------------------------------ SentimentVisualization */

export function SentimentVisualization({
  positive, neutral, negative, className, compact,
}: {
  positive: number;
  neutral: number;
  negative: number;
  className?: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const rows = [
    { label: "Positive", value: positive, color: "bg-mint", text: "text-mint" },
    { label: "Neutral", value: neutral, color: "bg-ice", text: "text-ice" },
    { label: "Negative", value: negative, color: "bg-amber", text: "text-amber" },
  ];
  return (
    <div className={cn("space-y-1.5", className)}>
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[64px_1fr_34px] items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{r.label}</span>
          <span className={cn("relative overflow-hidden rounded-[2px] bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)]", compact ? "h-1" : "h-1.5")}>
            <motion.span
              className={cn("absolute inset-y-0 left-0 rounded-[2px] shadow-[0_0_8px_currentColor]", r.color, r.text)}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, r.value))}%` }}
              transition={{ duration: 1.1, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <span className={cn("text-right font-mono text-[10.5px] tabular", r.text)}>{Math.round(r.value)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ IntelligenceStatus */

export const PIPELINE = ["Review ingestion", "Sentiment analysis", "Response generation", "Awaiting approval"] as const;

/** Pipeline stage readout. `active` is the current stage index; earlier stages show as complete. */
export function IntelligenceStatus({
  active, stages = PIPELINE as unknown as string[], className, orientation = "horizontal", counts,
}: {
  active: number;
  stages?: string[];
  className?: string;
  orientation?: "horizontal" | "vertical";
  /** Optional real counts per stage (admin/dashboard use). */
  counts?: (string | number | null | undefined)[];
}) {
  return (
    <ol className={cn("flex gap-1.5", orientation === "vertical" ? "flex-col" : "flex-wrap", className)} aria-label="Intelligence pipeline">
      {stages.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "idle";
        return (
          <li
            key={s}
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "relative flex items-center gap-2 rounded-[5px] border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-colors duration-500",
              state === "active" && "border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-primary-soft text-primary",
              state === "done" && "border-border text-mint",
              state === "idle" && "border-border text-subtle-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full bg-current", state === "active" && "shadow-[0_0_8px_currentColor] motion-safe:animate-pulse")} />
            {s}
            {counts?.[i] != null && <span className="ml-1 text-foreground tabular">{counts[i]}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ Backgrounds */

/** Fine grid with sparse "+" markers at intersections (no fake coordinates). */
export function AmbientGrid({ className, markers = true, fade = true }: { className?: string; markers?: boolean; fade?: boolean }) {
  const pid = `rp-plus-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className={cn("absolute inset-0 bg-tech-grid", fade && "[mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,#000_30%,transparent_100%)]")} />
      {markers && (
        <svg className="absolute inset-0 size-full text-[color-mix(in_oklab,var(--primary)_45%,transparent)]" preserveAspectRatio="none">
          <defs>
            <pattern id={pid} width="256" height="256" patternUnits="userSpaceOnUse">
              <path d="M128 123v10M123 128h10" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${pid})`} className={fade ? "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_20%,transparent_85%)]" : undefined} />
        </svg>
      )}
    </div>
  );
}

/** Deep cinematic backdrop: ambient light, grid, one slow scanning line, grain. */
export function CinematicBackground({ className, scan = true, intensity = 1 }: { className?: string; scan?: boolean; intensity?: number }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_72%_38%,color-mix(in_oklab,var(--cyan)_14%,transparent),transparent_70%),radial-gradient(45%_40%_at_18%_80%,color-mix(in_oklab,var(--ice)_9%,transparent),transparent_70%)]" style={{ opacity: intensity }} />
      <AmbientGrid />
      {scan && (
        <div className="absolute inset-x-0 top-0 h-full motion-safe:animate-[rp-scanline_11s_linear_infinite] motion-reduce:hidden">
          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_45%,transparent),transparent)]" />
          <div className="h-24 w-full bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_5%,transparent),transparent)]" />
        </div>
      )}
      <div className="absolute inset-0 bg-noise" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_55%,var(--background)_100%)]" />
    </div>
  );
}
