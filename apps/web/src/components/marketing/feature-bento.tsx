import Link from "next/link";
import { ArrowUpRight, MapPin, RefreshCw, ShieldCheck, Users, Languages } from "lucide-react";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Reveal, SectionHeading, Section } from "./primitives";
import { QrCard, ReviewCard, SentimentBars, WhatsAppThread } from "./fragments";
import { cn } from "@/lib/utils";

function Cell({ className, title, body, href, children }: { className?: string; title: string; body: string; href?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-sm card-hover", className)}>
      <div className="p-6 pb-0">
        <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
        {href && (
          <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            Learn more <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="relative mt-5 flex-1">{children}</div>
    </div>
  );
}

export function FeatureBento() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Key Features"
        title={<>Everything you need to earn the reviews you deserve</>}
        description="Ask every customer, the same way, on the channel they actually use. Then let AI handle the busywork of replying and reading between the lines."
      />
      <Reveal className="mt-14 grid gap-4 md:grid-cols-6">
        <Cell
          className="md:col-span-3 md:row-span-2"
          title="WhatsApp-first review requests"
          body="Send consented, Meta-approved template messages after every visit. Track sent, delivered, opened and clicked — with opt-outs handled automatically."
          href="/features#whatsapp"
        >
          <div className="absolute inset-x-6 bottom-0 top-0 bg-[radial-gradient(ellipse_at_bottom,rgba(37,211,102,0.12),transparent_70%)]" aria-hidden />
          <WhatsAppThread business="Saffron Table" message="Hi Priya, thanks for dining with us tonight! How was everything? Share your feedback — it takes under a minute." className="relative mx-6 mb-[-1px] rounded-b-none border-b-0" />
        </Cell>
        <Cell
          className="md:col-span-3"
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
              className="shadow-none"
            />
          </div>
        </Cell>
        <Cell className="md:col-span-3" title="QR codes that look like your brand" body="Printable table tents, counter stands and cards. Every scan is tracked through a first-party link.">
          <div className="flex items-end justify-center gap-4 px-6">
            <QrCard business="Lumen Salon & Spa" className="-mb-8 rotate-[-4deg] scale-90" />
            <QrCard business="BrightSmile Dental" className="-mb-12 hidden rotate-[5deg] scale-90 sm:block" />
          </div>
        </Cell>
        <Cell className="md:col-span-4" title="Customer feedback intelligence" body="AI reads every review and private note, then surfaces recurring complaints, standout strengths and what to fix first." href="/features#analytics">
          <div className="px-6 pb-6">
            <SentimentBars
              items={[
                { label: "Food quality", mentions: 142, tone: "positive" },
                { label: "Staff warmth", mentions: 96, tone: "positive" },
                { label: "Weekend wait time", mentions: 38, tone: "negative" },
              ]}
            />
          </div>
        </Cell>
        <div className="grid gap-4 md:col-span-2">
          {[
            { icon: GoogleIcon, title: "Google Business Profile sync", body: "Official API, encrypted tokens, background sync." },
            { icon: MapPin, title: "Multi-location", body: "Compare branches side by side." },
            { icon: Users, title: "Roles & permissions", body: "Owner, admin, manager, staff, analyst." },
          ].map((f) => (
            <div key={f.title} className="flex gap-3.5 rounded-[20px] border border-border bg-card p-5 shadow-sm">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background-subtle">
                <f.icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">{f.title}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-success" /> Every customer gets the same chance to leave an honest Google review</span>
        <span className="inline-flex items-center gap-1.5"><Languages className="size-4 text-primary" /> English, Hindi & Hinglish</span>
        <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-4 text-blue" /> Real-time delivery tracking</span>
      </Reveal>
    </Section>
  );
}
