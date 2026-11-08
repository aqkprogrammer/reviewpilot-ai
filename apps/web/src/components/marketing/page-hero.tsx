import * as React from "react";
import { Eyebrow, PlusMarks, ink } from "./primitives";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden px-5 pb-14 pt-14 sm:px-8 sm:pt-20 lg:px-12", className)}>
      <div className="bg-crosshair absolute inset-0" aria-hidden />
      <PlusMarks className="hidden md:block" points={[["16%", "60px"], ["84%", "60px"], ["10%", "85%"], ["90%", "85%"]]} />
      <div className="relative mx-auto max-w-3xl text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={cn("mt-5 text-balance text-[38px] font-bold leading-[1.02] tracking-[-0.045em] sm:text-[56px]", ink)}>{title}</h1>
        {description && <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-relaxed text-foreground-soft sm:text-[17px]">{description}</p>}
        {children && <div className="mt-8">{children}</div>}
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
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className={cn("mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2", reverse && "lg:[&>*:first-child]:order-2")}>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
          <h2 className={cn("mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[38px]", ink)}>{title}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-[14px] text-foreground-soft">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.12),transparent_70%)]" aria-hidden />
          {visual}
        </div>
      </div>
    </section>
  );
}
