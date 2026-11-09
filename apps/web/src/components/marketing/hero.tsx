import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CinematicBackground, ReputationIntelligenceScene } from "@/components/intelligence";
import { CoordLabel } from "./primitives";

const facts = [
  { k: "Channels", v: "WhatsApp · QR · Email · SMS" },
  { k: "Reply languages", v: "English · हिंदी · Hinglish" },
  { k: "Review gating", v: "Never — every customer asked equally" },
  { k: "Setup", v: "About ten minutes" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 sm:px-8 lg:px-12">
      {/* cinematic backdrop */}
      <CinematicBackground />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,var(--background))]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center justify-between border-b border-border/70 py-3">
          <CoordLabel>RP-01 · Reputation intelligence platform</CoordLabel>
          <CoordLabel className="hidden sm:inline">Bharat-first · EN / HI / Hinglish</CoordLabel>
        </div>

        <div className="grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 lg:pb-20 lg:pt-14">
          <div className="relative z-10">
            <Link
              href="/features#whatsapp"
              className="group inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-primary transition-colors hover:text-primary-hover"
            >
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inset-0 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] motion-safe:animate-pulse" />
              </span>
              ReviewPilot AI · Reputation intelligence
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px max-sm:hidden" />
            </Link>

            <h1 className="mt-7 text-balance text-[44px] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[60px] lg:text-[56px] xl:text-[64px]">
              Your Reputation Is Your Next <span className="text-signal">Growth Engine.</span>
            </h1>
            <p className="mt-7 max-w-[520px] text-pretty text-[16px] leading-relaxed text-foreground-soft sm:text-[17.5px]">
              Collect authentic customer reviews, manage your online reputation, and turn customer feedback into business growth with AI.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="gradient" size="xl" className="w-full px-7 sm:w-auto">
                <Link href="/signup">
                  Start Free <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="w-full bg-background/40 backdrop-blur sm:w-auto">
                <Link href="/features">Explore Features</Link>
              </Button>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">
              {["14-day free trial", "No card required", "EN / हिंदी / Hinglish"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span className="h-px w-2.5 bg-primary/70" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative min-w-0 lg:-mr-12 xl:-mr-24">
            <ReputationIntelligenceScene variant="hero" />
          </div>
        </div>

        {/* fact strip */}
        <dl className="relative grid grid-cols-2 border-y border-border lg:grid-cols-4">
          {facts.map((f, i) => (
            <div
              key={f.k}
              className={[
                "px-1 py-5 sm:px-5",
                i % 2 === 1 ? "border-l border-border pl-4" : "",
                i >= 2 ? "border-t border-border lg:border-t-0" : "",
                i === 2 ? "lg:border-l" : "",
                i === 0 ? "sm:pl-0" : "",
              ].join(" ")}
            >
              <dt className="micro-label flex items-center gap-2">
                <span className="text-primary/80">{String(i + 1).padStart(2, "0")}</span> {f.k}
              </dt>
              <dd className="mt-2 text-[13.5px] font-medium leading-snug text-foreground-soft">{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
