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
        title="Reputation tools shaped around your industry"
        description="The right moment to ask, the right words to reply and the right themes to watch — tuned for how your customers experience your business."
      />
      <Section className="pt-4">
        <div className="grid gap-5 md:grid-cols-2">
          {SOLUTIONS.map((s) => {
            const Icon = icons[s.slug];
            return (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group flex flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-sm card-hover">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft"><Icon className="size-5 text-primary-soft-foreground" /></span>
                    <ArrowUpRight className="size-4 text-subtle-foreground transition group-hover:text-primary" />
                  </div>
                  <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-foreground">{s.name}</h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.short}</p>
                </div>
                <div className="mt-auto border-t border-border bg-background-subtle/60 p-5">
                  <ReviewCard author={s.review.author} rating={s.review.rating} text={s.review.text} className="shadow-none" />
                </div>
              </Link>
            );
          })}
        </div>
      </Section>
      <Section id="more" className="scroll-mt-24 bg-background-subtle/40">
        <SectionHeading eyebrow="And more" title="Any business that lives on word of mouth" />
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((m) => (
            <div key={m.name} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card"><m.icon className="size-4 text-primary" /></span>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">{m.name}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{m.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
