import * as React from "react";
import { CoordLabel, Eyebrow, Glow } from "./primitives";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
  aside,
  path,
  meta,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Optional visual rendered to the right on large screens. */
  aside?: React.ReactNode;
  /** Breadcrumb-like path shown in the top rule, e.g. "solutions / clinics". */
  path?: string;
  meta?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden px-5 sm:px-8 lg:px-12", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-tech-grid-fade opacity-90" />
        <Glow className="right-[-10%] top-[-30%] size-[640px] opacity-60" />
        <div className="absolute inset-0 bg-noise" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center justify-between border-b border-border/70 py-3">
          <CoordLabel>
            reviewpilot.ai <span className="text-border-strong">/</span> <span className="text-foreground-soft">{path ?? eyebrow.toLowerCase()}</span>
          </CoordLabel>
          {meta && <CoordLabel className="hidden sm:inline">{meta}</CoordLabel>}
        </div>
        <div className={cn("grid gap-12 pb-16 pt-14 sm:pb-20 sm:pt-20", aside && "items-center lg:grid-cols-12 lg:gap-10")}>
          <div className={cn(aside ? "lg:col-span-6" : "max-w-3xl")}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[1.0] tracking-[-0.045em] text-foreground sm:text-[56px] lg:text-[62px]">{title}</h1>
            {description && <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-foreground-soft sm:text-[17.5px]">{description}</p>}
            {children && <div className="mt-9">{children}</div>}
          </div>
          {aside && <div className="relative lg:col-span-6">{aside}</div>}
        </div>
      </div>
    </section>
  );
}

export function Split({
  id,
  eyebrow,
  title,
  body,
  points,
  visual,
  reverse,
  index,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
  index?: string;
}) {
  return (
    <section id={id} className="relative scroll-mt-32 px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-6xl bg-[linear-gradient(90deg,transparent,var(--border-strong)_20%,var(--border-strong)_80%,transparent)]" />
      <div className={cn("mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-12 lg:gap-14", reverse && "lg:[&>*:first-child]:order-2")}>
        <div className="lg:col-span-5">
          <Eyebrow index={index}>{eyebrow}</Eyebrow>
          <h2 className="mt-5 text-balance text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-[38px]">{title}</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
          <ul className="mt-7 divide-y divide-border border-y border-border">
            {points.map((p) => (
              <li key={p} className="flex gap-3 py-3 text-[14px] leading-relaxed text-foreground-soft">
                <span className="mt-[9px] h-px w-3 shrink-0 bg-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative lg:col-span-7">
          <div className="pointer-events-none absolute -inset-8 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--cyan)_9%,transparent),transparent_70%)]" aria-hidden />
          <div className="relative">{visual}</div>
        </div>
      </div>
    </section>
  );
}
