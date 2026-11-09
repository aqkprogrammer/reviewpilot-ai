"use client";
import { BadgeCheck, Calculator, TrendingUp } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { AnimatedNumber } from "@/components/ui/tech";
import { Reveal, Section, SectionHeading, SampleTag } from "./primitives";
import { cn } from "@/lib/utils";

const ratings = [
  { r: 5, v: 268, c: "bg-mint" },
  { r: 4, v: 91, c: "bg-cyan" },
  { r: 3, v: 28, c: "bg-amber" },
  { r: 2, v: 14, c: "bg-[color-mix(in_oklab,var(--amber)_55%,var(--danger))]" },
  { r: 1, v: 11, c: "bg-danger" },
];
const total = ratings.reduce((a, b) => a + b.v, 0);

const locations = [
  { name: "Koramangala", rating: 4.7, reviews: 182, response: 98, trend: "+0.2" },
  { name: "Indiranagar", rating: 4.5, reviews: 141, response: 94, trend: "+0.1" },
  { name: "HSR Layout", rating: 4.2, reviews: 89, response: 81, trend: "+0.4" },
];

const strip = [
  { k: "Average rating", v: 4.6, f: "rating" as const, sub: "+0.3 vs last quarter", src: "Google" },
  { k: "Google reviews", v: 412, f: "int" as const, sub: "3 locations · 90 days", src: "Google" },
  { k: "Response rate", v: 93, f: "pct" as const, sub: "replied within 48h", src: "Measured" },
  { k: "Link clicks", v: 341, f: "int" as const, sub: "feedback page → Google", src: "Measured" },
];

const fmt = {
  rating: (n: number) => n.toFixed(1),
  int: (n: number) => Math.round(n).toLocaleString("en-IN"),
  pct: (n: number) => `${Math.round(n)}%`,
};

export function AnalyticsShowcase() {
  return (
    <Section id="analytics" grid>
      <SectionHeading
        index={[6, 9]}
        eyebrow="Review analytics"
        title="Know exactly where you stand — and why"
        description="Ratings, volume, response times and campaign performance across every location. Verified Google data and our own measured metrics are always labelled separately, with clear definitions."
      />

      <Reveal className="mt-14">
        <div className="tech-corners relative overflow-hidden rounded-xl border border-border-strong bg-card/80 shadow-lg hairline-top">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <span className="micro-label">Analytics · Saffron Table · last 90 days</span>
            <SampleTag />
          </div>

          {/* data strip */}
          <dl className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
            {strip.map((s, i) => (
              <div key={s.k} className={cn("relative px-5 py-5", i % 2 === 1 && "border-l border-border", i >= 2 && "border-t border-border lg:border-t-0", i === 2 && "lg:border-l")}>
                <dt className="flex items-center justify-between gap-2">
                  <span className="micro-label">{s.k}</span>
                  <span className={cn("font-mono text-[9px] uppercase tracking-[0.12em]", s.src === "Google" ? "text-ice" : "text-primary")}>{s.src === "Google" ? "◆ Verified" : "● Measured"}</span>
                </dt>
                <dd className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.035em] text-foreground sm:text-[34px]">
                  <AnimatedNumber value={s.v} format={fmt[s.f]} />
                </dd>
                <p className="mt-2 font-mono text-[10.5px] text-subtle-foreground">{s.sub}</p>
              </div>
            ))}
          </dl>

          <div className="grid lg:grid-cols-5">
            <div className="border-b border-border p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Rating distribution</p>
                  <p className="mt-1 font-mono text-[10.5px] text-subtle-foreground">{total} Google reviews</p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular">4.6</p>
                  <Stars rating={4.6} size={11} className="mt-1.5" />
                </div>
              </div>
              <ul className="mt-6 space-y-3" aria-label="Rating distribution, sample data">
                {ratings.map((d) => (
                  <li key={d.r} className="grid grid-cols-[28px_1fr_40px] items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{d.r}★</span>
                    <span className="relative h-2 overflow-hidden rounded-[2px] bg-muted">
                      <span className={cn("absolute inset-y-0 left-0 rounded-[2px]", d.c)} style={{ width: `${(d.v / ratings[0].v) * 100}%` }} />
                    </span>
                    <span className="text-right font-mono text-[11px] text-foreground-soft tabular">{d.v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between px-5 pt-5">
                <p className="text-[14px] font-semibold text-foreground">Location comparison</p>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">90 days</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[460px] text-[13px]">
                  <thead>
                    <tr className="border-y border-border text-left">
                      {["Location", "Rating", "Reviews", "Responded", "Trend"].map((h, i) => (
                        <th key={h} scope="col" className={cn("micro-label px-3 py-2.5 font-normal", i === 0 && "pl-5", i === 4 && "pr-5 text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((l) => (
                      <tr key={l.name} className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover/50">
                        <td className="px-3 py-3.5 pl-5 font-medium text-foreground">{l.name}</td>
                        <td className="px-3 py-3.5 font-mono text-foreground-soft tabular">{l.rating}</td>
                        <td className="px-3 py-3.5 font-mono text-foreground-soft tabular">{l.reviews}</td>
                        <td className="px-3 py-3.5">
                          <span className="flex items-center gap-2">
                            <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${l.response}%` }} />
                            </span>
                            <span className="font-mono text-[12px] text-foreground-soft tabular">{l.response}%</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 pr-5 text-right">
                          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-mint">
                            <TrendingUp className="size-3.5" />
                            {l.trend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-4 rounded-xl border border-border bg-card/60 p-5">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-ice" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ice">◆ Verified Google data</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Review count, star ratings and reply status synced from your connected Google Business Profile.</p>
          </div>
        </div>
        <div className="flex gap-4 rounded-xl border border-border bg-card/60 p-5">
          <Calculator className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">● Measured by ReviewPilot</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Requests sent, delivered, page opens and Google link clicks — never presented as reviews posted.</p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
