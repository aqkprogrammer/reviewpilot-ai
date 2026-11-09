import * as React from "react";
import { Info } from "lucide-react";
import { CoordLabel, Eyebrow } from "./primitives";

export interface LegalSection {
  id: string;
  title: string;
  body: Array<string | string[]>;
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="relative px-5 pb-24 sm:px-8 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-tech-grid-fade opacity-80" />
      <div className="relative mx-auto max-w-6xl">
        <div className="flex items-center justify-between border-b border-border/70 py-3">
          <CoordLabel>
            reviewpilot.ai <span className="text-border-strong">/</span> <span className="text-foreground-soft">legal</span>
          </CoordLabel>
          <CoordLabel className="hidden sm:inline">Rev. {updated}</CoordLabel>
        </div>
        <header className="max-w-3xl pt-14">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-6 text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-[54px]">{title}</h1>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">Last updated: {updated}</p>
          <p className="mt-7 text-[16px] leading-relaxed text-foreground-soft">{intro}</p>
          <p className="relative mt-6 flex gap-3 overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--amber)_28%,transparent)] bg-amber-soft py-3 pl-4 pr-4 text-[13px] leading-relaxed text-foreground-soft before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-amber">
            <Info className="mt-0.5 size-4 shrink-0 text-amber" />
            This document is provided as a working draft for the ReviewPilot AI platform and should be reviewed by qualified legal counsel before production use.
          </p>
        </header>
        <div className="mt-14 grid gap-12 lg:grid-cols-12">
          <nav aria-label="On this page" className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24 border-t border-border pt-4">
              <p className="micro-label">On this page</p>
              <ol className="mt-4 space-y-2.5">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="group flex gap-3 text-[13px] leading-snug text-muted-foreground transition-colors hover:text-foreground">
                      <span className="font-mono text-[10.5px] text-subtle-foreground group-hover:text-primary">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <div className="max-w-3xl space-y-12 lg:col-span-9">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-border pt-6">
                <h2 className="flex items-baseline gap-4 text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                  <span className="font-mono text-[11px] font-normal text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-3 pl-0 text-[14.5px] leading-[1.8] text-foreground-soft sm:pl-[34px]">
                  {s.body.map((b, j) =>
                    Array.isArray(b) ? (
                      <ul key={j} className="space-y-2">
                        {b.map((li) => (
                          <li key={li} className="flex gap-3">
                            <span className="mt-[12px] h-px w-2.5 shrink-0 bg-primary" aria-hidden />
                            {li}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={j}>{b}</p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
