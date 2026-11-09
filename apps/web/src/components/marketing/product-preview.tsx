"use client";
import * as React from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  MessageSquareText,
  Megaphone,
  QrCode,
  Sparkles,
  ChartLine,
  Users,
  Send,
  CheckCheck,
  MousePointerClick,
  TriangleAlert,
  ThumbsUp,
  Check,
  Search,
} from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { AnimatedNumber, StatusDot } from "@/components/ui/tech";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { SampleTag } from "./primitives";

type Tab = "reviews" | "whatsapp" | "insights";

const TABS: { id: Tab; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "reviews", label: "Reviews", short: "Reviews", icon: MessageSquareText },
  { id: "whatsapp", label: "WhatsApp campaign", short: "WhatsApp", icon: Send },
  { id: "insights", label: "AI insights", short: "Insights", icon: Sparkles },
];

const trend = [18, 22, 19, 27, 31, 29, 38, 41, 47, 52];
const trendLabels = ["Aug 4", "Aug 18", "Sep 1", "Sep 15", "Sep 29", "Oct 6"];

const AI_REPLY =
  "Thank you so much, Kavya! We're delighted the masala dosa and our team made your Sunday brunch special. We've shared your note about parking with our manager — see you again soon!";

function useTyping(text: string, active: boolean) {
  const reduce = useReducedMotion();
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    if (reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 2;
        setN(Math.min(i, text.length));
        if (i >= text.length && interval) clearInterval(interval);
      }, 28);
    }, 600);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, active, reduce]);
  return text.slice(0, n);
}

export function ProductPreview() {
  const [tab, setTab] = React.useState<Tab>("reviews");
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} className="relative">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5 backdrop-blur" role="tablist" aria-label="Product preview">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="pp-panel"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="pp-tab"
                  className="absolute inset-0 rounded-md border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <t.icon className={cn("relative size-3.5", tab === t.id && "text-primary")} />
              <span className="relative hidden sm:inline">{t.label}</span>
              <span className="relative sm:hidden">{t.short}</span>
            </button>
          ))}
        </div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">Interactive · select a view</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border-strong bg-background-subtle shadow-lg">
        {/* app chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-border bg-[color-mix(in_oklab,var(--background)_70%,var(--card))] px-3 sm:px-4">
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full border border-border-strong" />
            ))}
          </div>
          <span className="hidden items-center gap-1.5 font-mono text-[10.5px] tracking-[0.06em] text-subtle-foreground sm:flex">
            app.reviewpilot.ai <span className="text-border-strong">/</span> <span className="text-foreground-soft">{tab === "reviews" ? "reviews" : tab === "whatsapp" ? "campaigns/post-dinner" : "ai/insights"}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden h-6 items-center gap-1.5 rounded-md border border-border px-2 font-mono text-[10px] text-subtle-foreground md:flex">
              <Search className="size-3" /> Search <span className="ml-3 rounded-[3px] border border-border px-1">⌘K</span>
            </span>
            <SampleTag />
          </span>
        </div>

        <div className="grid min-h-[460px] grid-cols-1 md:grid-cols-[196px_1fr]">
          <aside className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3 text-[12.5px] text-sidebar-foreground md:flex">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <LogoMark size={22} />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-foreground">Saffron Table</p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">3 locations</p>
              </div>
            </div>
            <p className="micro-label px-2.5 pb-1 pt-2 !text-[9.5px]">Workspace</p>
            {[
              { icon: LayoutDashboard, label: "Overview", tab: null },
              { icon: MessageSquareText, label: "Reviews", tab: "reviews" },
              { icon: Megaphone, label: "Campaigns", tab: "whatsapp" },
              { icon: QrCode, label: "QR Codes", tab: null },
              { icon: Users, label: "Customers", tab: null },
              { icon: Sparkles, label: "AI Assistant", tab: "insights" },
              { icon: ChartLine, label: "Analytics", tab: null },
            ].map((item) => {
              const on = item.tab === tab;
              return (
                <div key={item.label} className={cn("relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px]", on && "bg-sidebar-active text-foreground")}>
                  {on && (
                    <motion.span layoutId="pp-side" className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
                  )}
                  <item.icon className={cn("size-4", on ? "text-primary" : "text-subtle-foreground")} />
                  {item.label}
                </div>
              );
            })}
            <div className="mt-auto rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="micro-label !text-[9.5px]">Setup</p>
                <p className="font-mono text-[10px] text-foreground-soft">5 / 6</p>
              </div>
              <div className="mt-2 flex gap-[3px]" aria-hidden>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn("h-1 flex-1 rounded-[1px]", i < 5 ? "bg-primary" : "bg-border-strong")} />
                ))}
              </div>
            </div>
          </aside>

          <div id="pp-panel" role="tabpanel" className="relative min-w-0 bg-background p-3 sm:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === "reviews" && <ReviewsPane active={inView} />}
                {tab === "whatsapp" && <WhatsAppPane />}
                {tab === "insights" && <InsightsPane />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, accent = "bg-primary" }: { label: string; value: React.ReactNode; delta: string; accent?: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-card p-2.5 hairline-top sm:p-3">
      <span className={cn("absolute inset-x-3 top-0 h-px opacity-80", accent)} aria-hidden />
      <p className="micro-label !text-[9.5px]">{label}</p>
      <p className="mt-2 text-[20px] font-semibold leading-none tracking-[-0.035em] text-foreground tabular">{value}</p>
      <p className="mt-2 inline-flex rounded-[3px] bg-success-soft px-1 font-mono text-[9.5px] text-success-foreground">{delta}</p>
    </div>
  );
}

function AreaSpark({ data }: { data: number[] }) {
  const w = 400;
  const h = 120;
  const max = Math.max(...data) * 1.12;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const reduce = useReducedMotion();
  const last = pts[pts.length - 1];
  return (
    <div className="relative h-[132px]">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="var(--chart-grid)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        ))}
        <motion.path d={area} fill="url(#pp-area)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_25%,transparent),0_0_12px_var(--primary)]"
        style={{ left: `${(last[0] / w) * 100}%`, top: `${(last[1] / h) * (120 / 132) * 100}%` }}
        aria-hidden
      />
    </div>
  );
}

function ReviewsPane({ active }: { active: boolean }) {
  const typed = useTyping(AI_REPLY, active);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          <Metric label="Avg rating" value={<AnimatedNumber value={4.7} format={(n) => n.toFixed(1)} />} delta="+0.3" accent="bg-amber" />
          <Metric label="New reviews" value={<AnimatedNumber value={128} />} delta="+42%" />
          <Metric label="Response" value={<AnimatedNumber value={96} format={(n) => `${Math.round(n)}%`} />} delta="+18 pts" accent="bg-mint" />
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-foreground">Google reviews per week</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">10 wk</span>
          </div>
          <div className="mt-3">
            <AreaSpark data={trend} />
            <div className="mt-2 flex justify-between font-mono text-[9.5px] text-subtle-foreground">
              {trendLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="relative rounded-lg border border-[color-mix(in_oklab,var(--primary)_30%,var(--border))] bg-card p-3.5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_10%,transparent),0_12px_30px_-16px_color-mix(in_oklab,var(--primary)_40%,transparent)]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md border border-border-strong bg-background-subtle font-mono text-[10px] text-foreground-soft">KR</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-foreground">Kavya R.</p>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-subtle-foreground">
                <Stars rating={5} size={10} /> 12 min ago
              </div>
            </div>
            <GoogleIcon className="size-3.5" />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground-soft">Best masala dosa in Koramangala, and the staff were so welcoming. Parking was a bit tricky on Sunday.</p>
          <div className="relative mt-2.5 overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--primary)_22%,transparent)] bg-primary-soft p-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-primary">
            <div className="mb-1 flex items-center justify-between">
              <p className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-primary">
                <Sparkles className="size-3" /> AI draft · Friendly
              </p>
              <span className="font-mono text-[9.5px] text-subtle-foreground">EN</span>
            </div>
            <p className="min-h-[68px] text-[11.5px] leading-relaxed text-foreground-soft">
              {typed}
              <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-primary motion-safe:animate-pulse" aria-hidden />
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[5px] bg-primary px-2 py-1 text-[10.5px] font-medium text-primary-foreground">
                <Check className="size-3" /> Approve & publish
              </span>
              <span className="rounded-[5px] border border-border-strong px-2 py-1 text-[10.5px] font-medium text-foreground-soft">Edit</span>
            </div>
          </div>
        </div>
        {[
          { n: "Rohit S.", r: 4, t: "Great filter coffee. Service slowed down when it got busy.", i: "RS", s: "Replied" },
          { n: "Meera J.", r: 2, t: "Waited 30 minutes for our order on Saturday night.", i: "MJ", s: "Needs reply" },
        ].map((r) => (
          <div key={r.n} className="flex gap-2.5 rounded-lg border border-border bg-card p-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background-subtle font-mono text-[10px] text-foreground-soft">{r.i}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-foreground">{r.n}</p>
                <Stars rating={r.r} size={9} />
                <span className={cn("ml-auto font-mono text-[9px] uppercase tracking-[0.1em]", r.s === "Replied" ? "text-mint" : "text-amber")}>{r.s}</span>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{r.t}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatsAppPane() {
  const steps = [
    { label: "Requests sent", value: 1240, icon: Send, pct: 100 },
    { label: "Delivered", value: 1198, icon: CheckCheck, pct: 96.6 },
    { label: "Feedback page opened", value: 612, icon: MousePointerClick, pct: 49.4 },
    { label: "Clicked through to Google", value: 341, icon: GoogleIcon, pct: 27.5 },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Post-dinner thank you</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">WhatsApp · 45 min after bill · Koramangala</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--mint)_28%,transparent)] bg-mint-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-mint">
            <StatusDot tone="live" pulse className="!size-1.5" /> Active
          </span>
        </div>
        <ul className="mt-5 space-y-4">
          {steps.map((s, i) => (
            <li key={s.label}>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="inline-flex items-center gap-2 font-medium text-foreground-soft">
                  <span className="font-mono text-[9.5px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <s.icon className="size-3.5 text-muted-foreground" />
                  {s.label}
                </span>
                <span className="font-mono text-[11.5px] text-foreground tabular">
                  {s.value.toLocaleString("en-IN")} <span className="text-subtle-foreground">· {s.pct}%</span>
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-[2px] bg-muted">
                <motion.div
                  className="h-full rounded-[2px] bg-[linear-gradient(90deg,var(--ice),var(--cyan))]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: s.pct / 100 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-3 text-[10.5px] leading-relaxed text-subtle-foreground">
          Clicks are first-party measurements. Posted reviews are only attributed when verifiable through Google.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-strong bg-[#0b141a]">
        <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2.5 text-[#e9edef]">
          <WhatsAppIcon className="size-4" />
          <p className="text-[12px] font-semibold">Saffron Table</p>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-[#8696a0]">Template approved</span>
        </div>
        <div className="space-y-2 p-3">
          <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-[#202c33] px-2.5 py-2 text-[11.5px] leading-relaxed text-[#e9edef]">
            Hi Priya, thanks for dining with us tonight! How was everything? Tell us in under a minute.
            <div className="mt-1.5 rounded-md bg-white/5 py-1 text-center text-[11px] font-medium text-[#53bdeb]">Share feedback</div>
            <p className="mt-1 flex items-center justify-end gap-1 text-[9.5px] text-[#8696a0]">
              8:41 pm <CheckCheck className="size-3 text-[#53bdeb]" />
            </p>
          </div>
          <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2.5 py-1.5 text-[11.5px] text-[#e9edef]">Done! The dosa was amazing.</div>
          <div className="mx-auto w-fit rounded-md bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white/50">Reply STOP to opt out</div>
        </div>
      </div>
    </div>
  );
}

function InsightsPane() {
  const themes = [
    { label: "Food taste & quality", v: 86, tone: "pos" },
    { label: "Staff friendliness", v: 72, tone: "pos" },
    { label: "Ambience", v: 54, tone: "pos" },
    { label: "Weekend wait time", v: 31, tone: "neg" },
    { label: "Parking", v: 18, tone: "neg" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-foreground">Themes from 412 reviews</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">90 days</span>
        </div>
        <div className="mt-4 flex h-2 gap-[2px] overflow-hidden rounded-[2px]">
          <div className="w-[71%] bg-mint" />
          <div className="w-[17%] bg-amber" />
          <div className="w-[12%] bg-danger" />
        </div>
        <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          <span>
            <span className="text-mint">71%</span> positive
          </span>
          <span>
            <span className="text-amber">17%</span> mixed
          </span>
          <span>
            <span className="text-danger-foreground">12%</span> negative
          </span>
        </div>
        <ul className="mt-5 space-y-3">
          {themes.map((t) => (
            <li key={t.label} className="flex items-center gap-3 text-[12px]">
              <span className="w-32 shrink-0 truncate text-foreground-soft sm:w-36">{t.label}</span>
              <div className="h-[3px] flex-1 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", t.tone === "pos" ? "bg-mint" : "bg-danger")} style={{ width: `${t.v}%` }} />
              </div>
              <span className="w-6 text-right font-mono text-[11px] text-muted-foreground tabular">{t.v}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2.5">
        {[
          { icon: TriangleAlert, tone: "text-danger-foreground border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft", title: "Weekend evenings rate 0.8★ lower", body: "31 reviews since August mention waiting for tables or food on Saturday and Sunday nights.", tag: "Recurring complaint" },
          { icon: ThumbsUp, tone: "text-mint border-[color-mix(in_oklab,var(--mint)_28%,transparent)] bg-mint-soft", title: "Staff warmth drives 5★ reviews", body: "Servers are named in 64 five-star reviews, most often for recommendations and attentiveness.", tag: "Strength" },
          { icon: Sparkles, tone: "text-primary border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft", title: "Suggested: add a weekend host", body: "A host on Fri–Sun evenings could address the most frequent complaint this quarter.", tag: "Recommendation" },
        ].map((i) => (
          <div key={i.title} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border", i.tone)}>
              <i.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="micro-label !text-[9.5px]">{i.tag}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">{i.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{i.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
