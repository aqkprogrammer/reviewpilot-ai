"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCheck, Sparkles } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { Stars } from "@/components/ui/stars";
import { PlusMarks } from "@/components/marketing/primitives";

function Float({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{ opacity: { duration: 0.6, delay }, y: { duration: 7, delay: delay + 0.6, repeat: Infinity, ease: "easeInOut" } }}
    >
      {children}
    </motion.div>
  );
}

/** Right-hand brand panel on auth screens: product fragments, not stock illustration. */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden rounded-[28px] border border-[#e6dcfa] bg-[linear-gradient(160deg,#f5efff_0%,#ece4ff_42%,#f8e9fb_100%)] lg:flex lg:flex-col dark:border-border dark:bg-[linear-gradient(160deg,#17112b_0%,#120d24_50%,#1d0f26_100%)]">
      <div className="bg-crosshair absolute inset-0 opacity-80" aria-hidden />
      <PlusMarks points={[["18%", "14%"], ["82%", "22%"], ["12%", "64%"], ["88%", "70%"], ["50%", "92%"]]} />
      <div className="pointer-events-none absolute left-1/2 top-[48%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(214,58,240,0.30),rgba(124,92,255,0.26)_45%,transparent_75%)] blur-2xl" aria-hidden />

      <div className="relative px-12 pt-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7b4fe0] dark:text-primary-soft-foreground">ReviewPilot AI</p>
        <h2 className="mt-3 max-w-md text-balance text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-[#1d0b3a] dark:text-foreground">
          Every honest review, answered with care.
        </h2>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[#5b5277] dark:text-muted-foreground">
          Ask customers on WhatsApp, reply in English, Hindi or Hinglish, and see what people keep telling you.
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-10 pb-12">
        <div className="relative h-[380px] w-full max-w-[420px]">
          {/* WhatsApp request */}
          <Float delay={0.1} className="absolute left-0 top-2 w-[78%]">
            <div className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_18px_40px_-18px_rgba(41,24,110,0.35)] backdrop-blur dark:border-border dark:bg-card/90">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground">
                <WhatsAppIcon className="size-4" /> Spice Route Kitchen
                <span className="ml-auto text-[10.5px] font-normal text-subtle-foreground">7:42 pm</span>
              </div>
              <div className="mt-2 rounded-xl rounded-tl-sm bg-[#e7fbe3] px-3 py-2 text-[12.5px] leading-relaxed text-[#173c1a] dark:bg-[#123320] dark:text-[#cfeccf]">
                Hi Priya, thank you for dining with us tonight! How was your experience? Share honest feedback here: <span className="font-medium text-[#0b7a4a] underline dark:text-[#6fe3a6]">rvp.ai/r/spice</span>
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#4f7f55]">
                  delivered <CheckCheck className="size-3 text-[#34b7f1]" />
                </span>
              </div>
            </div>
          </Float>

          {/* Review card */}
          <Float delay={0.35} className="absolute right-0 top-[124px] w-[82%]">
            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-[0_24px_50px_-20px_rgba(41,24,110,0.40)] dark:border-border dark:bg-card">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#fde8f6] text-[12px] font-semibold text-[#a21caf]">PS</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">Priya S.</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-subtle-foreground">
                    <Stars rating={5} size={11} /> · Google · 2 min ago
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-foreground-soft">
                The butter chicken was delicious and Rahul at our table was so friendly. Will definitely come back with family!
              </p>
            </div>
          </Float>

          {/* AI reply */}
          <Float delay={0.6} className="absolute bottom-0 left-4 w-[80%]">
            <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(106,76,255,0.96),rgba(168,85,247,0.96))] p-4 text-white shadow-glow">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
                <Sparkles className="size-3.5" /> AI draft · Friendly · Awaiting your approval
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed">
                Thank you so much, Priya! We&apos;ll pass your kind words on to Rahul — see you and the family again soon.
              </p>
            </div>
          </Float>
        </div>
      </div>
    </div>
  );
}
