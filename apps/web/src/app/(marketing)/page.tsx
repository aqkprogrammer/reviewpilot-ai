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
import { Eyebrow, Reveal, Section, SectionHeading, SectionIndex } from "@/components/marketing/primitives";
import { ProductPreview } from "@/components/marketing/product-preview";
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

/** Live plan prices are refreshed from the API at most every five minutes (ISR). */
export const revalidate = 300;

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
      <Section id="product">
        <SectionHeading
          index={[1, 9]}
          eyebrow="Product"
          title="One instrument panel for your whole reputation"
          description="Reviews, WhatsApp campaigns and AI insights in a single workspace. Explore a live product mock-up below — every value is sample data."
        />
        <Reveal className="mt-12">
          <ProductPreview />
        </Reveal>
      </Section>
      <FeatureBento />
      <HowItWorks />
      <Industries />
      <AiShowcase />
      <AnalyticsShowcase />
      <Testimonials />
      <Section id="pricing">
        <SectionHeading
          index={[8, 9]}
          eyebrow="Pricing"
          title="Choose the plan that fits your business"
          description="Simple INR pricing. Every plan starts with a 14-day free trial."
          aside={
            <Link href="/pricing" className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-primary hover:underline">
              Compare all plans <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="mt-12">
          <PricingCards plans={preview} compact />
        </div>
        <p className="mt-6 text-[13.5px] text-muted-foreground">
          Need more than 10 locations?{" "}
          <Link href="/pricing" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Compare all plans <ArrowRight className="size-3.5" />
          </Link>
        </p>
      </Section>
      <Section id="faq">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-4">
              <SectionIndex n={9} total={9} />
              <Eyebrow>FAQ</Eyebrow>
            </div>
            <h2 className="mt-5 text-balance text-[32px] font-semibold leading-[1.04] tracking-[-0.038em] text-foreground sm:text-[42px]">Questions, answered</h2>
            <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">
              More in our{" "}
              <Link href="/faq" className="font-medium text-primary hover:underline">
                full FAQ
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-8">
            <FaqList items={FAQS.slice(0, 6)} />
          </div>
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
