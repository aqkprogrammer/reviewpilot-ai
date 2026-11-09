"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Isometric "data city": a floor grid of dim blocks with a few luminous cyan cubes — one per
 * highlighted segment. Pure SVG, painter-sorted, no images.
 */

const TW = 64; // tile width
const TH = 32; // tile height
const UNIT = 22; // height per level
const N = 6;
const OX = 260;
const OY = 92;

const pt = (i: number, j: number) => ({ x: OX + ((i - j) * TW) / 2, y: OY + ((i + j) * TH) / 2 });

export interface IsoMarker {
  key: string;
  label: string;
  code: string;
}

type Cube = { i: number; j: number; h: number; marker?: number };

const GLOW_CELLS: Array<[number, number, number]> = [
  [1, 1, 2],
  [4, 1, 3],
  [1, 4, 2],
  [4, 4, 1],
];
const DIM: Array<[number, number, number]> = [
  [0, 2, 1],
  [2, 0, 1],
  [3, 0, 2],
  [2, 2, 1],
  [3, 3, 2],
  [0, 4, 1],
  [5, 2, 1],
  [2, 5, 1],
  [5, 5, 2],
  [3, 5, 1],
  [0, 0, 1],
  [5, 0, 1],
];

function faces(c: Cube) {
  const { x, y } = pt(c.i + 0.5, c.j + 0.5);
  const H = c.h * UNIT;
  const top = y - H;
  const t = `${x},${top - TH / 2} ${x + TW / 2},${top} ${x},${top + TH / 2} ${x - TW / 2},${top}`;
  const l = `${x - TW / 2},${top} ${x},${top + TH / 2} ${x},${y + TH / 2} ${x - TW / 2},${y}`;
  const r = `${x},${top + TH / 2} ${x + TW / 2},${top} ${x + TW / 2},${y} ${x},${y + TH / 2}`;
  return { t, l, r, x, top };
}

export function IsoCubes({ markers, active, className }: { markers: IsoMarker[]; active: number; className?: string }) {
  const reduce = useReducedMotion();
  const cubes: Cube[] = [
    ...DIM.map(([i, j, h]) => ({ i, j, h })),
    ...GLOW_CELLS.slice(0, markers.length).map(([i, j, h], m) => ({ i, j, h, marker: m })),
  ].sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);

  return (
    <svg viewBox="0 0 520 400" className={cn("h-auto w-full", className)} role="img" aria-label="Illustration: isometric grid of locations with highlighted industries">
      <defs>
        <linearGradient id="iso-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--cyan) 35%, white)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
        <linearGradient id="iso-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--cyan) 72%, black)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--cyan) 28%, var(--background))" />
        </linearGradient>
        <linearGradient id="iso-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--cyan) 55%, black)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--cyan) 18%, var(--background))" />
        </linearGradient>
        <linearGradient id="iso-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="iso-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* floor */}
      <ellipse cx={OX} cy={OY + (N * TH) / 2} rx="250" ry="120" fill="url(#iso-floor)" />
      <g stroke="var(--border-strong)" strokeWidth="0.8">
        {Array.from({ length: N + 1 }, (_, k) => {
          const a = pt(k, 0);
          const b = pt(k, N);
          const c = pt(0, k);
          const d = pt(N, k);
          return (
            <g key={k}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
            </g>
          );
        })}
      </g>

      {cubes.map((c) => {
        const f = faces(c);
        const isMarker = c.marker !== undefined;
        const on = isMarker && c.marker === active;
        if (!isMarker) {
          return (
            <g key={`${c.i}-${c.j}`} strokeWidth="0.8" strokeLinejoin="round">
              <polygon points={f.l} fill="var(--background-subtle)" stroke="var(--border-strong)" />
              <polygon points={f.r} fill="var(--background)" stroke="var(--border-strong)" />
              <polygon points={f.t} fill="var(--card)" stroke="color-mix(in oklab, var(--foreground) 22%, transparent)" />
            </g>
          );
        }
        return (
          <motion.g
            key={`${c.i}-${c.j}`}
            initial={false}
            animate={{ opacity: on ? 1 : 0.55 }}
            transition={{ duration: reduce ? 0 : 0.35 }}
            style={{ filter: on ? "drop-shadow(0 0 14px rgb(82 227 232 / 0.55))" : "drop-shadow(0 0 6px rgb(82 227 232 / 0.25))" }}
            strokeLinejoin="round"
          >
            <polygon points={f.l} fill="url(#iso-left)" stroke="color-mix(in oklab, var(--cyan) 70%, white)" strokeOpacity="0.5" strokeWidth="0.8" />
            <polygon points={f.r} fill="url(#iso-right)" stroke="color-mix(in oklab, var(--cyan) 70%, white)" strokeOpacity="0.5" strokeWidth="0.8" />
            <polygon points={f.t} fill="url(#iso-top)" stroke="color-mix(in oklab, var(--cyan) 15%, white)" strokeOpacity="0.8" strokeWidth="0.8" />
            {on && <rect x={f.x - 1} y={f.top - 120} width="2" height="104" fill="url(#iso-beam)" />}
          </motion.g>
        );
      })}

      {/* callouts */}
      {cubes
        .filter((c) => c.marker !== undefined)
        .map((c) => {
          const f = faces(c);
          const m = markers[c.marker!];
          const on = c.marker === active;
          const right = c.i >= c.j;
          const lx = f.x + (right ? 46 : -46);
          const ly = f.top - 34;
          return (
            <g key={`lbl-${m.key}`} opacity={on ? 1 : 0.5} style={{ transition: "opacity 300ms" }}>
              <polyline points={`${f.x},${f.top - 18} ${f.x + (right ? 14 : -14)},${ly} ${lx},${ly}`} fill="none" stroke={on ? "var(--cyan)" : "var(--border-strong)"} strokeWidth="0.8" />
              <circle cx={f.x} cy={f.top - 18} r="1.8" fill={on ? "var(--cyan)" : "var(--subtle-foreground)"} />
              <text
                x={lx + (right ? 4 : -4)}
                y={ly - 5}
                textAnchor={right ? "start" : "end"}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em" }}
                fill="var(--subtle-foreground)"
              >
                {m.code}
              </text>
              <text
                x={lx + (right ? 4 : -4)}
                y={ly + 9}
                textAnchor={right ? "start" : "end"}
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}
                fill={on ? "var(--foreground)" : "var(--muted-foreground)"}
              >
                {m.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
