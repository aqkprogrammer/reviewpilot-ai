"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Quote, Info } from "lucide-react";
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
  const t = SAMPLES[i];
  return (
    <Section id="testimonials">
      <SectionHeading eyebrow="Testimonials" title="What it's like to run reputation on autopilot" />
      <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-[12px] font-medium text-warning-foreground">
        <Info className="size-3.5" /> Sample testimonials for illustration — not real customer endorsements
      </p>
      <div className="mt-12 grid items-center gap-8 lg:grid-cols-[320px_1fr]">
        <ul className="space-y-2" role="tablist" aria-label="Sample testimonials">
          {SAMPLES.map((s, idx) => (
            <li key={s.name}>
              <button
                role="tab"
                aria-selected={i === idx}
                onClick={() => setI(idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  i === idx ? "border-[#e3a6f2] bg-card shadow-sm ring-4 ring-[#d63af0]/5 dark:border-primary/40" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-[#f3e8ff] text-[12px] font-semibold text-[#7e22ce] dark:bg-purple-soft dark:text-purple">{s.initials}</span>
                <span>
                  <span className="block text-[14px] font-semibold text-foreground">{s.name}</span>
                  <span className="block text-[12px] text-muted-foreground">{s.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="relative rounded-[24px] border border-border bg-card p-8 shadow-sm sm:p-12">
          <Quote className="size-8 text-[#d63af0]" strokeWidth={1.5} aria-hidden />
          <AnimatePresence mode="wait">
            <motion.blockquote key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <p className="mt-5 text-pretty text-[20px] font-medium leading-[1.5] tracking-[-0.01em] text-foreground sm:text-[22px]">{t.quote}</p>
              <footer className="mt-6 text-[13px] text-muted-foreground">
                — {t.name}, {t.role} <span className="text-subtle-foreground">(sample)</span>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
