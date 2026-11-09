import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoordLabel } from "./primitives";

/** Concentric beacon rings — the brand mark, scaled up as an instrument dial. */
function BeaconRings() {
  return (
    <svg viewBox="0 0 800 800" className="absolute left-1/2 top-1/2 h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 max-sm:h-[620px] max-sm:w-[620px]" aria-hidden>
      <defs>
        <radialGradient id="cta-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.22" />
          <stop offset="40%" stopColor="var(--cyan)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cta-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--ice)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="400" cy="400" r="380" fill="url(#cta-core)" />
      {[120, 190, 260, 330, 390].map((r, i) => (
        <circle key={r} cx="400" cy="400" r={r} fill="none" stroke="var(--border)" strokeDasharray={i === 2 ? "2 6" : undefined} />
      ))}
      <circle cx="400" cy="400" r="330" fill="none" stroke="var(--border-strong)" strokeWidth="5" strokeDasharray="1 12" opacity="0.6" />
      <path d="M400 70 A330 330 0 0 1 730 400" fill="none" stroke="url(#cta-arc)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M400 210 A190 190 0 0 1 590 400" fill="none" stroke="var(--ice)" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="730" cy="400" r="3" fill="var(--cyan)" />
      {[0, 90, 180, 270].map((a) => (
        <line key={a} x1="400" y1="2" x2="400" y2="22" stroke="var(--cyan)" strokeOpacity="0.5" transform={`rotate(${a} 400 400)`} />
      ))}
    </svg>
  );
}

export function FinalCta({
  title = "Elevate your feedback management",
  body = "Start collecting genuine reviews on WhatsApp and QR today. Set up takes about ten minutes.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="relative overflow-hidden border-t border-border px-5 py-28 sm:px-8 sm:py-36 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-tech-grid-fade opacity-70" />
        <BeaconRings />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_40%,var(--background)_85%)]" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 flex justify-between">
          <CoordLabel>Ready state</CoordLabel>
          <CoordLabel>T-minus ~10 min setup</CoordLabel>
        </div>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-[56px]">{title}</h2>
          <p className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-foreground-soft">{body}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="xl" className="w-full px-8 sm:w-auto">
              <Link href="/signup">
                Start Free <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full bg-background/50 backdrop-blur sm:w-auto">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
          <p className="mt-7 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle-foreground">14-day free trial · Cancel anytime · Prices in INR</p>
        </div>
      </div>
    </section>
  );
}
