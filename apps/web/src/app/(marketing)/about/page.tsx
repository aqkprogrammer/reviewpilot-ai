import type { Metadata } from "next";
import { Scale, HeartHandshake, Eye, Languages } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeading, ink } from "@/components/marketing/primitives";
import { FinalCta } from "@/components/marketing/final-cta";
import { cn } from "@/lib/utils";

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

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="Great local businesses deserve to be found"
        description="The neighbourhood clinic with the gentlest dentist. The café that remembers your order. They grow by word of mouth — and today, word of mouth lives on Google."
      />
      <Section className="pt-4">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.2fr]">
          <h2 className={cn("text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[36px]", ink)}>Why we built ReviewPilot</h2>
          <div className="space-y-5 text-[15.5px] leading-relaxed text-foreground-soft">
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
      <Section className="bg-background-subtle/40">
        <SectionHeading eyebrow="Principles" title="What we will and won't do" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.t} className="rounded-[22px] border border-border bg-card p-6 shadow-sm">
              <v.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-[16px] font-semibold text-foreground">{v.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{v.d}</p>
            </div>
          ))}
        </div>
      </Section>
      <FinalCta title="Let's grow your reputation, honestly" />
    </>
  );
}
