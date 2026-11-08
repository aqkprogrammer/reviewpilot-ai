"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
  LayoutDashboard,
  MessageSquareText,
  Megaphone,
  QrCode,
  Sparkles,
  ChartLine,
  Users,
  Star,
  ArrowUpRight,
  Send,
  CheckCheck,
  MousePointerClick,
  TriangleAlert,
  ThumbsUp,
  Check,
} from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type Tab = "reviews" | "whatsapp" | "insights";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "reviews", label: "Reviews", icon: MessageSquareText },
  { id: "whatsapp", label: "WhatsApp campaign", icon: Send },
  { id: "insights", label: "AI insights", icon: Sparkles },
];

const trend = [
  { w: "Aug 4", v: 18 },
  { w: "Aug 11", v: 22 },
  { w: "Aug 18", v: 19 },
  { w: "Aug 25", v: 27 },
  { w: "Sep 1", v: 31 },
  { w: "Sep 8", v: 29 },
  { w: "Sep 15", v: 38 },
  { w: "Sep 22", v: 41 },
  { w: "Sep 29", v: 47 },
  { w: "Oct 6", v: 52 },
];

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
    }, 700);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, active, reduce]);
  return text.slice(0, n);
}

export function ProductPreview() {
  const [tab, setTab] = React.useState<Tab>("reviews");
  return (
    <div className="relative">
      <div className="mx-auto mb-4 flex w-fit items-center gap-1 rounded-full border border-border bg-card/80 p-1 shadow-sm backdrop-blur" role="tablist" aria-label="Product preview">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === t.id && (
              <motion.span layoutId="preview-pill" className="absolute inset-0 rounded-full bg-[#1d0b3a] dark:bg-primary" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
            )}
            <t.icon className="relative size-3.5" />
            <span className="relative hidden sm:inline">{t.label}</span>
            <span className="relative sm:hidden">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-[#e4dcf5] bg-card shadow-[0_40px_80px_-30px_rgba(70,30,160,0.35),0_0_0_6px_rgba(255,255,255,0.5)] dark:border-border dark:shadow-lg">
        {/* window chrome */}
        <div className="flex h-9 items-center gap-1.5 border-b border-border bg-background-subtle px-4">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto hidden rounded-md bg-card px-3 py-0.5 text-[11px] text-subtle-foreground ring-1 ring-border sm:block">app.reviewpilot.ai</span>
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning-foreground">Sample data</span>
        </div>

        <div className="grid min-h-[440px] grid-cols-1 md:grid-cols-[188px_1fr]">
          <aside className="hidden flex-col gap-0.5 bg-[linear-gradient(180deg,#2a1150,#1a0a35)] p-3 text-[12.5px] text-white/70 md:flex">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <LogoMark size={22} />
              <span className="font-semibold text-white">Saffron Table</span>
            </div>
            {[
              { icon: LayoutDashboard, label: "Overview", tab: null },
              { icon: MessageSquareText, label: "Reviews", tab: "reviews" },
              { icon: Megaphone, label: "Campaigns", tab: "whatsapp" },
              { icon: QrCode, label: "QR Codes", tab: null },
              { icon: Users, label: "Customers", tab: null },
              { icon: Sparkles, label: "AI Assistant", tab: "insights" },
              { icon: ChartLine, label: "Analytics", tab: null },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
                  item.tab === tab && "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </div>
            ))}
            <div className="mt-auto rounded-xl bg-white/8 p-3">
              <p className="text-[11px] font-medium text-white">Setup 5 of 6</p>
              <div className="mt-2 h-1 rounded-full bg-white/15">
                <div className="h-full w-5/6 rounded-full bg-[linear-gradient(90deg,#d63af0,#8b5cf6)]" />
              </div>
            </div>
          </aside>

          <div className="relative bg-background p-4 sm:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === "reviews" && <ReviewsPane />}
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

function Metric({ label, value, delta, icon: Icon }: { label: string; value: string; delta: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-subtle-foreground" />
      </div>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground tabular">{value}</p>
      <p className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-success-foreground">
        <ArrowUpRight className="size-3" />
        {delta}
      </p>
    </div>
  );
}

function ReviewsPane() {
  const typed = useTyping(AI_REPLY, true);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Metric label="Avg rating" value="4.7" delta="+0.3" icon={Star} />
          <Metric label="New reviews" value="128" delta="+42%" icon={MessageSquareText} />
          <Metric label="Response rate" value="96%" delta="+18 pts" icon={CheckCheck} />
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-foreground">Google reviews per week</p>
            <span className="text-[11px] text-muted-foreground">Last 10 weeks</span>
          </div>
          <div className="mt-2 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#d63af0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="w" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--subtle-foreground)" }} interval={2} />
                <Tooltip
                  cursor={{ stroke: "var(--border-strong)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(v) => [`${v} reviews`, ""]}
                />
                <Area type="monotone" dataKey="v" stroke="#6a4cff" strokeWidth={2.2} fill="url(#pp-area)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-xl border border-primary/30 bg-card p-3.5 shadow-sm ring-4 ring-primary/5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-[#fde8f6] text-[10px] font-semibold text-[#a21caf]">KR</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-foreground">Kavya R.</p>
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <Stars rating={5} size={10} /> 12 min ago
              </div>
            </div>
            <GoogleIcon className="size-3.5" />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground-soft">
            Best masala dosa in Koramangala, and the staff were so welcoming. Parking was a bit tricky on Sunday.
          </p>
          <div className="mt-2.5 rounded-lg border border-primary/15 bg-primary-soft/50 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold text-primary-soft-foreground">
                <Sparkles className="size-3" /> AI draft · Friendly
              </p>
              <span className="text-[10px] text-muted-foreground">EN</span>
            </div>
            <p className="min-h-[68px] text-[11.5px] leading-relaxed text-foreground-soft">
              {typed}
              <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 animate-pulse bg-primary" aria-hidden />
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10.5px] font-medium text-white">
                <Check className="size-3" /> Approve & publish
              </span>
              <span className="rounded-md border border-border bg-card px-2 py-1 text-[10.5px] font-medium text-foreground-soft">Edit</span>
            </div>
          </div>
        </div>
        {[
          { n: "Rohit S.", r: 4, t: "Great filter coffee. Service slowed down when it got busy.", i: "RS" },
          { n: "Meera J.", r: 2, t: "Waited 30 minutes for our order on Saturday night.", i: "MJ" },
        ].map((r) => (
          <div key={r.n} className="flex gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground-soft">{r.i}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-foreground">{r.n}</p>
                <Stars rating={r.r} size={9} />
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
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Post-dinner thank you</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">WhatsApp · 45 min after bill · Koramangala</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-medium text-success-foreground">
            <span className="size-1.5 animate-[pulse-ring_2s_infinite] rounded-full bg-success" /> Active
          </span>
        </div>
        <ul className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.label}>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="inline-flex items-center gap-2 font-medium text-foreground-soft">
                  <s.icon className="size-3.5 text-muted-foreground" />
                  {s.label}
                </span>
                <span className="font-semibold text-foreground tabular">
                  {s.value.toLocaleString("en-IN")} <span className="font-normal text-muted-foreground">· {s.pct}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#6a4cff,#a855f7)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${s.pct}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10.5px] leading-relaxed text-subtle-foreground">
          Clicks are first-party measurements. Posted reviews are only attributed when verifiable through Google.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
          <WhatsAppIcon className="size-4" />
          <p className="text-[12px] font-semibold">Saffron Table</p>
          <span className="ml-auto text-[10px] text-white/70">Template approved</span>
        </div>
        <div className="space-y-2 bg-[#efe7dd] p-3 dark:bg-[#0b141a]">
          <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white px-2.5 py-2 text-[11.5px] leading-relaxed text-[#111b21] shadow-xs dark:bg-[#202c33] dark:text-[#e9edef]">
            Hi Priya, thanks for dining with us tonight! How was everything? Tell us in under a minute.
            <div className="mt-1.5 rounded-md bg-[#f5f5f5] py-1 text-center text-[11px] font-medium text-[#027eb5] dark:bg-white/5 dark:text-[#53bdeb]">Share feedback</div>
            <p className="mt-1 flex items-center justify-end gap-1 text-[9.5px] text-[#667781]">8:41 pm <CheckCheck className="size-3 text-[#53bdeb]" /></p>
          </div>
          <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[11.5px] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
            Done! The dosa was amazing.
          </div>
          <div className="mx-auto w-fit rounded-md bg-white/70 px-2 py-0.5 text-[9.5px] text-[#54656f] dark:bg-white/5 dark:text-white/50">Reply STOP to opt out</div>
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
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-foreground">Themes from 412 reviews</p>
          <span className="text-[10.5px] text-muted-foreground">Last 90 days</span>
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
          <div className="w-[71%] bg-success" />
          <div className="w-[17%] bg-warning" />
          <div className="w-[12%] bg-danger" />
        </div>
        <div className="mt-2 flex gap-4 text-[10.5px] text-muted-foreground">
          <span>71% positive</span>
          <span>17% mixed</span>
          <span>12% negative</span>
        </div>
        <ul className="mt-4 space-y-2.5">
          {themes.map((t) => (
            <li key={t.label} className="flex items-center gap-3 text-[12px]">
              <span className="w-36 shrink-0 truncate text-foreground-soft">{t.label}</span>
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", t.tone === "pos" ? "bg-success" : "bg-danger")} style={{ width: `${t.v}%` }} />
              </div>
              <span className="w-6 text-right text-muted-foreground tabular">{t.v}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2.5">
        {[
          {
            icon: TriangleAlert,
            tone: "text-danger-foreground bg-danger-soft",
            title: "Weekend evenings rate 0.8★ lower",
            body: "31 reviews since August mention waiting for tables or food on Saturday and Sunday nights.",
            tag: "Recurring complaint",
          },
          {
            icon: ThumbsUp,
            tone: "text-success-foreground bg-success-soft",
            title: "Staff warmth drives 5★ reviews",
            body: "Servers are named in 64 five-star reviews, most often for recommendations and attentiveness.",
            tag: "Strength",
          },
          {
            icon: Sparkles,
            tone: "text-primary-soft-foreground bg-primary-soft",
            title: "Suggested: add a weekend host",
            body: "A host on Fri–Sun evenings could address the most frequent complaint this quarter.",
            tag: "Recommendation",
          },
        ].map((i) => (
          <div key={i.title} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", i.tone)}>
              <i.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">{i.tag}</p>
              <p className="text-[12.5px] font-semibold text-foreground">{i.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{i.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
