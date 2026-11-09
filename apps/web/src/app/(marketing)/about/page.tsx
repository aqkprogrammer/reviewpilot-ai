import type { Metadata } from "next";
import { Scale, HeartHandshake, Eye, Languages, Check, X } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "About",
  description: "ReviewPilot AI helps local businesses earn genuine reviews and act on customer feedback, without gaming the system.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About ReviewPilot AI", url: "/about" },
};

const values = [
  { icon: Scale, t: "Honest by design", d: "No review gating, no incentives, no fake reviews. Every customer gets the same chance to leave an honest Google review." },
  { icon: HeartHandshake, t: "Humans stay in charge", d: "AI drafts, people decide. Replies are approved before they're published unless an owner chooses otherwise." },
  { icon: Eye, t: "Measure what's real", d: "We never pass off estimates as verified data. Every metric comes with its definition and source." },
  { icon: Languages, t: "Built for Bharat first", d: "WhatsApp-native, INR pricing, and AI that understands English, Hindi and Hinglish." },
];

const will = [
  "Ask every customer the same way, on the channel they already use",
  "Keep a person in charge of every published reply",
  "Label every metric with its definition and source",
  "Honour consent and opt-outs automatically",
];
const wont = [
  "Gate reviews by sending only happy customers to Google",
  "Offer or encourage incentives for reviews",
  "Post reviews on anyone's behalf",
  "Pass off estimates as verified data",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        path="about"
        meta="Made in India"
        title="Great local businesses deserve to be found"
        description="The neighbourhood clinic with the gentlest dentist. The café that remembers your order. They grow by word of mouth — and today, word of mouth lives on Google."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading index={[1, 3]} eyebrow="Story" title="Why we built ReviewPilot" className="lg:block" />
            <figure className="mt-10 border-l border-primary pl-5">
              <blockquote className="text-[19px] font-medium leading-snug tracking-[-0.01em] text-foreground">
                Ask everyone, consistently, on the channel they already use — and reply to every review with care.
              </blockquote>
              <figcaption className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">Our operating principle</figcaption>
            </figure>
          </div>
          <div className="space-y-6 text-[16px] leading-[1.75] text-foreground-soft lg:col-span-7 lg:pt-14">
            <p>
              Most happy customers never leave a review — not because they don&apos;t want to, but because nobody asked at the right moment. Meanwhile, the one frustrated customer always finds the review button.
            </p>
            <p>
              Reputation software tried to fix this by filtering who gets asked, or by buying reviews with discounts. Both break Google&apos;s rules and both erode trust. We think there&apos;s a better way: ask everyone, consistently, on the channel they already use, and reply to every review with care.
            </p>
            <p>
              ReviewPilot combines WhatsApp-first review collection with AI that reads every piece of feedback, so owners spend less time chasing reviews and more time acting on what customers tell them.
            </p>
          </div>
        </div>
      </Section>
      <Section grid>
        <SectionHeading index={[2, 3]} eyebrow="Principles" title="What we will and won't do" description="Four principles shape every product decision we make." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {values.map((v, i) => (
            <div key={v.t} className="bg-[color-mix(in_oklab,var(--card)_92%,var(--background))] p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-md border border-border bg-background-subtle"><v.icon className="size-5 text-primary" /></span>
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-subtle-foreground">P.{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-6 text-[18px] font-semibold tracking-[-0.015em] text-foreground">{v.t}</h3>
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <SectionHeading index={[3, 3]} eyebrow="In practice" title="The line we hold" />
        <div className="mt-12 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--mint)_25%,var(--border))] bg-card/70 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mint">We will</p>
            <ul className="mt-5 divide-y divide-border">
              {will.map((t) => (
                <li key={t} className="flex gap-3 py-3 text-[14.5px] text-foreground-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-mint" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_22%,var(--border))] bg-card/70 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-danger-foreground">We won&apos;t</p>
            <ul className="mt-5 divide-y divide-border">
              {wont.map((t) => (
                <li key={t} className="flex gap-3 py-3 text-[14.5px] text-foreground-soft">
                  <X className="mt-0.5 size-4 shrink-0 text-danger-foreground" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <FinalCta title="Let's grow your reputation, honestly" />
    </>
  );
}
