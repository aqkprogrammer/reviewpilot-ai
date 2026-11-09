import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { POSTS, getPost } from "@/components/marketing/blog-data";
import { JsonLd } from "@/components/marketing/json-ld";
import { FinalCta } from "@/components/marketing/final-cta";

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
      <article className="relative px-5 pb-20 sm:px-8 lg:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-tech-grid-fade opacity-80" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between border-b border-border/70 py-3">
            <Link href="/blog" className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary">
              <ArrowLeft className="size-3.5" /> All articles
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">{post.readingMinutes} min read</span>
          </div>
          <div className="grid gap-12 pt-14 lg:grid-cols-12">
            <aside className="lg:col-span-3">
              <dl className="space-y-5 border-t border-border pt-5 lg:sticky lg:top-24">
                <div>
                  <dt className="micro-label">Category</dt>
                  <dd className="mt-1.5 text-[13.5px] text-primary">{post.category}</dd>
                </div>
                <div>
                  <dt className="micro-label">Published</dt>
                  <dd className="mt-1.5 font-mono text-[12.5px] text-foreground-soft">{new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd>
                </div>
                <div>
                  <dt className="micro-label">Author</dt>
                  <dd className="mt-1.5 text-[13.5px] text-foreground-soft">{post.author.name}</dd>
                </div>
              </dl>
            </aside>
            <div className="lg:col-span-8">
              <h1 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[48px]">{post.title}</h1>
              <p className="mt-6 text-[18px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
              <div className="mt-10 max-w-2xl space-y-5 border-t border-border pt-10 text-[16.5px] leading-[1.8] text-foreground-soft">
                {post.body.map((b, i) => {
                  if (b.type === "h2") return <h2 key={i} className="pt-6 text-[23px] font-semibold tracking-[-0.025em] text-foreground">{b.text}</h2>;
                  if (b.type === "ul")
                    return (
                      <ul key={i} className="space-y-2.5 pl-1">
                        {b.items?.map((it) => (
                          <li key={it} className="flex gap-3">
                            <span className="mt-[13px] h-px w-3 shrink-0 bg-primary" aria-hidden />
                            {it}
                          </li>
                        ))}
                      </ul>
                    );
                  if (b.type === "quote")
                    return (
                      <blockquote key={i} className="relative my-8 border-l border-primary py-1 pl-6 text-[20px] font-medium leading-snug tracking-[-0.01em] text-foreground">
                        {b.text}
                      </blockquote>
                    );
                  return <p key={i}>{b.text}</p>;
                })}
              </div>
              <div className="mt-16 border-t border-border pt-8">
                <p className="micro-label">Keep reading</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {others.map((o) => (
                    <Link key={o.slug} href={`/blog/${o.slug}`} className="group rounded-xl border border-border bg-card/70 p-5 hairline-top card-hover">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">{o.category}</p>
                      <p className="mt-2 text-[15.5px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">{o.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
      <FinalCta />
    </>
  );
}
