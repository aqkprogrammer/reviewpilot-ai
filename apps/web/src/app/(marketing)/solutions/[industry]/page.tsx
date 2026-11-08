import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeading, ink } from "@/components/marketing/primitives";
import { ReviewCard, SentimentBars, WhatsAppThread } from "@/components/marketing/fragments";
import { SOLUTIONS, getSolution } from "@/components/marketing/solutions-data";
import { FinalCta } from "@/components/marketing/final-cta";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ industry: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const s = getSolution(industry);
  if (!s) return {};
  return {
    title: `Review management for ${s.name.toLowerCase()}`,
    description: `${s.short} ${s.subheadline}`,
    alternates: { canonical: `/solutions/${s.slug}` },
    openGraph: { title: `ReviewPilot AI for ${s.name}`, description: s.subheadline, url: `/solutions/${s.slug}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const s = getSolution(industry);
  if (!s) notFound();

  return (
    <>
      <PageHero eyebrow={s.name} title={s.headline} description={s.subheadline}>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg" className="px-6">
            <Link href={`/signup?industry=${s.slug}`}>Start Free <ArrowRight /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </PageHero>

      <Section className="pt-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-[24px] border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className={cn("text-[24px] font-semibold tracking-[-0.03em]", ink)}>The moments that matter</h2>
            <ol className="mt-6 space-y-6">
              {s.moments.map((m, i) => (
                <li key={m.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d63af0,#6a4cff)] text-[12px] font-semibold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-foreground">{m.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <WhatsAppThread business={s.whatsapp.business} message={s.whatsapp.message} />
        </div>
      </Section>

      <Section className="bg-background-subtle/40">
        <SectionHeading eyebrow="AI replies" title="A reply your team would be proud to sign" description="Drafted by AI from the review itself; approved by a person before it's published." />
        <div className="mx-auto mt-10 max-w-2xl">
          <ReviewCard author={s.review.author} rating={s.review.rating} text={s.review.text} reply={s.reply} when="Yesterday" />
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading align="left" eyebrow="Insights" title="Hear what customers keep telling you" description="Themes are extracted from your actual reviews and feedback. The example below is illustrative." />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {s.checklist.map((c) => (
                <li key={c} className="flex gap-2.5 text-[14px] text-foreground-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[24px] border border-border bg-card p-6 shadow-md">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-foreground">Top themes</p>
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-foreground">Sample data</span>
            </div>
            <SentimentBars items={s.insights} />
          </div>
        </div>
        <p className="mt-12 flex items-center justify-center gap-2 text-center text-[13px] text-muted-foreground">
          <ShieldCheck className="size-4 text-success" /> Every customer gets the same chance to leave an honest Google review. No gating, no incentives.
        </p>
      </Section>

      <FinalCta title={`Grow your ${s.name.toLowerCase()} reputation`} />
    </>
  );
}
