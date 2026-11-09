"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, UtensilsCrossed, Stethoscope, Scissors, BedDouble, Car, House, GraduationCap, ShoppingBag, Wrench, Building2 } from "lucide-react";
import { Reveal, Section, SectionHeading } from "./primitives";
import { IsoCubes } from "./iso-cubes";
import { SOLUTIONS } from "./solutions-data";
import { cn } from "@/lib/utils";

const icons = { restaurants: UtensilsCrossed, clinics: Stethoscope, salons: Scissors, hotels: BedDouble } as const;
const shortLabel = { restaurants: "Restaurants", clinics: "Clinics", salons: "Salons", hotels: "Hotels" } as const;

const more = [
  { icon: Car, label: "Automotive dealerships" },
  { icon: House, label: "Real estate agencies" },
  { icon: GraduationCap, label: "Coaching institutes" },
  { icon: ShoppingBag, label: "Retail stores" },
  { icon: Wrench, label: "Local services" },
  { icon: Building2, label: "Marketing agencies" },
];

export function Industries() {
  const [active, setActive] = React.useState(0);
  const markers = SOLUTIONS.map((s, i) => ({ key: s.slug, label: shortLabel[s.slug], code: `IND.${String(i + 1).padStart(2, "0")}` }));
  return (
    <Section id="industries">
      <SectionHeading
        index={[4, 9]}
        eyebrow="Solutions"
        title="Made for the way your industry earns trust"
        description="The moment to ask, the words to use and the themes to watch are different for a dental clinic and a dhaba. ReviewPilot adapts to both."
      />
      <div className="mt-14 grid items-center gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <ul className="border-t border-border">
            {SOLUTIONS.map((s, i) => {
              const Icon = icons[s.slug];
              const on = active === i;
              return (
                <li key={s.slug} className="border-b border-border">
                  <Link
                    href={`/solutions/${s.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group relative grid grid-cols-[auto_1fr_auto] items-start gap-4 py-5 pr-1 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -left-px bottom-[-1px] top-[-1px] w-px bg-primary shadow-[0_0_10px_var(--primary)] transition-opacity duration-300",
                        on ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className={cn("pl-4 pt-1 font-mono text-[11px] tabular transition-colors", on ? "text-primary" : "text-subtle-foreground")}>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="flex items-center gap-2.5">
                        <Icon className={cn("size-4 transition-colors", on ? "text-primary" : "text-subtle-foreground")} />
                        <span className="text-[17px] font-semibold tracking-[-0.015em] text-foreground group-focus-visible:underline">{s.name}</span>
                      </span>
                      <span className="mt-1.5 block max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{s.short}</span>
                    </span>
                    <ArrowUpRight className={cn("mt-1 size-4 transition-all", on ? "-translate-y-0.5 translate-x-0.5 text-primary" : "text-subtle-foreground")} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {more.map((m) => (
              <Link
                key={m.label}
                href="/solutions#more"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-[12.5px] font-medium text-foreground-soft transition hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
              >
                <m.icon className="size-3.5 text-primary" /> {m.label}
              </Link>
            ))}
          </div>
        </Reveal>
        <Reveal className="relative lg:col-span-6" delay={0.1}>
          <div className="relative">
            <div className="absolute left-0 top-0 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">Locations · by industry</div>
            <div className="absolute right-0 top-0 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">Illustrative</div>
            <IsoCubes markers={markers} active={active} className="pt-6" />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
