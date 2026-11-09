import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { ArrowRight } from "lucide-react";
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
      <PageHero eyebrow="FAQ" path="faq" meta={`${FAQS.length} answers`} title="Frequently asked questions" description="Everything you need to know about collecting reviews honestly with ReviewPilot." />
      <section className="relative px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <div className="rounded-xl border border-border bg-card/70 p-6 hairline-top lg:sticky lg:top-24">
              <p className="micro-label">Still have questions?</p>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground-soft">Our team replies within one business day, Monday to Saturday (IST).</p>
              <Link href="/contact" className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-primary hover:underline">
                Get in touch <ArrowRight className="size-3.5" />
              </Link>
              <div className="mt-6 border-t border-border pt-5">
                <p className="micro-label">Our commitment</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">No review gating, no incentives — every customer gets the same chance to leave an honest Google review.</p>
              </div>
            </div>
          </aside>
          <div className="lg:col-span-8">
            <FaqList />
          </div>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
