import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { TrustedBy } from "@/components/marketing/trusted-by";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Industries } from "@/components/marketing/industries";
import { AiShowcase } from "@/components/marketing/ai-showcase";
import { AnalyticsShowcase } from "@/components/marketing/analytics-showcase";
import { Testimonials } from "@/components/marketing/testimonials";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { FaqList } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/marketing/json-ld";
import { getPublicPlans } from "@/components/marketing/plans";
import { FAQS } from "@/components/marketing/faq-data";

export const metadata: Metadata = {
  title: { absolute: "ReviewPilot AI — Turn Customer Experiences Into Business Growth" },
  description:
    "Collect authentic Google reviews over WhatsApp, QR and email, reply with AI in English, Hindi or Hinglish, and understand customer sentiment across every location.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ReviewPilot AI — Your Reputation Is Your Next Growth Engine",
    description: "WhatsApp-first review collection and AI customer-feedback intelligence for local businesses.",
    url: "/",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function HomePage() {
  const plans = await getPublicPlans();
  const preview = plans.filter((p) => !p.is_custom_pricing).slice(0, 3);
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "ReviewPilot AI",
            url: SITE_URL,
            logo: `${SITE_URL}/icon.svg`,
            description: "AI-powered reputation management for local businesses.",
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "ReviewPilot AI",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: SITE_URL,
            offers: preview.map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: ((p.price_monthly_minor ?? 0) / 100).toFixed(0),
              priceCurrency: p.currency,
            })),
          },
        ]}
      />
      <Hero />
      <TrustedBy />
      <FeatureBento />
      <HowItWorks />
      <Industries />
      <AiShowcase />
      <AnalyticsShowcase />
      <Testimonials />
      <Section id="pricing" className="bg-background-subtle/40">
        <SectionHeading eyebrow="Pricing" title="Choose the plan that fits your business" description="Simple INR pricing. Every plan starts with a 14-day free trial." />
        <div className="mt-10">
          <PricingCards plans={preview} compact />
        </div>
        <p className="mt-8 text-center text-[13.5px] text-muted-foreground">
          Need more than 10 locations?{" "}
          <Link href="/pricing" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Compare all plans <ArrowRight className="size-3.5" />
          </Link>
        </p>
      </Section>
      <Section id="faq">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqList items={FAQS.slice(0, 6)} />
          <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
            More in our{" "}
            <Link href="/faq" className="font-medium text-primary hover:underline">
              full FAQ
            </Link>
            .
          </p>
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
