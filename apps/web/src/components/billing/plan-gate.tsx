"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Upgrade prompt shown for 402 plan_limit_exceeded responses. */
export function UpgradePrompt({ message, compact }: { message?: string; compact?: boolean }) {
  return (
    <Card className={cn("relative overflow-hidden", compact ? "p-5" : "p-8 text-center")}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,#000_20%,transparent_75%)]" />
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--amber),transparent)] opacity-70" />
      <div className={cn("relative", compact ? "flex items-start gap-4" : "flex flex-col items-center")}>
        <span className="tech-corners flex size-10 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--amber)_35%,var(--border-strong))] bg-amber-soft text-amber">
          <LockKeyhole className="size-[18px]" />
        </span>
        <div className={compact ? "min-w-0 flex-1" : "mt-4"}>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber">Plan limit</p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em]">Upgrade to unlock this</p>
          <p className={cn("mt-1 text-[13px] leading-relaxed text-muted-foreground", !compact && "mx-auto max-w-md")}>
            {message ?? "This feature isn't included in your current plan."}
          </p>
          <Button asChild size="sm" className={compact ? "mt-3" : "mt-5"}>
            <Link href="/app/subscription">See plans <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ReadOnlyNotice({ message }: { message?: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-60 [mask-image:radial-gradient(ellipse_45%_60%_at_50%_45%,#000_20%,transparent_75%)]" />
      <span className="tech-corners relative mb-4 flex size-11 items-center justify-center rounded-lg border border-border-strong bg-card-elevated text-muted-foreground"><Lock className="size-5" /></span>
      <p className="relative font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">Access restricted</p>
      <p className="relative mt-1.5 text-[15px] font-semibold">You don&apos;t have access to this</p>
      <p className="relative mt-1.5 max-w-sm text-[13px] text-muted-foreground">{message ?? "Your role doesn't include this area. Ask an owner or admin if you need access."}</p>
    </div>
  );
}

/** Renders the right state for a failed query based on the API error code. */
export function QueryErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError) {
    if (error.status === 402) return <UpgradePrompt message={error.message} />;
    if (error.status === 403) return <ReadOnlyNotice message={error.message} />;
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }
  return <ErrorState message="We couldn't load this right now." onRetry={onRetry} />;
}
