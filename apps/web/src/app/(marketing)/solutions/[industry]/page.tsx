import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeading } from "@/components/marketing/primitives";
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

  const idx = SOLUTIONS.findIndex((x) => x.slug === s.slug) + 1;

  return (
    <>
      <PageHero
        eyebrow={s.name}
        path={`solutions / ${s.slug}`}
        meta={`IND.${String(idx).padStart(2, "0")} of ${String(SOLUTIONS.length).padStart(2, "0")}`}
        title={s.headline}
        description={s.subheadline}
        aside={
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="micro-label">Review request · WhatsApp</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber">Sample conversation</span>
            </div>
            <WhatsAppThread business={s.whatsapp.business} message={s.whatsapp.message} className="tech-corners shadow-lg" />
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg" className="px-6">
            <Link href={`/signup?industry=${s.slug}`}>Start Free <ArrowRight /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </PageHero>

      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading index={[1, 3]} eyebrow="Timing" title="The moments that matter" className="lg:block" />
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">Ask at the right moment, on the right channel — and ask every customer the same way.</p>
          </div>
          <ol className="relative lg:col-span-8">
            <span aria-hidden className="absolute bottom-6 left-[15px] top-6 w-px bg-[linear-gradient(180deg,var(--primary),var(--border-strong)_70%)]" />
            {s.moments.map((m, i) => (
              <li key={m.title} className="relative flex gap-6 pb-10 last:pb-0">
                <span className={cn("relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-md border bg-background font-mono text-[11px]", i === 0 ? "border-primary text-primary shadow-[0_0_16px_-3px_var(--primary)]" : "border-border-strong text-muted-foreground")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 border-b border-border pb-8 pt-1 last:border-0">
                  <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-foreground">{m.title}</h3>
                  <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section grid>
        <SectionHeading index={[2, 3]} eyebrow="AI replies" title="A reply your team would be proud to sign" description="Drafted by AI from the review itself; approved by a person before it's published." />
        <div className="mt-12 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1.15fr]">
          <div className="rounded-xl border border-border bg-card/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="micro-label">Input · Google review</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Sample</span>
            </div>
            <ReviewCard author={s.review.author} rating={s.review.rating} text={s.review.text} when="Yesterday" className="bg-background-subtle shadow-none" />
          </div>
          <div className="hidden items-center lg:flex" aria-hidden>
            <span className="h-px w-6 bg-border-strong" />
            <span className="flex size-8 items-center justify-center rounded-md border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft"><Sparkles className="size-4 text-primary" /></span>
            <span className="h-px w-6 bg-border-strong" />
          </div>
          <div className="tech-corners relative overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] bg-card/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-primary">Output · AI draft</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Awaiting approval</span>
            </div>
            <p className="text-[15px] leading-relaxed text-foreground">{s.reply}</p>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <span className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground">Approve & publish</span>
              <span className="rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-medium text-foreground-soft">Edit</span>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading index={[3, 3]} eyebrow="Insights" title="Hear what customers keep telling you" className="lg:block" />
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">Themes are extracted from your actual reviews and feedback. The example is illustrative.</p>
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {s.checklist.map((c) => (
                <li key={c} className="flex gap-3 py-3 text-[14px] text-foreground-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-border-strong bg-card/80 p-6 shadow-lg hairline-top">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-[14px] font-semibold text-foreground">Top themes</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber">Sample data</span>
              </div>
              <SentimentBars items={s.insights} />
            </div>
          </div>
        </div>
        <p className="mt-14 flex items-center justify-center gap-2 border-t border-border pt-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-mint" /> Every customer gets the same chance to leave an honest Google review. No gating, no incentives.
        </p>
      </Section>

      <FinalCta title={`Grow your ${s.name.toLowerCase()} reputation`} />
    </>
  );
}
