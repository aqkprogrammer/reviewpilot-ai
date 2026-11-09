"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mail, QrCode, Sparkles, Check, Plug, Inbox, Reply } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { Section, SectionHeading, SampleTag } from "./primitives";
import { cn } from "@/lib/utils";

const steps = [
  { id: "connect", icon: Plug, title: "Connect", time: "T+00:00", body: "Link Google Business Profile, or paste your review link. Connect WhatsApp and email in a few minutes." },
  { id: "collect", icon: Inbox, title: "Collect", time: "T+00:10", body: "Ask every customer through QR, WhatsApp or email. Private feedback and public reviews land in one inbox." },
  { id: "respond", icon: Reply, title: "Respond", time: "Ongoing", body: "Approve AI-drafted replies, follow up on concerns and track what customers say over time." },
] as const;

type StepId = (typeof steps)[number]["id"];

export function HowItWorks() {
  const [active, setActive] = React.useState<StepId>("connect");
  const reduce = useReducedMotion();
  const idx = steps.findIndex((s) => s.id === active);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (idx + (e.key === "ArrowRight" ? 1 : steps.length - 1)) % steps.length;
    setActive(steps[n].id);
    document.getElementById(`hiw-tab-${steps[n].id}`)?.focus();
  };

  return (
    <Section id="how-it-works" grid>
      <SectionHeading index={[3, 9]} eyebrow="How it works" title="Simplifying feedback in three easy steps" description="A single loop — connect once, ask every customer the same way, and answer with care. The timeline below is interactive." />

      <div className="relative mt-16">
        {/* rail */}
        <div className="absolute left-0 right-0 top-[15px] hidden h-px bg-border-strong md:block" aria-hidden />
        <motion.div
          className="absolute left-0 top-[15px] hidden h-px origin-left bg-primary shadow-[0_0_10px_var(--primary)] md:block"
          style={{ width: "100%" }}
          initial={false}
          animate={{ scaleX: idx / steps.length + 0.028 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 30 }}
          aria-hidden
        />
        <div role="tablist" aria-label="Steps" className="grid items-start gap-3 md:grid-cols-3 md:gap-8" onKeyDown={onKey}>
          {steps.map((s, i) => {
            const on = active === s.id;
            const done = i < idx;
            return (
              <button
                key={s.id}
                id={`hiw-tab-${s.id}`}
                role="tab"
                aria-selected={on}
                aria-controls="hiw-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(s.id)}
                className={cn(
                  "group relative rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring max-md:border max-md:p-4",
                  on ? "max-md:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] max-md:bg-card" : "max-md:border-border",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "relative z-10 flex size-[31px] items-center justify-center rounded-md border font-mono text-[11px] transition-all duration-300",
                      on
                        ? "border-primary bg-background text-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent),0_0_18px_-2px_var(--primary)]"
                        : done
                          ? "border-[color-mix(in_oklab,var(--primary)_45%,transparent)] bg-background text-primary"
                          : "border-border-strong bg-background text-subtle-foreground",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="bg-background px-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground max-md:bg-transparent">{s.time}</span>
                </span>
                <span className="mt-5 flex items-center gap-2">
                  <s.icon className={cn("size-4 transition-colors", on ? "text-primary" : "text-subtle-foreground")} />
                  <span className={cn("text-[19px] font-semibold tracking-[-0.02em] transition-colors", on ? "text-foreground" : "text-foreground-soft group-hover:text-foreground")}>{s.title}</span>
                </span>
                <span className="mt-2 block max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">{s.body}</span>
              </button>
            );
          })}
        </div>

        <div id="hiw-panel" role="tabpanel" aria-labelledby={`hiw-tab-${active}`} className="tech-corners relative mt-10 min-h-[330px] rounded-xl border border-border bg-card/80 shadow-md hairline-top">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="micro-label">
              Step {String(idx + 1).padStart(2, "0")} · {steps[idx].title}
            </span>
            <SampleTag>Illustrative</SampleTag>
          </div>
          <div className="p-5 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                {active === "connect" && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: GoogleIcon, name: "Google Business Profile", desc: "Sync reviews and publish approved replies via the official API.", status: "Connected" },
                      { icon: WhatsAppIcon, name: "WhatsApp Cloud API", desc: "Your own number, Meta-approved templates, delivery webhooks.", status: "Connected" },
                      { icon: Mail, name: "Email (Resend)", desc: "Branded sender with unsubscribe and delivery tracking.", status: "Ready" },
                      { icon: QrCode, name: "QR codes", desc: "Per-location codes with first-party scan tracking.", status: "Ready" },
                    ].map((c) => (
                      <div key={c.name} className="rounded-lg border border-border bg-background-subtle p-4">
                        <div className="flex items-center justify-between">
                          <span className="flex size-9 items-center justify-center rounded-md border border-border bg-card">
                            <c.icon className="size-4 text-primary" />
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[color-mix(in_oklab,var(--mint)_28%,transparent)] bg-mint-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-mint">
                            <Check className="size-3" /> {c.status}
                          </span>
                        </div>
                        <p className="mt-4 text-[13.5px] font-semibold text-foreground">{c.name}</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
                {active === "collect" && (
                  <div>
                    <p className="micro-label mb-3">Unified inbox · today</p>
                    <div className="overflow-hidden rounded-lg border border-border">
                      {[
                        { src: WhatsAppIcon, who: "Priya N.", what: "Private feedback · 5★", text: "Lovely evening, thank you!", time: "20:51" },
                        { src: GoogleIcon, who: "Rahul V.", what: "Google review · 4★", text: "Great food, slightly slow on a busy night.", time: "20:12" },
                        { src: QrCode, who: "Anonymous", what: "QR feedback · 3★", text: "AC was too cold near the window seats.", time: "19:40" },
                        { src: Mail, who: "Farah S.", what: "Email request · clicked to Google", text: "Opened feedback page and visited Google.", time: "18:05" },
                      ].map((m, i) => (
                        <div key={m.who + m.time} className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-background-subtle px-4 py-3", i > 0 && "border-t border-border")}>
                          <span className="flex size-8 items-center justify-center rounded-md border border-border bg-card">
                            <m.src className="size-4 text-primary" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {m.who} <span className="font-normal text-muted-foreground">· {m.what}</span>
                            </p>
                            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{m.text}</p>
                          </div>
                          <span className="font-mono text-[11px] text-subtle-foreground tabular">{m.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {active === "respond" && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto_1.3fr] lg:items-center">
                    <div className="rounded-lg border border-border bg-background-subtle p-4">
                      <p className="micro-label">Input · Google review</p>
                      <p className="mt-3 text-[13.5px] font-semibold text-foreground">Rahul V. · 4★</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">&ldquo;Great food, slightly slow on a busy night.&rdquo;</p>
                    </div>
                    <div className="hidden items-center gap-1 lg:flex" aria-hidden>
                      <span className="h-px w-8 bg-[linear-gradient(90deg,var(--border-strong),var(--primary))]" />
                      <Sparkles className="size-4 text-primary" />
                      <span className="h-px w-8 bg-[linear-gradient(90deg,var(--primary),var(--border-strong))]" />
                    </div>
                    <div className="relative overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft p-4 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-primary">
                      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                        <Sparkles className="size-3.5" /> Output · AI draft · Appreciative
                      </p>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-foreground-soft">
                        Thanks for the lovely words about the food, Rahul! We&apos;re sorry things slowed down — we&apos;ve added an extra server for peak hours. Hope to host you again soon.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground">Approve & publish to Google</span>
                        <span className="rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-medium text-foreground-soft">Regenerate</span>
                        <span className="rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-medium text-foreground-soft">Edit</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
}
