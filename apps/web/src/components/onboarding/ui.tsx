"use client";
import * as React from "react";
import { Check, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/session";
import { cn } from "@/lib/utils";
import { STEPS } from "./types";

export function Rail({ step, maxReached, onJump }: { step: number; maxReached: number; onJump: (s: number) => void }) {
  return (
    <aside className="relative hidden w-[300px] shrink-0 flex-col overflow-hidden border-r border-border bg-[linear-gradient(180deg,#f6f1ff,#f1ebff_60%,#f9eefb)] px-7 py-7 lg:flex dark:bg-[linear-gradient(180deg,#141022,#110d1f_60%,#170e20)]">
      <div className="bg-crosshair absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex items-center justify-between"><Logo /></div>
      <p className="relative mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b4fe0] dark:text-primary-soft-foreground">Set up your workspace</p>
      <ol className="relative mt-5 space-y-1">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          const reachable = n <= maxReached && n !== step;
          return (
            <li key={s.key} className="relative">
              {i < STEPS.length - 1 && <span className={cn("absolute left-[15px] top-9 h-[calc(100%-18px)] w-px", done ? "bg-primary/50" : "bg-border-strong/70")} aria-hidden />}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(n)}
                aria-current={active ? "step" : undefined}
                className={cn("flex w-full items-start gap-3 rounded-xl px-1.5 py-2 text-left transition", reachable && "hover:bg-white/60 dark:hover:bg-white/5", !reachable && !active && "cursor-default")}
              >
                <span
                  className={cn(
                    "relative z-10 flex size-[22px] shrink-0 translate-x-[3px] items-center justify-center rounded-full border text-[11px] font-semibold transition",
                    done && "border-primary bg-primary text-white",
                    active && "border-primary bg-card text-primary ring-4 ring-primary/15",
                    !done && !active && "border-border-strong bg-card text-subtle-foreground",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : n}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[13.5px] font-medium leading-tight", active ? "text-foreground" : done ? "text-foreground-soft" : "text-muted-foreground")}>{s.label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-subtle-foreground">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="relative mt-auto rounded-2xl border border-white/70 bg-white/70 p-4 text-[12.5px] leading-relaxed text-foreground-soft backdrop-blur dark:border-border dark:bg-card/60">
        Progress is saved after every step. You can skip any integration and finish it later from <span className="font-medium text-foreground">Integrations</span>.
      </div>
    </aside>
  );
}

export function MobileProgress({ step }: { step: number }) {
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="text-xs font-medium text-muted-foreground">Step {step} of {STEPS.length}</span>
      </div>
      <div className="mt-4 flex gap-1">
        {STEPS.map((s, i) => <span key={s.key} className={cn("h-1 flex-1 rounded-full", i + 1 <= step ? "bg-primary" : "bg-muted")} />)}
      </div>
    </div>
  );
}

export function TopActions() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <Button variant="ghost" size="sm" onClick={() => logout()}><LogOut /> Sign out</Button>
    </div>
  );
}

export function StepHeader({ step, title, description, icon: Icon }: { step: number; title: string; description?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Step {step} of {STEPS.length}</p>
      <div className="mt-3 flex items-start gap-4">
        {Icon && <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-sm sm:flex"><Icon className="size-5 text-primary" /></span>}
        <div>
          <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[#1d0b3a] dark:text-foreground sm:text-[30px]">{title}</h1>
          {description && <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  );
}

export function StepFooter({
  onBack, onSkip, primary, skipLabel = "Skip for now",
}: {
  onBack?: () => void;
  onSkip?: () => void;
  primary: React.ReactNode;
  skipLabel?: string;
}) {
  return (
    <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
      {onBack && <Button type="button" variant="ghost" onClick={onBack}>Back</Button>}
      <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onSkip && <Button type="button" variant="outline" onClick={onSkip}>{skipLabel}</Button>}
        {primary}
      </div>
    </div>
  );
}

export function ChoiceCard({ selected, onClick, icon: Icon, title, description, badge, disabled }: { selected: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; title: string; description: string; badge?: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-start gap-3.5 rounded-2xl border bg-card p-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55",
        selected ? "border-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]" : "border-border hover:border-border-strong hover:shadow-sm",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary text-white" : "bg-muted text-foreground-soft")}><Icon className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">{title}{badge}</span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition", selected ? "border-primary bg-primary text-white" : "border-border-strong")}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
