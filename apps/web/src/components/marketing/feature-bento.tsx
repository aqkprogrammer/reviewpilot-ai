import Link from "next/link";
import { ArrowUpRight, MapPin, RefreshCw, ShieldCheck, Users, Languages } from "lucide-react";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Reveal, SectionHeading, Section } from "./primitives";
import { QrCard, ReviewCard, SentimentBars, WhatsAppThread } from "./fragments";
import { cn } from "@/lib/utils";

function Cell({ className, code, title, body, href, children }: { className?: string; code: string; title: string; body: string; href?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/70 hairline-top card-hover", className)}>
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <span className="micro-label">{code}</span>
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary" aria-label={`Learn more: ${title}`}>
              Learn more <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
        <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="relative mt-6 flex-1">{children}</div>
    </div>
  );
}

export function FeatureBento() {
  return (
    <Section id="features">
      <SectionHeading
        index={[2, 9]}
        eyebrow="Key features"
        title={<>Everything you need to earn the reviews you deserve</>}
        description="Ask every customer, the same way, on the channel they actually use. Then let AI handle the busywork of replying and reading between the lines."
      />
      <Reveal className="mt-14 grid gap-3 md:grid-cols-6">
        <Cell
          className="md:col-span-3 md:row-span-2"
          code="F.01 · Collection"
          title="WhatsApp-first review requests"
          body="Send consented, Meta-approved template messages after every visit. Track sent, delivered, opened and clicked — with opt-outs handled automatically."
          href="/features#whatsapp"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,color-mix(in_oklab,var(--mint)_10%,transparent),transparent_70%)]" aria-hidden />
          <div className="relative flex h-full flex-col justify-between gap-8 px-6">
            <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="micro-label">Delivery · post-dinner campaign</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Sample</span>
            </div>
            <dl className="grid grid-cols-4 divide-x divide-border rounded-lg border border-border bg-background-subtle">
              {[
                { k: "Sent", v: "1,240" },
                { k: "Delivered", v: "96.6%" },
                { k: "Opened", v: "49.4%" },
                { k: "Clicked", v: "27.5%" },
              ].map((m) => (
                <div key={m.k} className="px-2.5 py-2.5 sm:px-3">
                  <dt className="micro-label !text-[9px] sm:!text-[10px]">{m.k}</dt>
                  <dd className="mt-1 font-mono text-[13px] text-foreground tabular sm:text-[14px]">{m.v}</dd>
                </div>
              ))}
            </dl>
            </div>
            <WhatsAppThread
              business="Saffron Table"
              message="Hi Priya, thanks for dining with us tonight! How was everything? Share your feedback — it takes under a minute."
              className="mb-[-1px] w-full rounded-b-none border-b-0"
            />
          </div>
        </Cell>
        <Cell
          className="md:col-span-3"
          code="F.02 · AI replies"
          title="AI replies you approve"
          body="Drafts in your brand voice — professional, friendly, empathetic and more — in English, Hindi or Hinglish. Nothing is published until you say so."
          href="/features#ai"
        >
          <div className="px-6 pb-6">
            <ReviewCard
              author="Neha Gupta"
              rating={5}
              text="Dr. Iyer explained everything so patiently. Spotless clinic."
              reply="Thank you, Neha! We'll share your kind words with Dr. Iyer and the team."
              className="bg-background-subtle shadow-none"
            />
          </div>
        </Cell>
        <Cell className="md:col-span-3" code="F.03 · Print" title="QR codes that look like your brand" body="Printable table tents, counter stands and cards. Every scan is tracked through a first-party link.">
          <div className="relative flex h-full min-h-[180px] items-end justify-center gap-5 overflow-hidden px-6">
            <div className="absolute inset-0 bg-tech-grid opacity-60 [background-size:32px_32px] [mask-image:linear-gradient(to_top,#000,transparent)]" aria-hidden />
            <QrCard business="Lumen Salon & Spa" code="QR-0217" className="relative -mb-10 rotate-[-4deg] scale-90 transition-transform duration-500 group-hover:-translate-y-1" />
            <QrCard business="BrightSmile Dental" code="QR-0388" className="relative -mb-16 hidden rotate-[5deg] scale-90 transition-transform duration-500 group-hover:-translate-y-1 sm:block" />
          </div>
        </Cell>
        <Cell
          className="md:col-span-4"
          code="F.04 · Intelligence"
          title="Customer feedback intelligence"
          body="AI reads every review and private note, then surfaces recurring complaints, standout strengths and what to fix first."
          href="/features#analytics"
        >
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-border bg-background-subtle p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="micro-label">Top themes · 90 days</span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Sample</span>
              </div>
              <SentimentBars
                items={[
                  { label: "Food quality", mentions: 142, tone: "positive" },
                  { label: "Staff warmth", mentions: 96, tone: "positive" },
                  { label: "Weekend wait time", mentions: 38, tone: "negative" },
                ]}
              />
            </div>
          </div>
        </Cell>
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card/70 hairline-top md:col-span-2">
          <p className="micro-label border-b border-border px-5 py-3">F.05 · Platform</p>
          {[
            { icon: GoogleIcon, title: "Google Business Profile sync", body: "Official API, encrypted tokens, background sync." },
            { icon: MapPin, title: "Multi-location", body: "Compare branches side by side." },
            { icon: Users, title: "Roles & permissions", body: "Owner, admin, manager, staff, analyst." },
          ].map((f, i) => (
            <div key={f.title} className={cn("flex flex-1 gap-3.5 px-5 py-4", i > 0 && "border-t border-border")}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background-subtle">
                <f.icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">{f.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-mint" /> Every customer gets the same chance to leave an honest Google review
        </span>
        <span className="inline-flex items-center gap-2">
          <Languages className="size-4 text-primary" /> English, Hindi &amp; Hinglish
        </span>
        <span className="inline-flex items-center gap-2">
          <RefreshCw className="size-4 text-ice" /> Real-time delivery tracking
        </span>
      </Reveal>
    </Section>
  );
}
