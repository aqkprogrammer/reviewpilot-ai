"use client";
import * as React from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api";

/** Upgrade prompt shown for 402 plan_limit_exceeded responses. */
export function UpgradePrompt({ message, compact }: { message?: string; compact?: boolean }) {
  return (
    <Card className={compact ? "relative overflow-hidden p-5" : "relative overflow-hidden p-8 text-center"}>
      <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className={compact ? "flex items-start gap-4" : "flex flex-col items-center"}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--purple))] text-white shadow-glow">
          <Sparkles className="size-5" />
        </span>
        <div className={compact ? "min-w-0 flex-1" : "mt-4"}>
          <p className="text-[15px] font-semibold tracking-tight">Upgrade to unlock this</p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {message ?? "This feature isn't included in your current plan."}
          </p>
          <Button asChild size="sm" className={compact ? "mt-3" : "mt-5"}>
            <Link href="/app/subscription">See plans</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ReadOnlyNotice({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Lock className="size-5" /></span>
      <p className="text-[15px] font-semibold">You don't have access to this</p>
      <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{message ?? "Your role doesn't include this area. Ask an owner or admin if you need access."}</p>
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
