import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, UtensilsCrossed, Stethoscope, Scissors, BedDouble, Car, House, GraduationCap, ShoppingBag, Wrench, Building2 } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { SOLUTIONS } from "@/components/marketing/solutions-data";
import { ReviewCard } from "@/components/marketing/fragments";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Solutions by industry",
  description: "Review collection and AI replies tailored for restaurants, clinics, salons, hotels, dealerships, real estate, coaching institutes, retail and agencies.",
  alternates: { canonical: "/solutions" },
  openGraph: { title: "ReviewPilot AI solutions by industry", url: "/solutions" },
};

const icons = { restaurants: UtensilsCrossed, clinics: Stethoscope, salons: Scissors, hotels: BedDouble } as const;

const more = [
  { icon: Car, name: "Automotive dealerships", body: "Request reviews after deliveries and service visits; track sentiment across sales and workshop teams." },
  { icon: House, name: "Real estate agencies", body: "Ask buyers and tenants after a closing or move-in, and compare agents and branches." },
  { icon: GraduationCap, name: "Coaching institutes", body: "Collect feedback from students and parents at term end, in English or Hindi." },
  { icon: ShoppingBag, name: "Retail stores", body: "Counter QR codes and post-purchase WhatsApp messages for every outlet." },
  { icon: Wrench, name: "Local services", body: "Plumbers, electricians, cleaners and repair shops: ask right after the job is done." },
  { icon: Building2, name: "Marketing agencies", body: "Manage many client organizations, with white-label pages and monthly PDF reports." },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        path="solutions"
        meta="4 core industries · 6 more"
        title="Reputation tools shaped around your industry"
        description="The right moment to ask, the right words to reply and the right themes to watch — tuned for how your customers experience your business."
      />
      <section className="relative px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2">
          {SOLUTIONS.map((s, i) => {
            const Icon = icons[s.slug];
            return (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/70 hairline-top card-hover">
                <div className="p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[10.5px] tracking-[0.12em] text-subtle-foreground">IND.{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background-subtle"><Icon className="size-4 text-primary" /></span>
                    </span>
                    <ArrowUpRight className="size-4 text-subtle-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.025em] text-foreground">{s.name}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.short}</p>
                  <ul className="mt-5 flex flex-wrap gap-1.5">
                    {s.checklist.slice(0, 3).map((c) => (
                      <li key={c} className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="relative mt-auto border-t border-border bg-background-subtle/60 p-5">
                  <span className="absolute right-5 top-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Sample review</span>
                  <ReviewCard author={s.review.author} rating={s.review.rating} text={s.review.text} className="mt-4 bg-card shadow-none" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <Section id="more">
        <SectionHeading eyebrow="And more" title="Any business that lives on word of mouth" description="The same honest loop — ask everyone, reply with care, learn from every theme — works wherever reputation drives the next customer." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {more.map((m, i) => (
            <div key={m.name} className="bg-[color-mix(in_oklab,var(--card)_92%,var(--background))] p-6 transition-colors hover:bg-card">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background-subtle"><m.icon className="size-4 text-primary" /></span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-subtle-foreground">IND.{String(i + 5).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 text-[15.5px] font-semibold text-foreground">{m.name}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
