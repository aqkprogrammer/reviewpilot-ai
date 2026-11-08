"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Deep plum-ink heading colour used across the marketing site. */
export const ink = "text-[#1d0b3a] dark:text-foreground";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#e3d6fb] bg-[#f6f0ff] px-3 py-1 text-xs font-medium text-[#6b3fd6] dark:border-primary/25 dark:bg-primary-soft dark:text-primary-soft-foreground",
        className,
      )}
    >
      <span className="h-px w-3 bg-current opacity-60" aria-hidden />
      {children}
      <span className="h-px w-3 bg-current opacity-60" aria-hidden />
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  as: As = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <As className={cn("mt-4 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[42px]", ink)}>{title}</As>
      {description && <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("relative px-5 py-20 sm:px-8 sm:py-24 lg:px-12", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Reveal({ children, delay = 0, className, y = 14 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Small "+" crosshair markers placed at grid intersections. */
export function PlusMarks({ points, className }: { points: Array<[string, string]>; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {points.map(([left, top], i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 13 13"
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[#cbbfe6] dark:text-border-strong"
          style={{ left, top }}
        >
          <path d="M6.5 0v13M0 6.5h13" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

/** Soft violet/magenta glow (used behind product imagery). */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-0 rounded-full opacity-70 blur-3xl dark:opacity-40",
        "bg-[radial-gradient(closest-side,rgba(214,58,240,0.35),rgba(124,92,255,0.28)_45%,transparent_75%)]",
        className,
      )}
    />
  );
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-6xl px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}
