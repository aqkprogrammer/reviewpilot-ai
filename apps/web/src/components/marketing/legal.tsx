import * as React from "react";
import { Info } from "lucide-react";
import { ink } from "./primitives";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  title: string;
  body: Array<string | string[]>;
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="px-5 pb-20 pt-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-[12.5px] font-medium text-primary">Legal</p>
          <h1 className={cn("mt-3 text-[36px] font-bold tracking-[-0.04em] sm:text-[46px]", ink)}>{title}</h1>
          <p className="mt-3 text-[13px] text-muted-foreground">Last updated: {updated}</p>
          <p className="mt-6 text-[15.5px] leading-relaxed text-foreground-soft">{intro}</p>
          <p className="mt-5 flex gap-2 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-foreground-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            This document is provided as a working draft for the ReviewPilot AI platform and should be reviewed by qualified legal counsel before production use.
          </p>
        </header>
        <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ol className="sticky top-28 space-y-2 text-[13px]">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{i + 1}. {s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="max-w-3xl space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">{i + 1}. {s.title}</h2>
                <div className="mt-3 space-y-3 text-[14.5px] leading-[1.75] text-foreground-soft">
                  {s.body.map((b, j) =>
                    Array.isArray(b) ? (
                      <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-primary">
                        {b.map((li) => <li key={li}>{li}</li>)}
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
