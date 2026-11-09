"use client";
/**
 * ReputationIntelligenceCore — ReviewPilot's signature visual.
 *
 * A single SVG (no DOM particles): a shaded energy sphere whose meridians sweep to suggest
 * rotation, a drifting surface texture, concentric orbital rings turning at different speeds,
 * a 120-tick radial ring, a rotating scan beam, tilted orbits with travelling particles,
 * outward energy waves, and a breathing central glow. `pulseKey` changes trigger a response
 * pulse (used when a signal reaches the core).
 *
 * Performance: rotations are CSS transforms on <g>; travelling elements use SMIL
 * (compositor-friendly, no React re-renders). Reduced motion renders a still frame.
 */
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Detail = "full" | "lite";

function spin(seconds: number, reverse = false): React.CSSProperties {
  return {
    transformBox: "view-box",
    transformOrigin: "0 0",
    animation: `${reverse ? "rp-rotate-rev" : "rp-rotate"} ${seconds}s linear infinite`,
  };
}

/** Round to 2 decimals so server and client render identical SVG attributes. */
const r2d = (n: number) => Math.round(n * 100) / 100;

const ELLIPSE = (rx: number, ry: number) => `M ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0`;

export function ReputationIntelligenceCore({
  className,
  detail = "full",
  pulseKey,
  centerValue,
  centerLabel,
  title = "ReviewPilot reputation intelligence core",
}: {
  className?: string;
  detail?: Detail;
  pulseKey?: number | string;
  centerValue?: React.ReactNode;
  centerLabel?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const animate = !reduce;
  const full = detail === "full";

  const ticks = React.useMemo(() => {
    const n = full ? 120 : 60;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const major = i % (n / 12) === 0;
      const r1 = 140;
      const r2 = major ? 152 : 146;
      return { x1: r2d(Math.cos(a) * r1), y1: r2d(Math.sin(a) * r1), x2: r2d(Math.cos(a) * r2), y2: r2d(Math.sin(a) * r2), major };
    });
  }, [full]);

  const latitudes = [-58, -36, -12, 12, 36, 58];
  const meridians = full ? 6 : 3;

  return (
    <div className={cn("relative aspect-square w-full", className)}>
      <svg viewBox="-200 -200 400 400" className="absolute inset-0 size-full overflow-visible" role="img" aria-label={title}>
        <defs>
          <radialGradient id={id("sphere")} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#eafeff" stopOpacity="0.95" />
            <stop offset="16%" stopColor="var(--cyan)" stopOpacity="0.85" />
            <stop offset="42%" stopColor="#0f6f7c" stopOpacity="0.9" />
            <stop offset="72%" stopColor="#072630" />
            <stop offset="100%" stopColor="#02080b" />
          </radialGradient>
          <radialGradient id={id("glow")}>
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.55" />
            <stop offset="45%" stopColor="var(--cyan)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("heart")}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor="var(--cyan)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("spec")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.95" />
            <stop offset="55%" stopColor="var(--ice)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.6" />
          </linearGradient>
          <clipPath id={id("clip")}>
            <circle r="74" />
          </clipPath>
          <pattern id={id("surface")} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.9" fill="var(--cyan)" opacity="0.55" />
            <circle cx="10" cy="9" r="0.6" fill="var(--ice)" opacity="0.4" />
            {animate && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="28 0" dur="6s" repeatCount="indefinite" />}
          </pattern>
          <path id={id("orbitA")} d={ELLIPSE(182, 54)} transform="rotate(-18)" />
          <path id={id("orbitB")} d={ELLIPSE(170, 44)} transform="rotate(26)" />
        </defs>

        {/* ambient volumetric light */}
        <circle r="196" fill={`url(#${id("glow")})`} opacity="0.55" style={animate ? { animation: "rp-breathe 6s ease-in-out infinite" } : undefined} />

        {/* outward energy waves */}
        {animate &&
          [0, 1.6, 3.2].map((b) => (
            <circle key={b} r="78" fill="none" stroke="var(--cyan)" strokeWidth="0.8" opacity="0">
              <animate attributeName="r" values="78;188" dur="4.8s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0" dur="4.8s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}

        {/* outer dotted orbit */}
        <g style={animate ? spin(140) : undefined}>
          <circle r="172" fill="none" stroke="var(--foreground)" strokeOpacity="0.16" strokeWidth="0.8" strokeDasharray="1 5" />
          <circle cx="172" r="2.2" fill="var(--ice)" />
        </g>

        {/* radial ticks */}
        <g style={animate ? spin(110, true) : undefined}>
          {ticks.map(({ major, ...t }, i) => (
            <line key={i} {...t} stroke={major ? "var(--cyan)" : "var(--foreground)"} strokeOpacity={major ? 0.85 : 0.22} strokeWidth={major ? 1.2 : 0.6} />
          ))}
        </g>

        {/* segmented arc ring */}
        <g style={animate ? spin(26) : undefined}>
          <circle r="124" fill="none" stroke="var(--cyan)" strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="70 18 10 18 150 40 22 18" strokeLinecap="round" />
          <circle r="130" fill="none" stroke="var(--ice)" strokeOpacity="0.25" strokeWidth="0.6" />
        </g>

        {/* inner fine ring */}
        {full && (
          <g style={animate ? spin(48, true) : undefined}>
            <circle r="102" fill="none" stroke="var(--ice)" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="1.5 4" />
            <path d="M 0 -102 A 102 102 0 0 1 72 -72" fill="none" stroke="var(--mint)" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}

        {/* scanning beam */}
        <g style={animate ? spin(7.5) : { transform: "rotate(-35deg)" }}>
          <path d="M0 0 L 165 -29 A 168 168 0 0 1 165 29 Z" fill={`url(#${id("beam")})`} />
          <line x1="0" y1="0" x2="168" y2="0" stroke="var(--cyan)" strokeOpacity="0.55" strokeWidth="0.8" />
        </g>

        {/* tilted orbital paths + particles */}
        <use href={`#${id("orbitA")}`} fill="none" stroke="var(--cyan)" strokeOpacity="0.22" strokeWidth="0.8" />
        {full && <use href={`#${id("orbitB")}`} fill="none" stroke="var(--ice)" strokeOpacity="0.18" strokeWidth="0.8" />}
        {animate && (
          <>
            <circle r="3" fill="var(--cyan)" style={{ filter: "drop-shadow(0 0 4px var(--cyan))" }}>
              <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
                <mpath href={`#${id("orbitA")}`} />
              </animateMotion>
            </circle>
            {full && (
              <>
                <circle r="2.2" fill="var(--mint)" style={{ filter: "drop-shadow(0 0 4px var(--mint))" }}>
                  <animateMotion dur="13s" begin="-4s" repeatCount="indefinite">
                    <mpath href={`#${id("orbitB")}`} />
                  </animateMotion>
                </circle>
                <circle r="1.8" fill="var(--ice)">
                  <animateMotion dur="9s" begin="-4.5s" repeatCount="indefinite">
                    <mpath href={`#${id("orbitA")}`} />
                  </animateMotion>
                </circle>
              </>
            )}
          </>
        )}

        {/* the sphere */}
        <circle r="84" fill="none" stroke="var(--cyan)" strokeOpacity="0.18" strokeWidth="6" />
        <circle r="74" fill={`url(#${id("sphere")})`} />
        <g clipPath={`url(#${id("clip")})`}>
          <rect x="-74" y="-74" width="148" height="148" fill={`url(#${id("surface")})`} opacity="0.55" />
          {latitudes.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const rx = r2d(74 * Math.cos(rad));
            return <ellipse key={deg} cy={r2d(74 * Math.sin(rad))} rx={rx} ry={r2d(rx * 0.2)} fill="none" stroke="var(--cyan)" strokeOpacity="0.28" strokeWidth="0.6" />;
          })}
          {Array.from({ length: meridians }, (_, i) => {
            const phase = (i / meridians) * 10;
            const rx = r2d(Math.abs(Math.cos((i / meridians) * Math.PI)) * 74);
            return (
              <ellipse key={i} rx={rx} ry="74" fill="none" stroke="var(--cyan)" strokeOpacity="0.3" strokeWidth="0.6">
                {animate && full && <animate attributeName="rx" values="74;0;74" dur="10s" begin={`-${phase}s`} repeatCount="indefinite" />}
              </ellipse>
            );
          })}
          <ellipse cx="-24" cy="-30" rx="30" ry="20" fill={`url(#${id("spec")})`} />
        </g>
        <circle r="74" fill="none" stroke={`url(#${id("rim")})`} strokeWidth="1.3" />

        {/* breathing heart */}
        <circle cx="-10" cy="-12" r="26" opacity="0.7" fill={`url(#${id("heart")})`} style={animate ? { animation: "rp-breathe 3.2s ease-in-out infinite" } : undefined} />

        {/* signal arrival response */}
        <AnimatePresence>
          {pulseKey !== undefined && animate && (
            <motion.circle
              key={String(pulseKey)}
              r={74}
              fill="none"
              stroke="var(--cyan)"
              strokeWidth={1.6}
              initial={{ opacity: 0.85, scale: 1 }}
              animate={{ opacity: 0, scale: 1.55 }}
              transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformBox: "view-box", transformOrigin: "0 0" }}
            />
          )}
        </AnimatePresence>
      </svg>

      {(centerValue != null || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue != null && <span className="text-[clamp(18px,7%,34px)] font-semibold leading-none tracking-[-0.03em] text-white drop-shadow-[0_0_12px_rgb(0_0_0/0.8)] tabular">{centerValue}</span>}
          {centerLabel && <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#d6fbfc] drop-shadow-[0_0_8px_rgb(0_0_0/0.9)]">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
