import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/primitives";
import { FaqList } from "@/components/marketing/faq";
import { FAQS } from "@/components/marketing/faq-data";
import { JsonLd } from "@/components/marketing/json-ld";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about Google review policy compliance, WhatsApp review requests, AI replies, data privacy, languages and billing.",
  alternates: { canonical: "/faq" },
  openGraph: { title: "ReviewPilot AI — Frequently asked questions", url: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <PageHero eyebrow="FAQ" title="Frequently asked questions" description="Everything you need to know about collecting reviews honestly with ReviewPilot." />
      <Section className="pt-0">
        <div className="mx-auto max-w-3xl">
          <FaqList />
          <p className="mt-8 text-center text-[14px] text-muted-foreground">
            Still have questions?{" "}
            <Link href="/contact" className="font-medium text-primary hover:underline">Get in touch</Link>.
          </p>
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
