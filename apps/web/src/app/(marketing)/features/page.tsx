import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, KeyRound, ScrollText, ShieldCheck, Database, UserCheck, MapPin, Users, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { PageHero, Split } from "@/components/marketing/page-hero";
import { QrCard, ReviewCard, SentimentBars, WhatsAppThread } from "@/components/marketing/fragments";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Features",
  description:
    "WhatsApp review campaigns, branded QR codes, AI review replies in English, Hindi and Hinglish, Google Business Profile sync, sentiment analytics and multi-location team management.",
  alternates: { canonical: "/features" },
  openGraph: { title: "ReviewPilot AI features", url: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title="One hub for every customer review"
        description="From the first WhatsApp message to the last reply on Google, ReviewPilot runs the whole loop — honestly, and in your brand's voice."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg" className="px-6">
            <Link href="/signup">Start Free <ArrowRight /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </PageHero>

      <nav aria-label="Feature sections" className="sticky top-16 z-30 border-y border-border bg-card/80 backdrop-blur-xl lg:top-[72px]">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-2 scrollbar-thin sm:px-8 lg:px-12">
          {[
            ["#whatsapp", "WhatsApp"],
            ["#qr", "QR codes"],
            ["#ai", "AI replies"],
            ["#google", "Google sync"],
            ["#analytics", "Analytics"],
            ["#team", "Teams & locations"],
            ["#security", "Security"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-foreground-soft transition hover:bg-muted hover:text-foreground">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <Split
        id="whatsapp"
        eyebrow="WhatsApp-first collection"
        title="Ask where your customers already are"
        body="Most of your customers open WhatsApp dozens of times a day. ReviewPilot sends review requests through your own WhatsApp Business number using the official Cloud API, timed to the moment the experience ends."
        points={[
          "Meta-approved message templates with approval status in-app",
          "Consent recorded per customer; STOP replies opt people out instantly",
          "Sent, delivered, read and failed events from delivery webhooks",
          "Schedules and a single polite reminder, never spam",
        ]}
        visual={<WhatsAppThread business="BrightSmile Dental" message="Hello Mr. Rao, thank you for visiting BrightSmile Dental today. We'd value your honest feedback on your visit." />}
      />

      <Split
        id="qr"
        reverse
        eyebrow="QR codes"
        title="Print once, collect every day"
        body="Generate a QR for each location in your colours, with your logo, on templates designed for table tents, counters and reception desks. Every scan passes through a first-party link so you can see what's working."
        points={["PNG, SVG and print-ready PDF downloads", "Scan analytics by location and template", "Leads to an honest feedback page with a Google review option for everyone"]}
        visual={
          <div className="flex items-center justify-center gap-4 rounded-[24px] border border-border bg-background-subtle p-8">
            <QrCard business="Saffron Table" className="rotate-[-3deg]" />
            <QrCard business="Konkan Bay Resort" className="hidden rotate-[3deg] sm:block" />
          </div>
        }
      />

      <Split
        id="ai"
        eyebrow="AI review assistant"
        title="Thoughtful replies in seconds, approved by you"
        body="AI drafts replies from the review text, rating and your brand tone, in English, Hindi or Hinglish. It explains its reasoning, tags sentiment and keywords, and suggests a follow-up for your team."
        points={[
          "Six tones: professional, friendly, empathetic, appreciative, concise, apologetic",
          "Negative reviews get empathetic drafts that never argue or share private details",
          "Nothing publishes without approval unless an owner explicitly enables auto-publish",
          "Usage tracked per organization with clear limits",
        ]}
        visual={
          <ReviewCard
            author="Sneha K."
            rating={2}
            text="Doctor was good but I waited almost an hour past my appointment time with no update."
            reply="Dear Sneha, thank you for telling us, and we're sorry for the long wait without an update. We'd like to understand what happened — please call our front desk and ask for the clinic manager."
          />
        }
      />

      <Split
        id="google"
        reverse
        eyebrow="Google Business Profile"
        title="Your reviews, synced through the official API"
        body="Connect with Google OAuth, choose your locations, and ReviewPilot syncs reviews in the background and publishes the replies you approve. No scraping, ever. While Google API access is pending, paste your review link and start collecting immediately."
        points={["Clear status: connected, pending, token expired or error — never faked", "Encrypted tokens with automatic refresh", "Retry handling and quota-aware background sync"]}
        visual={
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-md">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-background-subtle ring-1 ring-border"><GoogleIcon className="size-5" /></span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-foreground">Google Business Profile</p>
                <p className="text-[12px] text-muted-foreground">3 locations · last synced 4 min ago</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-foreground"><Check className="size-3" /> Connected</span>
            </div>
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {["Koramangala", "Indiranagar", "HSR Layout"].map((l, i) => (
                <div key={l} className="flex items-center justify-between px-4 py-3 text-[13px]">
                  <span className="flex items-center gap-2 text-foreground"><MapPin className="size-3.5 text-muted-foreground" /> Saffron Table — {l}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><RefreshCw className="size-3" /> {[182, 141, 89][i]} reviews</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <Split
        id="analytics"
        eyebrow="Analytics & intelligence"
        title="See the story behind your star rating"
        body="Track rating trends, review volume, response times and campaign performance by location and channel. AI groups what customers mention into themes, so you know what to celebrate and what to fix."
        points={["Every metric labelled with its definition and source", "CSV exports and monthly PDF reports", "Filters by date, location, campaign and channel"]}
        visual={
          <div className="rounded-[24px] border border-border bg-card p-6 shadow-md">
            <p className="mb-4 text-[14px] font-semibold text-foreground">Top themes · last 90 days</p>
            <SentimentBars
              items={[
                { label: "Room & view", mentions: 211, tone: "positive" },
                { label: "Breakfast", mentions: 143, tone: "positive" },
                { label: "Wi-Fi reliability", mentions: 47, tone: "negative" },
                { label: "Check-in speed", mentions: 29, tone: "neutral" },
              ]}
            />
          </div>
        }
      />

      <Section id="team" className="scroll-mt-24 bg-background-subtle/40">
        <SectionHeading eyebrow="Teams & locations" title="Built for one shop or fifty" description="Invite your team with the right level of access, and give managers only the locations they run." />
        <div className="mt-12 grid gap-4 md:grid-cols-5">
          {[
            { role: "Owner", desc: "Everything, including billing and team." },
            { role: "Admin", desc: "Locations, reviews, campaigns, customers." },
            { role: "Manager", desc: "Assigned locations, reviews, campaigns." },
            { role: "Staff", desc: "Day-to-day reviews and customers." },
            { role: "Analyst", desc: "Read-only analytics and reports." },
          ].map((r, i) => (
            <div key={r.role} className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <p className="text-[14px] font-semibold text-foreground">{r.role}</p>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
              <div className="mt-4 flex gap-1" aria-hidden>
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} className={`h-1 flex-1 rounded-full ${j < 5 - i ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="security" className="scroll-mt-24">
        <SectionHeading eyebrow="Security & privacy" title="Your customers trust you. We take that seriously." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Database, t: "Tenant isolation", d: "Every query is scoped to your organization, enforced on the server." },
            { icon: Lock, t: "Encrypted credentials", d: "OAuth and API tokens encrypted at rest; never sent to the browser." },
            { icon: KeyRound, t: "Secure sessions", d: "HTTP-only cookies, refresh-token rotation and login throttling." },
            { icon: UserCheck, t: "Consent & opt-outs", d: "Consent tracked per channel; opt-outs honoured automatically." },
            { icon: ScrollText, t: "Audit logs", d: "Sensitive actions are recorded with actor, target and time." },
            { icon: ShieldCheck, t: "DPDP & GDPR", d: "Data export and deletion workflows for your customers." },
          ].map((f) => (
            <div key={f.t} className="flex gap-4">
              <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-[14.5px] font-semibold text-foreground">{f.t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
