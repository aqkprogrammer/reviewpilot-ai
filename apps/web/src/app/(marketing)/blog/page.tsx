import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { POSTS } from "@/components/marketing/blog-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description: "Playbooks and guides on earning genuine Google reviews, replying to customers, and running WhatsApp review campaigns.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "ReviewPilot AI blog", url: "/blog" },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Code-built editorial cover: grid, beacon arcs and the category as a mono plate. */
function Cover({ category, seed }: { category: string; seed: number }) {
  const r = [70, 120, 170, 220];
  return (
    <div className="relative h-full min-h-[240px] overflow-hidden bg-background-subtle">
      <div className="absolute inset-0 bg-tech-grid opacity-80 [background-size:32px_32px]" aria-hidden />
      <svg viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id={`cv-${seed}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={300 + seed * 20} cy="200" r="230" fill={`url(#cv-${seed})`} />
        {r.map((rr, i) => (
          <circle key={rr} cx={300 + seed * 20} cy="200" r={rr} fill="none" stroke="var(--border-strong)" strokeDasharray={i === 1 ? "2 6" : undefined} />
        ))}
        <path d={`M${300 + seed * 20} 30 A170 170 0 0 1 ${470 + seed * 20} 200`} fill="none" stroke="var(--cyan)" strokeOpacity="0.8" strokeWidth="1.5" />
        <circle cx={300 + seed * 20} cy="200" r="16" fill="var(--cyan)" fillOpacity="0.85" />
      </svg>
      <span className="absolute left-5 top-5 rounded-[4px] border border-border-strong bg-background/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-soft backdrop-blur">Featured · {category}</span>
    </div>
  );
}

export default function BlogPage() {
  const [featured, ...rest] = POSTS;
  return (
    <>
      <PageHero eyebrow="Resources" path="blog" meta={`${POSTS.length} articles`} title="Guides for growing an honest reputation" description="Practical playbooks for local businesses: collecting reviews, replying well, and staying on the right side of platform policies." />
      <section className="relative px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <Link href={`/blog/${featured.slug}`} className="group grid overflow-hidden rounded-xl border border-border bg-card/70 hairline-top card-hover lg:grid-cols-2">
            <Cover category={featured.category} seed={0} />
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">
                {fmt(featured.date)} · {featured.readingMinutes} min read
              </p>
              <h2 className="mt-4 text-balance text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground transition-colors group-hover:text-primary sm:text-[30px]">{featured.title}</h2>
              <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">{featured.excerpt}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                Read article <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          <div className="mt-14 flex items-center justify-between border-b border-border pb-3">
            <span className="micro-label">All articles</span>
            <span className="font-mono text-[10.5px] text-subtle-foreground tabular">{String(rest.length).padStart(2, "0")}</span>
          </div>
          <ul>
            {rest.map((p, i) => (
              <li key={p.slug} className="border-b border-border">
                <Link href={`/blog/${p.slug}`} className="group grid gap-3 py-7 md:grid-cols-12 md:items-baseline md:gap-6">
                  <span className="font-mono text-[10.5px] text-subtle-foreground md:col-span-1">{String(i + 2).padStart(2, "0")}</span>
                  <span className="md:col-span-2">
                    <span className={cn("inline-flex rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]", i % 2 ? "border-[color-mix(in_oklab,var(--ice)_28%,transparent)] text-ice" : "border-[color-mix(in_oklab,var(--mint)_28%,transparent)] text-mint")}>{p.category}</span>
                  </span>
                  <span className="md:col-span-6">
                    <span className="block text-[19px] font-semibold leading-snug tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary">{p.title}</span>
                    <span className="mt-2 block text-[14px] leading-relaxed text-muted-foreground">{p.excerpt}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground md:col-span-3 md:justify-end">
                    {fmt(p.date)} · {p.readingMinutes} min
                    <ArrowUpRight className="size-4 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
