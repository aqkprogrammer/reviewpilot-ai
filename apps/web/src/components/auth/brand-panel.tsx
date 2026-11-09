"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CinematicBackground, ReputationIntelligenceScene } from "@/components/intelligence";
import { StatusDot } from "@/components/ui/tech";

const ease = [0.22, 1, 0.36, 1] as const;

function Appear({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/** Right-hand brand panel on auth screens: editorial copy plus the shared intelligence scene slot. */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-l border-border bg-background-subtle lg:flex lg:flex-col" aria-hidden>
      <CinematicBackground />

      {/* top readout rule */}
      <div className="relative flex items-center justify-between border-b border-border px-10 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">
        <span className="inline-flex items-center gap-2">
          <StatusDot tone="signal" /> ReviewPilot AI · Workspace access
        </span>
        <span>N 19.07° · E 72.87°</span>
      </div>

      <div className="relative px-10 pt-12 xl:px-14">
        <Appear>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">Reputation intelligence</p>
          <h2 className="mt-4 max-w-md text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">Every honest review, answered with care.</h2>
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">Ask customers on WhatsApp, reply in English, Hindi or Hinglish, and see what people keep telling you.</p>
        </Appear>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-4 py-8 xl:px-8">
        <ReputationIntelligenceScene variant="auth" showStatus={false} />
      </div>

      <div className="relative grid grid-cols-3 divide-x divide-border border-t border-border font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">
        {["No review gating", "DPDP & GDPR ready", "EN · हिंदी · Hinglish"].map((t) => (
          <span key={t} className="flex items-center gap-2 px-6 py-4 xl:px-10">
            <span className="size-1 rounded-full bg-primary" /> {t}
          </span>
        ))}
      </div>
    </aside>
  );
}
