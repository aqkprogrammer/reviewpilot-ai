"use client";
/**
 * ReputationIntelligenceScene — the ReviewPilot story in one composition:
 *   signals (Google, WhatsApp, Email, QR) travel into the intelligence core →
 *   the core responds → sentiment is resolved → an AI reply is drafted → it waits for approval.
 *
 * Everything shown is ILLUSTRATIVE SAMPLE DATA (labelled in the UI). The loop pauses while
 * off-screen and freezes on the final stage under reduced motion.
 *
 * Layout: a fixed-aspect stage (1000 × 640 user units) so HTML panels positioned in % line up
 * exactly with the SVG connectors. Below `md`, a simplified stacked composition is rendered
 * instead of shrinking the desktop scene.
 */
import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Mail, QrCode, Star } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { cn } from "@/lib/utils";
import { ReputationIntelligenceCore } from "./core";
import { HolographicPanel, IntelligenceStatus, SentimentVisualization, TechnicalLabel } from "./primitives";

const STAGE_MS = 2800;
const CORE = { x: 470, y: 320, r: 150 }; // core visual radius in stage units

type Source = { key: string; label: string; from: [number, number]; c1: [number, number]; c2: [number, number]; to: [number, number]; begin: number };

// Signal paths end on the core's rim, aimed at its centre.
const SOURCES: Source[] = [
  { key: "google", label: "Google", from: [300, 92], c1: [380, 92], c2: [360, 200], to: [404, 254], begin: 0 },
  { key: "email", label: "Email", from: [150, 318], c1: [240, 318], c2: [300, 318], to: [384, 320], begin: 0.7 },
  { key: "whatsapp", label: "WhatsApp", from: [300, 528], c1: [380, 528], c2: [360, 430], to: [404, 386], begin: 1.4 },
  { key: "qr", label: "QR", from: [470, 64], c1: [470, 120], c2: [470, 150], to: [470, 232], begin: 2.1 },
];
const OUTPUTS = [
  { key: "sentiment", d: "M 548 268 C 600 230, 640 150, 700 140" },
  { key: "response", d: "M 548 372 C 600 420, 630 470, 680 478" },
];

const path = (s: Source) => `M ${s.from[0]} ${s.from[1]} C ${s.c1[0]} ${s.c1[1]}, ${s.c2[0]} ${s.c2[1]}, ${s.to[0]} ${s.to[1]}`;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** A connector with a travelling signal packet (SMIL, no React re-renders). */
export function SignalConnector({ d, begin = 0, dur = 2.8, color = "var(--cyan)", animate = true, id }: { d: string; begin?: number; dur?: number; color?: string; animate?: boolean; id?: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="1.2" />
      <path d={d} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 7">
        {animate && <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.2s" repeatCount="indefinite" />}
      </path>
      {animate && (
        <g>
          <circle r="7" fill={color} opacity="0.18" />
          <circle r="2.6" fill="#ffffff" />
          <animateMotion id={id} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.2 1" />
        </g>
      )}
    </g>
  );
}

function useStoryLoop(enabled: boolean) {
  const [stage, setStage] = React.useState(enabled ? 0 : 3);
  const [cycle, setCycle] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) {
      setStage(3);
      return;
    }
    const t = setInterval(() => {
      setStage((s) => {
        if (s === 3) setCycle((c) => c + 1);
        return (s + 1) % 4;
      });
    }, STAGE_MS);
    return () => clearInterval(t);
  }, [enabled]);
  return { stage, cycle };
}

function SourceChip({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-[color-mix(in_oklab,var(--card)_70%,transparent)] px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] backdrop-blur transition-colors duration-500",
        active ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] text-foreground" : "border-border-strong text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ReviewPanel({ active }: { active: boolean }) {
  return (
    <HolographicPanel tilt="left" label="Google review" status={active ? "Signal detected" : "Synced"} statusTone={active ? "signal" : "muted"} active={active} delay={0.1}>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular">4.8</span>
        <span className="flex gap-0.5 text-amber">
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-3 fill-current" />)}
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-foreground-soft">“Lovely dinner, though the wait was a little long on Saturday.”</p>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle-foreground">New customer feedback · Bandra</p>
    </HolographicPanel>
  );
}

function WhatsAppPanel({ active }: { active: boolean }) {
  return (
    <HolographicPanel tilt="left" label="WhatsApp signal" status={active ? "Response received" : "Delivered"} statusTone={active ? "mint" : "muted"} active={active} delay={0.2}>
      <div className="space-y-1.5">
        <div className="max-w-[90%] rounded-md rounded-tl-none border border-border bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] px-2 py-1.5 text-[11px] leading-snug text-foreground-soft">
          Hi Priya, how was your visit? Share honest feedback here →
        </div>
        <div className="ml-auto max-w-[70%] rounded-md rounded-tr-none border border-[color-mix(in_oklab,var(--mint)_30%,transparent)] bg-mint-soft px-2 py-1.5 text-[11px] leading-snug text-foreground">
          Loved it! Done ✓
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle-foreground">Request delivered · consent on file</p>
    </HolographicPanel>
  );
}

function SentimentPanel({ active, cycle, tilt }: { active: boolean; cycle: number; tilt?: "left" | "right" }) {
  return (
    <HolographicPanel tilt={tilt} label="Sentiment engine" status={active ? "Analysing" : "Resolved"} statusTone={active ? "signal" : "mint"} active={active} delay={0.3}>
      <SentimentVisualization key={cycle} positive={86} neutral={10} negative={4} />
      <div className="mt-2 flex flex-wrap gap-1">
        {["Food quality", "Wait time", "Staff"].map((t, i) => (
          <span key={t} className={cn("rounded-[4px] border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em]", i === 1 ? "border-[color-mix(in_oklab,var(--amber)_40%,transparent)] text-amber" : "border-border-strong text-muted-foreground")}>{t}</span>
        ))}
      </div>
    </HolographicPanel>
  );
}

function ResponsePanel({ stage, cycle, tilt }: { stage: number; cycle: number; tilt?: "left" | "right" }) {
  const reduce = useReducedMotion();
  const generating = stage === 2;
  const awaiting = stage === 3 || stage < 2;
  return (
    <HolographicPanel tilt={tilt} label="AI response" status={generating ? "Generating" : "Awaiting approval"} statusTone={generating ? "signal" : "amber"} active={stage >= 2} delay={0.4}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]">
        <dt className="text-subtle-foreground">Tone</dt><dd className="text-primary">Empathetic</dd>
        <dt className="text-subtle-foreground">Language</dt><dd className="text-foreground-soft">English</dd>
      </dl>
      <motion.p
        key={`${cycle}-${generating}`}
        initial={reduce || !generating ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 2.2, ease: "linear" }}
        className="mt-2 border-l border-[color-mix(in_oklab,var(--primary)_45%,transparent)] pl-2 text-[11.5px] leading-snug text-foreground"
      >
        Thank you, Priya! We’re glad you enjoyed dinner — and sorry about the wait. We’re adding weekend staff.
      </motion.p>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn("font-mono text-[9px] uppercase tracking-[0.14em]", awaiting ? "text-amber" : "text-primary")}>{awaiting ? "Needs human approval" : "Drafting…"}</span>
        <span className="rounded-[4px] border border-border-strong px-1.5 py-px font-mono text-[9px] text-muted-foreground">Edit · Publish</span>
      </div>
    </HolographicPanel>
  );
}

export function ReputationIntelligenceScene({
  variant = "hero",
  className,
  showStatus = true,
}: {
  variant?: "hero" | "auth" | "compact";
  className?: string;
  showStatus?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const animate = !reduce;
  const { stage, cycle } = useStoryLoop(animate && inView);
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  if (variant === "compact") {
    return (
      <div ref={ref} className={cn("relative", className)}>
        <ReputationIntelligenceCore detail="lite" pulseKey={animate ? cycle * 4 + stage : undefined} />
      </div>
    );
  }

  const coreBox = { left: CORE.x - 205, top: CORE.y - 205, size: 410 };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* ---------------------------------------------------- desktop / tablet stage */}
      <div className="relative hidden aspect-[1000/640] w-full md:block">
        <svg viewBox="0 0 1000 640" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {SOURCES.map((s) => (
            <SignalConnector key={s.key} d={path(s)} begin={s.begin} animate={animate} id={`${uid}${s.key}`} />
          ))}
          {OUTPUTS.map((o, i) => (
            <SignalConnector key={o.key} d={o.d} begin={1.2 + i * 1.4} dur={2.4} color={i === 0 ? "var(--mint)" : "var(--ice)"} animate={animate} />
          ))}
          {/* arrival flash on the core rim each time a packet lands */}
          {animate && (
            <circle cx={CORE.x} cy={CORE.y} r="76" fill="none" stroke="var(--cyan)" strokeWidth="1.5" opacity="0">
              <animate attributeName="opacity" values="0.8;0" dur="0.9s" begin={SOURCES.map((s) => `${uid}${s.key}.repeatEvent`).join(";")} />
              <animate attributeName="r" values="76;104" dur="0.9s" begin={SOURCES.map((s) => `${uid}${s.key}.repeatEvent`).join(";")} />
            </circle>
          )}
          {/* source node markers */}
          {SOURCES.map((s) => (
            <circle key={s.key} cx={s.from[0]} cy={s.from[1]} r="3" fill="var(--cyan)" opacity="0.8" />
          ))}
        </svg>

        <div className="absolute" style={{ left: pct(coreBox.left, 1000), top: pct(coreBox.top, 640), width: pct(coreBox.size, 1000) }}>
          <ReputationIntelligenceCore pulseKey={animate ? cycle * 4 + stage : undefined} />
        </div>

        {/* incoming signals */}
        <div className="absolute w-[30%]" style={{ left: 0, top: pct(24, 640) }}><ReviewPanel active={stage === 0} /></div>
        <div className="absolute w-[30%]" style={{ left: 0, top: pct(430, 640) }}><WhatsAppPanel active={stage === 0} /></div>
        <div className="absolute" style={{ left: pct(48, 1000), top: pct(304, 640) }}><SourceChip icon={<Mail className="size-3" />} label="Email" active={stage === 0} /></div>
        <div className="absolute -translate-x-1/2" style={{ left: pct(470, 1000), top: pct(36, 640) }}><SourceChip icon={<QrCode className="size-3" />} label="QR scan" active={stage === 0} /></div>

        {/* outputs */}
        <div className="absolute w-[30%]" style={{ left: pct(700, 1000), top: pct(70, 640) }}><SentimentPanel active={stage === 1} cycle={cycle} tilt="right" /></div>
        <div className="absolute w-[32%]" style={{ left: pct(680, 1000), top: pct(400, 640) }}><ResponsePanel stage={stage} cycle={cycle} tilt="right" /></div>

        <div className="absolute right-0 top-0 hidden lg:block">
          <TechnicalLabel tone="muted">Illustrative · sample data</TechnicalLabel>
        </div>
      </div>

      {/* ---------------------------------------------------- mobile composition */}
      <div className="md:hidden">
        <div className="relative mx-auto w-[78%] max-w-[300px]">
          <ReputationIntelligenceCore detail="lite" pulseKey={animate ? cycle * 4 + stage : undefined} />
          <div className="absolute inset-x-0 -bottom-1 flex justify-center gap-1.5">
            <SourceChip icon={<GoogleIcon className="size-3" />} label="Google" active={stage === 0} />
            <SourceChip icon={<WhatsAppIcon className="size-3" />} label="WA" active={stage === 0} />
            <SourceChip icon={<QrCode className="size-3" />} label="QR" active={stage === 0} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SentimentPanel active={stage === 1} cycle={cycle} />
          <ResponsePanel stage={stage} cycle={cycle} />
        </div>
        <p className="mt-2 text-center"><TechnicalLabel>Illustrative · sample data</TechnicalLabel></p>
      </div>

      {showStatus && (
        <div className={cn("mt-4 flex justify-center", variant === "auth" && "md:justify-start")}>
          <IntelligenceStatus active={stage} className="grid grid-cols-2 sm:flex sm:flex-wrap" />
        </div>
      )}
    </div>
  );
}
