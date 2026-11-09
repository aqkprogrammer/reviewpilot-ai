"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/tech";
import { logout } from "@/lib/session";
import { cn } from "@/lib/utils";
import { STEPS } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function Rail({ step, maxReached, onJump }: { step: number; maxReached: number; onJump: (s: number) => void }) {
  const reduce = useReducedMotion();
  const total = STEPS.length;
  const pct = Math.round(((step - 1) / (total - 1)) * 100);
  return (
    <aside className="relative hidden w-[316px] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar lg:flex">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid opacity-50 [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />
      <div className="relative flex h-16 items-center border-b border-border px-6">
        <Logo size={24} />
      </div>

      <div className="relative px-6 pt-7">
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">
          <StatusDot tone="signal" pulse /> Mission setup
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Configure your workspace. Every step can be revisited.</p>
      </div>

      <ol className="relative mt-7 px-4" aria-label="Setup steps">
        {/* progress rail */}
        <span aria-hidden className="absolute bottom-[26px] left-[33px] top-[26px] w-px bg-border-strong" />
        <motion.span
          aria-hidden
          className="absolute left-[33px] top-[26px] w-px origin-top bg-primary shadow-[0_0_8px_var(--primary)]"
          style={{ height: "calc(100% - 52px)" }}
          initial={false}
          animate={{ scaleY: (step - 1) / (total - 1) }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 26 }}
        />
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          const reachable = n <= maxReached && n !== step;
          return (
            <li key={s.key} className="relative">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(n)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${n}: ${s.label}${done ? " (completed)" : ""}`}
                className={cn(
                  "group relative flex w-full items-center gap-3.5 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
                  active && "bg-sidebar-active",
                  reachable && "hover:bg-surface-hover/60",
                  !reachable && !active && "cursor-default",
                )}
              >
                {active && <motion.span layoutId="ob-rail-active" className="absolute inset-y-1.5 -left-4 w-[2px] rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span
                  className={cn(
                    "relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-md border font-mono text-[10.5px] transition-all duration-300",
                    done && "border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-sidebar text-primary",
                    active && "border-primary bg-background text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent),0_0_16px_-2px_var(--primary)]",
                    !done && !active && "border-border-strong bg-sidebar text-subtle-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : pad(n)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13.5px] font-medium leading-tight", active ? "text-foreground" : done ? "text-foreground-soft" : "text-muted-foreground")}>{s.label}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-subtle-foreground">{s.hint}</span>
                </span>
                <span className={cn("font-mono text-[9px] uppercase tracking-[0.12em]", active ? "text-primary" : done ? "text-mint/80" : "text-transparent")}>{active ? "Now" : done ? "Done" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative mt-auto border-t border-border">
        <dl className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="px-6 py-3.5">
            <dt className="micro-label">Progress</dt>
            <dd className="mt-1 font-mono text-[15px] text-foreground tabular">
              {pad(step)} <span className="text-subtle-foreground">/ {pad(total)}</span>
            </dd>
          </div>
          <div className="px-6 py-3.5">
            <dt className="micro-label">Complete</dt>
            <dd className="mt-1 font-mono text-[15px] text-primary tabular">{pct}%</dd>
          </div>
        </dl>
        <p className="flex items-start gap-2.5 px-6 py-4 text-[12px] leading-relaxed text-muted-foreground">
          <StatusDot tone="live" className="mt-1" />
          <span>
            Progress saves after every step. Skip any integration and finish it later from <span className="font-medium text-foreground-soft">Integrations</span>.
          </span>
        </p>
      </div>
    </aside>
  );
}

export function MobileProgress({ step }: { step: number }) {
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between">
        <Logo size={24} />
        <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground tabular">
          Step <span className="text-primary">{pad(step)}</span> / {pad(STEPS.length)}
        </span>
      </div>
      <div className="mt-4 flex gap-[3px]" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.key} className={cn("h-[3px] flex-1 rounded-[1px] transition-colors duration-300", i + 1 < step ? "bg-primary/70" : i + 1 === step ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-border-strong")} />
        ))}
      </div>
    </div>
  );
}

export function TopActions() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <Button variant="ghost" size="sm" onClick={() => logout()}>
        <LogOut /> <span className="max-sm:sr-only">Sign out</span>
      </Button>
    </div>
  );
}

export function StepHeader({ step, title, description, icon: Icon }: { step: number; title: string; description?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  const meta = STEPS[step - 1];
  return (
    <div className="mb-9">
      <p className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle-foreground">
        <span className="text-primary">Step {pad(step)}</span>
        <span className="h-px w-5 bg-border-strong" aria-hidden />
        <span>{meta?.label}</span>
        <span className="ml-auto hidden sm:inline">
          {pad(step)} / {pad(STEPS.length)}
        </span>
      </p>
      <div className="mt-5 flex items-start gap-4">
        {Icon && (
          <span className="tech-corners hidden size-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-card sm:flex">
            <Icon className="size-5 text-primary" />
          </span>
        )}
        <div>
          <h1 className="text-balance text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[32px]">{title}</h1>
          {description && <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  );
}

export function StepFooter({
  onBack,
  onSkip,
  primary,
  skipLabel = "Skip for now",
}: {
  onBack?: () => void;
  onSkip?: () => void;
  primary: React.ReactNode;
  skipLabel?: string;
}) {
  return (
    <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
      {onBack && (
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      )}
      <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onSkip && (
          <Button type="button" variant="outline" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
        {primary}
      </div>
    </div>
  );
}

export function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
  badge,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-start gap-3.5 rounded-lg border bg-card p-4 text-left transition-all duration-200 hairline-top focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-[color-mix(in_oklab,var(--primary)_60%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--card)),var(--card))] shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
          : "border-border hover:border-border-strong hover:bg-surface-hover/40",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors", selected ? "border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft text-primary" : "border-border bg-background-subtle text-foreground-soft")}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">
          {title}
          {badge}
        </span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[4px] border transition", selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
