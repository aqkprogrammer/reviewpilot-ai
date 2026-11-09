"use client";
import * as React from "react";
import { Check, Copy, Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "empathetic", label: "Empathetic" },
  { value: "appreciative", label: "Appreciative" },
  { value: "concise", label: "Concise" },
  { value: "apologetic", label: "Apologetic" },
];
export const AI_LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
  { value: "hinglish", label: "Hinglish" },
];

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy to clipboard");
        }
      }}
    >
      {done ? <Check className="text-success" /> : <Copy />} {done ? "Copied" : label}
    </Button>
  );
}

const SENT: Record<string, "success" | "danger" | "neutral" | "warning"> = { positive: "success", negative: "danger", neutral: "neutral", mixed: "warning" };
export function SentimentBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  return <Badge variant={SENT[value] ?? "neutral"} mono size="sm" dot>{value}</Badge>;
}

/** Honest engine label for every AI output. */
export function ProviderNote({ provider }: { provider?: string }) {
  if (!provider) return null;
  const openai = provider === "openai";
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-[5px] border px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]", openai ? "border-[color-mix(in_oklab,var(--success)_26%,transparent)] bg-success-soft text-success-foreground" : "border-border bg-muted text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {openai ? "OpenAI" : "Offline heuristic"}
    </span>
  );
}

/** Field label in console style: mono index + label. */
export function ConsoleField({ label, index, htmlFor, children, aside, className }: { label: string; index?: string; htmlFor?: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {index && <span className="text-primary/80">{index}</span>}
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, id }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; id?: string }) {
  const reduce = useReducedMotion();
  const layout = id ?? `seg-${label}`;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-8 rounded-md border px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-[1.5px] focus-visible:ring-ring",
              active ? "border-transparent text-primary-soft-foreground" : "border-border bg-background-subtle/60 text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layout}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-md border border-[color-mix(in_oklab,var(--primary)_55%,transparent)] bg-primary-soft shadow-[0_0_14px_-6px_var(--primary)]"
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="inline-flex overflow-hidden rounded-md border border-border">
      {[1, 2, 3, 4, 5].map((n) => {
        const lit = value > 0 && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-8 w-10 items-center justify-center gap-0.5 border-l border-border font-mono text-[12px] font-semibold tabular outline-none transition-colors first:border-l-0 focus-visible:bg-surface-hover",
              lit ? "bg-amber-soft text-amber" : "bg-background-subtle/60 text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {n}<Star className={cn("size-3", lit && "fill-current")} />
          </button>
        );
      })}
    </div>
  );
}

/** "Thinking" placeholder: scanning line over skeleton text rows. */
export function GeneratingState({ label = "Generating" }: { label?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-background-subtle/60 p-5" role="status" aria-live="polite">
      <p className="mb-4 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-primary">
        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] motion-safe:animate-pulse" />
        {label}…
      </p>
      <div className="space-y-2.5">
        {[92, 100, 84, 96, 58].map((w, i) => <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />)}
      </div>
      {!reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-10 bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)]"
          initial={{ top: "-20%" }}
          animate={{ top: "110%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

/** Output-panel header: mono channel label and the engine that produced it. */
export function OutputHeader({ label, provider, children }: { label: string; provider?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background-subtle/70 px-5 py-2.5">
      <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" aria-hidden />
        {label}
      </span>
      <span className="flex items-center gap-2">{children}<ProviderNote provider={provider} /></span>
    </div>
  );
}

/** Idle output placeholder with grid backdrop. */
export function AwaitingInput({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: React.ReactNode }) {
  return (
    <div className="relative flex h-full min-h-72 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong p-8 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-70 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,#000_20%,transparent_75%)]" />
      <span className="tech-corners relative flex size-11 items-center justify-center rounded-lg border border-border-strong bg-card-elevated text-primary"><Icon className="size-5" /></span>
      <p className="relative mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">Awaiting input</p>
      <p className="relative mt-1.5 text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
      <p className="relative mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
