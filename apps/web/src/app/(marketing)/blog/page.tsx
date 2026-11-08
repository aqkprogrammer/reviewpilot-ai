import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/primitives";
import { POSTS } from "@/components/marketing/blog-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description: "Playbooks and guides on earning genuine Google reviews, replying to customers, and running WhatsApp review campaigns.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "ReviewPilot AI blog", url: "/blog" },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function BlogPage() {
  const [featured, ...rest] = POSTS;
  return (
    <>
      <PageHero eyebrow="Resources" title="Guides for growing an honest reputation" description="Practical playbooks for local businesses: collecting reviews, replying well, and staying on the right side of platform policies." />
      <Section className="pt-0">
        <Link href={`/blog/${featured.slug}`} className="group grid overflow-hidden rounded-[26px] border border-border bg-card shadow-sm card-hover lg:grid-cols-2">
          <div className="relative min-h-[220px] bg-[radial-gradient(ellipse_at_top_left,rgba(214,58,240,0.25),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(106,76,255,0.3),transparent_60%)] bg-[#f6f1ff] dark:bg-card-elevated">
            <div className="bg-crosshair absolute inset-0 opacity-70" aria-hidden />
            <span className="absolute left-6 top-6 rounded-full bg-card/80 px-3 py-1 text-[12px] font-medium text-foreground-soft backdrop-blur">Featured · {featured.category}</span>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="text-[12.5px] text-muted-foreground">{fmt(featured.date)} · {featured.readingMinutes} min read</p>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground group-hover:text-primary">{featured.title}</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{featured.excerpt}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-[13.5px] font-medium text-primary">Read article <ArrowUpRight className="size-4" /></span>
          </div>
        </Link>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {rest.map((p, i) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col rounded-[22px] border border-border bg-card p-6 shadow-sm card-hover">
              <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-[11.5px] font-medium", i % 2 ? "bg-blue-soft text-blue" : "bg-purple-soft text-purple")}>{p.category}</span>
              <h2 className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-foreground group-hover:text-primary">{p.title}</h2>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">{p.excerpt}</p>
              <p className="mt-5 text-[12.5px] text-subtle-foreground">{fmt(p.date)} · {p.readingMinutes} min read</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
