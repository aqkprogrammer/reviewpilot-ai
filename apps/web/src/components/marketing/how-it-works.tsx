"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, QrCode, Sparkles, Check, Plug, Inbox, Reply } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { Section, SectionHeading } from "./primitives";
import { cn } from "@/lib/utils";

const steps = [
  { id: "connect", icon: Plug, title: "Connect", body: "Link Google Business Profile, or paste your review link. Connect WhatsApp and email in a few minutes." },
  { id: "collect", icon: Inbox, title: "Collect", body: "Ask every customer through QR, WhatsApp or email. Private feedback and public reviews land in one inbox." },
  { id: "respond", icon: Reply, title: "Respond", body: "Approve AI-drafted replies, follow up on concerns and track what customers say over time." },
] as const;

export function HowItWorks() {
  const [active, setActive] = React.useState<(typeof steps)[number]["id"]>("connect");
  return (
    <Section id="how-it-works" className="bg-background-subtle/40">
      <SectionHeading eyebrow="How It Works" title="Simplifying feedback in three easy steps" />
      <div className="mt-14 grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <ol className="relative space-y-2" aria-label="Steps">
          <span className="absolute bottom-6 left-[19px] top-6 w-px bg-border" aria-hidden />
          {steps.map((s, i) => {
            const on = active === s.id;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setActive(s.id)}
                  aria-current={on ? "step" : undefined}
                  className={cn("relative flex w-full gap-4 rounded-2xl p-3 text-left transition-colors", on ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/60")}
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors",
                      on ? "border-transparent bg-[linear-gradient(135deg,#d63af0,#6a4cff)] text-white shadow-glow" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className={cn("block text-[16px] font-semibold", on ? "text-foreground" : "text-foreground-soft")}>{s.title}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-muted-foreground">{s.body}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="relative min-h-[340px] rounded-[24px] border border-border bg-card p-5 shadow-md sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {active === "connect" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: GoogleIcon, name: "Google Business Profile", desc: "Sync reviews and publish approved replies via the official API.", status: "Connected" },
                    { icon: WhatsAppIcon, name: "WhatsApp Cloud API", desc: "Your own number, Meta-approved templates, delivery webhooks.", status: "Connected" },
                    { icon: Mail, name: "Email (Resend)", desc: "Branded sender with unsubscribe and delivery tracking.", status: "Ready" },
                    { icon: QrCode, name: "QR codes", desc: "Per-location codes with first-party scan tracking.", status: "Ready" },
                  ].map((c) => (
                    <div key={c.name} className="rounded-2xl border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-background-subtle ring-1 ring-border">
                          <c.icon className="size-4 text-primary" />
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-medium text-success-foreground">
                          <Check className="size-3" /> {c.status}
                        </span>
                      </div>
                      <p className="mt-3 text-[13.5px] font-semibold text-foreground">{c.name}</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
                    </div>
                  ))}
                </div>
              )}
              {active === "collect" && (
                <div className="space-y-2.5">
                  <p className="text-[12px] font-medium uppercase tracking-wider text-subtle-foreground">Unified inbox · today</p>
                  {[
                    { src: WhatsAppIcon, who: "Priya N.", what: "Private feedback · 5★", text: "Lovely evening, thank you!", time: "8:51 pm" },
                    { src: GoogleIcon, who: "Rahul V.", what: "Google review · 4★", text: "Great food, slightly slow on a busy night.", time: "8:12 pm" },
                    { src: QrCode, who: "Anonymous", what: "QR feedback · 3★", text: "AC was too cold near the window seats.", time: "7:40 pm" },
                    { src: Mail, who: "Farah S.", what: "Email request · clicked to Google", text: "Opened feedback page and visited Google.", time: "6:05 pm" },
                  ].map((m) => (
                    <div key={m.who + m.time} className="flex items-start gap-3 rounded-xl border border-border p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-subtle">
                        <m.src className="size-4 text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-foreground">{m.who} <span className="font-normal text-muted-foreground">· {m.what}</span></p>
                          <span className="shrink-0 text-[11px] text-subtle-foreground">{m.time}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {active === "respond" && (
                <div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[13px] font-semibold text-foreground">Rahul V. · 4★</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">&ldquo;Great food, slightly slow on a busy night.&rdquo;</p>
                  </div>
                  <div className="mt-3 rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-soft-foreground">
                      <Sparkles className="size-3.5" /> AI draft · Appreciative
                    </p>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-foreground-soft">
                      Thanks for the lovely words about the food, Rahul! We&apos;re sorry things slowed down — we&apos;ve added an extra server for peak hours. Hope to host you again soon.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white">Approve & publish to Google</span>
                      <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground-soft">Regenerate</span>
                      <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground-soft">Edit</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
