import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, eyebrow, className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Short technical context shown above the title (string → mono micro-label). */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2.5">{typeof eyebrow === "string" ? <span className="micro-label">{eyebrow}</span> : eyebrow}</div>}
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
