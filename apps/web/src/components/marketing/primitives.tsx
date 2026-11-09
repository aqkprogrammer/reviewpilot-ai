import * as React from "react";
import { cn } from "@/lib/utils";

export { Reveal } from "@/components/ui/tech";

/** Heading colour used across the marketing site (kept as a token-driven alias). */
export const ink = "text-foreground";

/** Mono eyebrow: a signal tick, the label, and a trailing hairline. */
export function Eyebrow({ children, className, index }: { children: React.ReactNode; className?: string; index?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-primary", className)}>
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
      </span>
      {index && <span className="text-subtle-foreground">{index}</span>}
      {index && <span className="h-px w-4 bg-border-strong" aria-hidden />}
      <span>{children}</span>
    </span>
  );
}

/** "01 / 08" style section counter. */
export function SectionIndex({ n, total, className }: { n: number; total: number; className?: string }) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <span className={cn("font-mono text-[11px] tracking-[0.14em] text-subtle-foreground tabular", className)}>
      <span className="text-foreground-soft">{pad(n)}</span> / {pad(total)}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  as: As = "h2",
  index,
  aside,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
  as?: "h1" | "h2";
  /** e.g. [3, 8] renders "03 / 08" */
  index?: [number, number];
  aside?: React.ReactNode;
}) {
  if (align === "center") {
    return (
      <div className={cn("mx-auto max-w-2xl text-center", className)}>
        {(eyebrow || index) && (
          <div className="flex items-center justify-center gap-3">
            {index && <SectionIndex n={index[0]} total={index[1]} />}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          </div>
        )}
        <As className="mt-5 text-balance text-[32px] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-[44px]">{title}</As>
        {description && <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">{description}</p>}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-6 lg:grid-cols-12 lg:items-end", className)}>
      <div className="lg:col-span-7">
        {(eyebrow || index) && (
          <div className="flex items-center gap-4">
            {index && <SectionIndex n={index[0]} total={index[1]} />}
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          </div>
        )}
        <As className="mt-5 text-balance text-[32px] font-semibold leading-[1.04] tracking-[-0.038em] text-foreground sm:text-[46px]">{title}</As>
      </div>
      {(description || aside) && (
        <div className="lg:col-span-5 lg:pb-1.5">
          {description && <p className="max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
          {aside}
        </div>
      )}
    </div>
  );
}

export function Section({
  id,
  className,
  children,
  grid,
  rule = true,
  innerClassName,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  /** fine technical grid in the background */
  grid?: boolean;
  /** hairline at the top of the section */
  rule?: boolean;
  innerClassName?: string;
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28 lg:px-12", className)}>
      {rule && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-6xl bg-[linear-gradient(90deg,transparent,var(--border-strong)_20%,var(--border-strong)_80%,transparent)]" />}
      {grid && <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-80" />}
      <div className={cn("relative mx-auto max-w-6xl", innerClassName)}>{children}</div>
    </section>
  );
}

/** Small "+" crosshair markers placed at grid intersections. */
export function PlusMarks({ points, className }: { points: Array<[string, string]>; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {points.map(([left, top], i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 11 11" className="absolute -translate-x-1/2 -translate-y-1/2 text-border-strong" style={{ left, top }}>
          <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

/** Restrained signal light behind product imagery. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--cyan)_22%,transparent),color-mix(in_oklab,var(--ice)_8%,transparent)_55%,transparent_75%)]",
        className,
      )}
    />
  );
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-6xl px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/** Coordinate-like corner metadata for marketing visuals only. */
export function CoordLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground tabular", className)}>{children}</span>;
}

/** Instrument panel: card surface with a mono header strip. */
export function Panel({
  label,
  meta,
  className,
  bodyClassName,
  children,
  corners,
}: {
  label?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  corners?: boolean;
}) {
  return (
    <div className={cn("relative rounded-xl border border-border bg-card/80 shadow-md hairline-top", corners && "tech-corners", className)}>
      {(label || meta) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="micro-label truncate">{label}</span>
          {meta && <span className="shrink-0">{meta}</span>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Amber "SAMPLE DATA" tag for illustrative product mock-ups. */
export function SampleTag({ children = "Sample data", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--amber)_30%,transparent)] bg-amber-soft px-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber", className)}>
      <span className="size-1 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
