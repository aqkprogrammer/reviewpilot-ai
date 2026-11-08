import Link from "next/link";
import { ArrowUpRight, UtensilsCrossed, Stethoscope, Scissors, BedDouble, Car, House, GraduationCap, ShoppingBag, Wrench, Building2 } from "lucide-react";
import { Reveal, Section, SectionHeading } from "./primitives";
import { SOLUTIONS } from "./solutions-data";

const icons = { restaurants: UtensilsCrossed, clinics: Stethoscope, salons: Scissors, hotels: BedDouble } as const;

const more = [
  { icon: Car, label: "Automotive dealerships" },
  { icon: House, label: "Real estate agencies" },
  { icon: GraduationCap, label: "Coaching institutes" },
  { icon: ShoppingBag, label: "Retail stores" },
  { icon: Wrench, label: "Local services" },
  { icon: Building2, label: "Marketing agencies" },
];

export function Industries() {
  return (
    <Section id="industries">
      <SectionHeading
        eyebrow="Solutions"
        title="Made for the way your industry earns trust"
        description="The moment to ask, the words to use and the themes to watch are different for a dental clinic and a dhaba. ReviewPilot adapts to both."
      />
      <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SOLUTIONS.map((s) => {
          const Icon = icons[s.slug];
          return (
            <Link
              key={s.slug}
              href={`/solutions/${s.slug}`}
              className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[20px] border border-border bg-card p-5 shadow-sm card-hover"
            >
              <div className="absolute -right-10 -top-10 size-36 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.14),transparent)] transition-transform duration-500 group-hover:scale-125" aria-hidden />
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon className="size-5 text-primary-soft-foreground" />
                </span>
                <ArrowUpRight className="size-4 text-subtle-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">{s.name}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.short}</p>
              </div>
            </Link>
          );
        })}
      </Reveal>
      <Reveal className="mt-4 flex flex-wrap gap-2">
        {more.map((m) => (
          <Link
            key={m.label}
            href="/solutions#more"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground-soft transition hover:border-border-strong hover:text-foreground"
          >
            <m.icon className="size-3.5 text-primary" /> {m.label}
          </Link>
        ))}
      </Reveal>
    </Section>
  );
}
