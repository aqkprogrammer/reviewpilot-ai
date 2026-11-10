"use client";
import * as React from "react";
import { Clock, MoonStar, Send, ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, type RuleChannel, clock, exampleSend, formatDelay, hasQuiet, hh } from "./types";

interface FlowProps {
  channel: RuleChannel;
  delay: number;
  quiet: { start?: number; end?: number } | null;
  cooldown: number;
  timezone?: string | null;
  className?: string;
}

/** Vertical timeline explaining exactly what a rule does: visit → wait → quiet hours → consent → send. */
export function RuleFlow({ channel, delay, quiet, cooldown, timezone, className }: FlowProps) {
  const q = hasQuiet(quiet) ? quiet : null;
  // A worked example in location time: a visit at 19:30.
  const ex = exampleSend(19 * 60 + 30, delay, q);
  const steps = [
    { icon: Store, label: "Visit recorded", detail: "POS / booking API, Zapier, Shopify order or staff · deduplicated by your id" },
    { icon: Clock, label: delay ? `Wait ${formatDelay(delay)}` : "Send right away", detail: delay ? "Measured from when the visit happened" : "Sent within seconds of the visit arriving" },
    {
      icon: MoonStar, label: q ? `Quiet hours ${hh(q.start)}–${hh(q.end)}` : "No quiet hours",
      detail: q ? `Anything due in that window waits until ${hh(q.end)}${timezone ? ` (${timezone})` : " location time"}` : "Sends at any hour — consider adding quiet hours",
      muted: !q,
    },
    {
      icon: ShieldCheck, label: "Consent & cooldown check",
      detail: `Re-checked at send time: recorded consent, not opted out${cooldown ? `, no request in the last ${cooldown} day${cooldown === 1 ? "" : "s"}` : ""}`,
    },
    {
      icon: Send, label: channel === "auto" ? "Send on the best channel" : `Send via ${CHANNEL_LABELS[channel]}`,
      detail: channel === "auto" ? "WhatsApp → email → SMS: the first channel with consent that can deliver" : "Skipped with a reason if this channel can't be used",
      signal: true,
    },
  ];
  return (
    <div className={cn("rounded-xl border border-border bg-background-subtle/50", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="micro-label">Sequence</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">5 steps</span>
      </div>
      <ol className="relative px-4 py-3">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-3.5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-22px)] w-px bg-border-strong" />}
            <span
              className={cn(
                "relative z-[1] flex size-[27px] shrink-0 items-center justify-center rounded-md border bg-card [&_svg]:size-3.5",
                s.signal ? "border-[color-mix(in_oklab,var(--primary)_45%,var(--border-strong))] text-primary shadow-[0_0_14px_-6px_var(--primary)]" : s.muted ? "border-border text-subtle-foreground" : "border-border-strong text-foreground-soft",
              )}
            >
              <s.icon />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <span className="font-mono text-[10px] text-primary/80">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-border px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
        Example · visit 19:30 → sends{" "}
        <span className="text-foreground">{clock(ex.minutes)}</span>
        {ex.dayOffset > 0 && <span className="text-amber"> +{ex.dayOffset}d</span>}
        {ex.shifted && <span> · shifted by quiet hours</span>}
      </div>
    </div>
  );
}

/** Compact one-line flow for rule cards: WAIT 2H → QUIET 21–09 → CONSENT → WHATSAPP. */
export function FlowChips({ channel, delay, quiet, cooldown }: Omit<FlowProps, "timezone" | "className">) {
  const q = hasQuiet(quiet) ? quiet : null;
  const chips: { text: string; tone?: "signal" | "muted" }[] = [
    { text: "Visit" },
    { text: delay ? `Wait ${formatDelay(delay)}` : "No delay" },
    { text: q ? `Quiet ${hh(q.start)}–${hh(q.end)}` : "Any hour", tone: q ? undefined : "muted" },
    { text: cooldown ? `Consent · ${cooldown}d cooldown` : "Consent" },
    { text: CHANNEL_LABELS[channel], tone: "signal" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5" aria-label="Rule sequence">
      {chips.map((c, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="h-px w-2.5 bg-border-strong" />}
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-[5px] border px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]",
              c.tone === "signal" ? "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft text-primary-soft-foreground" : c.tone === "muted" ? "border-border text-subtle-foreground" : "border-border bg-background-subtle text-foreground-soft",
            )}
          >
            {c.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
