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

const MODULES: Array<[string, string, string]> = [
  ["#whatsapp", "WhatsApp", "Consented review requests"],
  ["#qr", "QR codes", "Branded print, tracked scans"],
  ["#ai", "AI replies", "EN · हिंदी · Hinglish drafts"],
  ["#google", "Google sync", "Official Business Profile API"],
  ["#analytics", "Analytics", "Themes, trends, locations"],
  ["#team", "Teams & locations", "Five roles, scoped access"],
  ["#security", "Security", "Isolation, encryption, audit"],
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        path="features"
        meta="7 modules · 1 workspace"
        title="One hub for every customer review"
        description="From the first WhatsApp message to the last reply on Google, ReviewPilot runs the whole loop — honestly, and in your brand's voice."
        aside={
          <div className="tech-corners rounded-xl border border-border-strong bg-card/80 shadow-lg hairline-top">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="micro-label">Module index</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">Jump to</span>
            </div>
            <ol>
              {MODULES.map(([href, label, desc], i) => (
                <li key={href} className={i > 0 ? "border-t border-border" : undefined}>
                  <a href={href} className="group grid grid-cols-[44px_1fr_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover/60">
                    <span className="font-mono text-[10.5px] text-subtle-foreground group-hover:text-primary">M.{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-[14px] font-medium text-foreground">{label}</span>
                      <span className="block text-[12px] text-muted-foreground">{desc}</span>
                    </span>
                    <ArrowRight className="size-3.5 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg" className="px-6">
            <Link href="/signup">Start Free <ArrowRight /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </PageHero>

      <nav aria-label="Feature sections" className="sticky top-16 z-30 border-y border-border bg-background/80 px-5 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2 scrollbar-thin">
          {MODULES.map(([href, label], i) => (
            <a key={href} href={href} className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-surface-hover hover:text-foreground">
              <span className="font-mono text-[10px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <Split
        id="whatsapp"
        index="M.01"
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
        index="M.02"
        reverse
        eyebrow="QR codes"
        title="Print once, collect every day"
        body="Generate a QR for each location in your colours, with your logo, on templates designed for table tents, counters and reception desks. Every scan passes through a first-party link so you can see what's working."
        points={["PNG, SVG and print-ready PDF downloads", "Scan analytics by location and template", "Leads to an honest feedback page with a Google review option for everyone"]}
        visual={
          <div className="relative flex items-center justify-center gap-6 overflow-hidden rounded-xl border border-border bg-card/70 px-6 py-12">
            <div className="absolute inset-0 bg-tech-grid opacity-70 [background-size:32px_32px]" aria-hidden />
            <span className="absolute left-4 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">Print preview</span>
            <span className="absolute right-4 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-amber">Sample</span>
            <QrCard business="Saffron Table" code="QR-0142" className="relative rotate-[-3deg]" />
            <QrCard business="Konkan Bay Resort" code="QR-0219" className="relative hidden rotate-[3deg] sm:block" />
          </div>
        }
      />

      <Split
        id="ai"
        index="M.03"
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
            sample
            author="Sneha K."
            rating={2}
            text="Doctor was good but I waited almost an hour past my appointment time with no update."
            reply="Dear Sneha, thank you for telling us, and we're sorry for the long wait without an update. We'd like to understand what happened — please call our front desk and ask for the clinic manager."
          />
        }
      />

      <Split
        id="google"
        index="M.04"
        reverse
        eyebrow="Google Business Profile"
        title="Your reviews, synced through the official API"
        body="Connect with Google OAuth, choose your locations, and ReviewPilot syncs reviews in the background and publishes the replies you approve. No scraping, ever. While Google API access is pending, paste your review link and start collecting immediately."
        points={["Clear status: connected, pending, token expired or error — never faked", "Encrypted tokens with automatic refresh", "Retry handling and quota-aware background sync"]}
        visual={
          <div className="tech-corners rounded-xl border border-border-strong bg-card/80 shadow-lg hairline-top">
            <div className="flex items-center gap-3 border-b border-border p-5">
              <span className="flex size-10 items-center justify-center rounded-md border border-border bg-background-subtle"><GoogleIcon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">Google Business Profile</p>
                <p className="font-mono text-[10.5px] text-subtle-foreground">3 locations · last synced 4 min ago</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--mint)_28%,transparent)] bg-mint-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-mint"><Check className="size-3" /> Connected</span>
            </div>
            <div>
              {["Koramangala", "Indiranagar", "HSR Layout"].map((l, i) => (
                <div key={l} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-5 py-3.5 text-[13px] last:border-0">
                  <span className="flex min-w-0 items-center gap-2.5 text-foreground"><MapPin className="size-3.5 shrink-0 text-primary" /> <span className="truncate">Saffron Table — {l}</span></span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"><RefreshCw className="size-3" /> {[182, 141, 89][i]} reviews</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
              <span>OAuth · tokens encrypted</span>
              <span className="text-amber">Sample</span>
            </div>
          </div>
        }
      />

      <Split
        id="analytics"
        index="M.05"
        eyebrow="Analytics & intelligence"
        title="See the story behind your star rating"
        body="Track rating trends, review volume, response times and campaign performance by location and channel. AI groups what customers mention into themes, so you know what to celebrate and what to fix."
        points={["Every metric labelled with its definition and source", "CSV exports and monthly PDF reports", "Filters by date, location, campaign and channel"]}
        visual={
          <div className="rounded-xl border border-border-strong bg-card/80 p-6 shadow-lg hairline-top">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-foreground">Top themes · last 90 days</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber">Sample data</span>
            </div>
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

      <Section id="team" className="scroll-mt-32">
        <SectionHeading index={[6, 7]} eyebrow="Teams & locations" title="Built for one shop or fifty" description="Invite your team with the right level of access, and give managers only the locations they run." />
        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card/70">
          <div className="hidden grid-cols-[180px_1fr_200px] border-b border-border px-6 py-3 md:grid">
            <span className="micro-label">Role</span>
            <span className="micro-label">Scope</span>
            <span className="micro-label text-right">Access level</span>
          </div>
          {[
            { role: "Owner", desc: "Everything, including billing and team." },
            { role: "Admin", desc: "Locations, reviews, campaigns, customers." },
            { role: "Manager", desc: "Assigned locations, reviews, campaigns." },
            { role: "Staff", desc: "Day-to-day reviews and customers." },
            { role: "Analyst", desc: "Read-only analytics and reports." },
          ].map((r, i) => (
            <div key={r.role} className="grid gap-2 border-b border-border px-6 py-4 transition-colors last:border-0 hover:bg-surface-hover/40 md:grid-cols-[180px_1fr_200px] md:items-center">
              <p className="flex items-center gap-3 text-[14.5px] font-semibold text-foreground">
                <span className="font-mono text-[10.5px] font-normal text-subtle-foreground">R.{String(i + 1).padStart(2, "0")}</span>
                <Users className="size-4 text-primary" />
                {r.role}
              </p>
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
              <div className="flex items-center gap-[3px] md:justify-end" aria-hidden>
                {Array.from({ length: 10 }).map((_, j) => (
                  <span key={j} className={`h-3 w-[5px] rounded-[1px] ${j < (5 - i) * 2 ? "bg-primary shadow-[0_0_6px_-1px_var(--primary)]" : "bg-border-strong"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="security" className="scroll-mt-32" grid>
        <SectionHeading index={[7, 7]} eyebrow="Security & privacy" title="Your customers trust you. We take that seriously." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Database, t: "Tenant isolation", d: "Every query is scoped to your organization, enforced on the server." },
            { icon: Lock, t: "Encrypted credentials", d: "OAuth and API tokens encrypted at rest; never sent to the browser." },
            { icon: KeyRound, t: "Secure sessions", d: "HTTP-only cookies, refresh-token rotation and login throttling." },
            { icon: UserCheck, t: "Consent & opt-outs", d: "Consent tracked per channel; opt-outs honoured automatically." },
            { icon: ScrollText, t: "Audit logs", d: "Sensitive actions are recorded with actor, target and time." },
            { icon: ShieldCheck, t: "DPDP & GDPR", d: "Data export and deletion workflows for your customers." },
          ].map((f, i) => (
            <div key={f.t} className="relative bg-[color-mix(in_oklab,var(--card)_92%,var(--background))] p-6 transition-colors hover:bg-card">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background-subtle"><f.icon className="size-4 text-primary" /></span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-subtle-foreground">S.{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p className="mt-5 text-[15px] font-semibold text-foreground">{f.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
