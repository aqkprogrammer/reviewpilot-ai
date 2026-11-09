"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Info } from "lucide-react";
import { Section, SectionHeading } from "./primitives";
import { cn } from "@/lib/utils";

const SAMPLES = [
  {
    name: "Restaurant owner",
    role: "Multi-outlet café · Bengaluru",
    initials: "RO",
    quote:
      "We used to ask for reviews only when we remembered. Now every table gets the same QR and every delivery gets a WhatsApp message, and we finally know that weekend waits are our real problem.",
  },
  {
    name: "Clinic manager",
    role: "Dental clinic · Pune",
    initials: "CM",
    quote:
      "Our patients are on WhatsApp, not email. The AI drafts are careful about privacy and our doctors approve every reply. It saves the front desk an hour a day.",
  },
  {
    name: "Agency founder",
    role: "Local marketing agency · Delhi NCR",
    initials: "AF",
    quote:
      "Running reputation for twelve clients from one place, with their own branding on feedback pages, is exactly what we needed. The monthly PDF reports go straight to clients.",
  },
];

export function Testimonials() {
  const [i, setI] = React.useState(0);
  const reduce = useReducedMotion();
  const t = SAMPLES[i];
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : SAMPLES.length - 1)) % SAMPLES.length;
    setI(n);
    document.getElementById(`tst-tab-${n}`)?.focus();
  };
  return (
    <Section id="testimonials">
      <SectionHeading
        index={[7, 9]}
        eyebrow="Testimonials"
        title="What it's like to run reputation on autopilot"
        aside={
          <p className="inline-flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--amber)_28%,transparent)] bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-amber">
            <Info className="mt-0.5 size-3.5 shrink-0" /> Sample testimonials for illustration — not real customer endorsements
          </p>
        }
      />
      <div className="mt-14 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div role="tablist" aria-label="Sample testimonials" aria-orientation="vertical" className="border-t border-border" onKeyDown={onKey}>
            {SAMPLES.map((s, idx) => {
              const on = i === idx;
              return (
                <button
                  key={s.name}
                  id={`tst-tab-${idx}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="tst-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setI(idx)}
                  className="group relative flex w-full items-center gap-4 border-b border-border py-4 text-left focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {on && <motion.span layoutId="tst-ind" className="absolute -left-px inset-y-[-1px] w-px bg-primary shadow-[0_0_10px_var(--primary)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <span className={cn("pl-4 font-mono text-[11px] tabular", on ? "text-primary" : "text-subtle-foreground")}>{String(idx + 1).padStart(2, "0")}</span>
                  <span className={cn("flex size-9 items-center justify-center rounded-md border font-mono text-[11px] transition-colors", on ? "border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft text-primary" : "border-border text-subtle-foreground")}>{s.initials}</span>
                  <span>
                    <span className={cn("block text-[14px] font-semibold transition-colors", on ? "text-foreground" : "text-foreground-soft group-hover:text-foreground")}>{s.name}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] tracking-[0.04em] text-subtle-foreground">{s.role}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div id="tst-panel" role="tabpanel" aria-labelledby={`tst-tab-${i}`} className="relative lg:col-span-8 lg:pl-6">
          <span aria-hidden className="absolute -top-10 left-0 select-none font-serif text-[140px] leading-none text-primary/15 lg:left-6">&ldquo;</span>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <p className="text-pretty text-[22px] font-medium leading-[1.42] tracking-[-0.02em] text-foreground sm:text-[28px]">{t.quote}</p>
              <footer className="mt-8 flex items-center gap-3 border-t border-border pt-5">
                <span className="h-px w-6 bg-primary" aria-hidden />
                <span className="text-[13.5px] text-foreground-soft">
                  {t.name}, {t.role}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-amber">Sample</span>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
