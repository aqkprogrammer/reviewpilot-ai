import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { POSTS, getPost } from "@/components/marketing/blog-data";
import { JsonLd } from "@/components/marketing/json-ld";
import { FinalCta } from "@/components/marketing/final-cta";
import { ink } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, url: `/blog/${post.slug}`, publishedTime: post.date },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          author: { "@type": "Organization", name: post.author.name },
          publisher: { "@type": "Organization", name: "ReviewPilot AI" },
        }}
      />
      <article className="px-5 pb-16 pt-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> All articles
          </Link>
          <p className="mt-8 text-[12.5px] font-medium text-primary">{post.category}</p>
          <h1 className={cn("mt-3 text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[44px]", ink)}>{post.title}</h1>
          <p className="mt-5 text-[13px] text-muted-foreground">
            {post.author.name} · {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {post.readingMinutes} min read
          </p>
          <div className="mt-10 space-y-5 text-[16px] leading-[1.75] text-foreground-soft">
            {post.body.map((b, i) => {
              if (b.type === "h2") return <h2 key={i} className="pt-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground">{b.text}</h2>;
              if (b.type === "ul")
                return (
                  <ul key={i} className="space-y-2 pl-1">
                    {b.items?.map((it) => (
                      <li key={it} className="flex gap-3"><span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />{it}</li>
                    ))}
                  </ul>
                );
              if (b.type === "quote")
                return <blockquote key={i} className="border-l-2 border-primary pl-5 text-[19px] font-medium italic text-foreground">{b.text}</blockquote>;
              return <p key={i}>{b.text}</p>;
            })}
          </div>
          <div className="mt-16 border-t border-border pt-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">Keep reading</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {others.map((o) => (
                <Link key={o.slug} href={`/blog/${o.slug}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm card-hover">
                  <p className="text-[12px] text-primary">{o.category}</p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">{o.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>
      <FinalCta />
    </>
  );
}
