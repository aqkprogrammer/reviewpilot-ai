# ReviewPilot "Instrument" Design System

A dark, precise, near-future interface language: the product should feel like a professional
instrument panel — graphite surfaces, hairline borders, monospace metadata, and a restrained
cyan signal that lights up only what matters.

## Non-negotiables

- **No purple, violet or lavender anywhere** — not in tokens, gradients, glows, charts, emails or PDFs.
  Accents are **cyan `#52E3E8`, ice blue `#83BFFF`, mint `#8CF0C5`, warm amber `#E8B66D`** — used sparingly.
- **Glow is earned**: only primary CTAs, active/selected states, live indicators and the single most
  important element of a view. Never on every card.
- **No fabricated data.** Every number comes from the API, or is visibly labelled demo/sample.
  Decorative "telemetry" in marketing visuals must be clearly illustrative (product mock-ups), never
  presented as real customer data.
- Avoid: giant gradient backgrounds, floating blobs, generic AI illustrations, heavy glassmorphism,
  rainbow gradients, emoji, repeated identical 3-card rows, oversized headings everywhere.
- Accessibility: visible focus (`:focus-visible` ring is cyan), labels, ARIA, keyboard support,
  `prefers-reduced-motion` respected (CSS + `useReducedMotion`).

## Themes & tokens (`packages/ui/src/tokens.css`)

| Context | Class | Notes |
|---|---|---|
| Default (marketing, auth, business app) | `.dark` on `<html>` | graphite `#080B0F` → cards `#101820`, signal = cyan |
| Daylight (optional, business app) | no class | light surfaces, teal `#0E9AA7` signal |
| Super Admin command center | `.admin-theme` | deeper graphite `#06090C`, signal = ice blue, amber for operations |

Marketing and auth must force dark by wrapping in `className="dark"` (tokens cascade).

Tailwind colour utilities (all token-driven): `background`, `background-subtle`, `card`, `card-elevated`,
`popover`, `surface-hover`, `foreground`, `foreground-soft`, `muted`, `muted-foreground`,
`subtle-foreground`, `border`, `border-strong`, `input`, `ring`, `primary` (+`-hover`, `-soft`,
`-soft-foreground`, `-foreground`), `cyan`, `ice`, `mint`, `amber` (each with `-soft`), `success`,
`warning`, `danger` (each with `-soft`, `-foreground`), `sidebar*`, `chart-1..5` via CSS vars.
Glow: `shadow-glow` / `.glow-signal`. Never hard-code hex colours in components — use tokens.

## Typography

- Geist Sans for UI/editorial, **Geist Mono for technical metadata** (`font-mono`).
- Editorial headings: tight tracking (`tracking-[-0.03em]` → `-0.045em` for hero), semibold, not
  oversized outside the marketing hero. App page titles: 24px.
- **Micro-labels**: `.micro-label` (mono, 10.5px, 0.14em tracking, uppercase, subtle colour) for
  metric labels, section eyebrows, table headers, readouts: `SYSTEM STATUS`, `LAST SYNC · 00:04:21`.
- Numbers: `tabular` class; large metric values 28px semibold `tracking-[-0.035em]`.

## Surfaces & detailing

- Radius: 10px base (`rounded-lg`), cards `rounded-xl`, badges `rounded-[5px]`. Not bubbly.
- `Card` already has a hairline top highlight and a faint vertical falloff. Add `card-hover` for
  interactive cards (border brightens, surface lifts subtly).
- Technical detailing (use with restraint): `.bg-tech-grid` / `.bg-tech-grid-fade` (fine 64px grid),
  `.bg-tech-grid-drift` (very slow drift), `.bg-radial-signal` (soft cyan light), `.bg-noise` (grain),
  `.tech-corners` (corner brackets), `.hairline-top`, coordinate-like labels (`N 19.07° · E 72.87°`
  only on marketing visuals), section indices (`01 / 04`).

## Components (`apps/web/src/components`)

- `ui/` — Button (`primary` cyan, `gradient` = hero signal CTA with sweep, `outline`, `soft`, `ghost`,
  `secondary`, `danger`, `danger-soft`, `link`), Input/Textarea, Select, Dialog, Sheet, ConfirmDialog,
  DropdownMenu, Tabs (`segmented` | `underline`), Table (mono headers), Badge (`mono` prop for status
  readouts; variants neutral/primary/success/warning/danger/info/mint/amber/outline), controls
  (Checkbox, Switch, Progress, Avatar, Tooltip, Popover), states (Skeleton, EmptyState, ErrorState,
  InlineAlert), Stars (amber), PageHeader (`eyebrow`), FormField.
- `ui/tech.tsx` — `MicroLabel`, `Readout`, `StatusDot` (tones live/ok/warn/error/idle/signal, `pulse`),
  `TechFrame`, `AnimatedNumber` (count-up), `Reveal` (in-view entrance), `PageTransition`,
  `GridBackdrop`, `Kbd`, `SegmentMeter`.
- `app/` — StatCard (mono label, accent hairline, delta chip), chart-kit (axis/grid/tooltip/legend,
  GradientDefs), PeriodFilter, Pagination, StatusBadge (mono readout).
- `shell/` — sidebar (shared-layout active indicator), topbar (org switcher, location filter,
  breadcrumbs, ⌘K palette, notifications), banners, route transitions.

## Motion (`motion/react` only)

- Durations 120–360ms, ease `[0.22, 1, 0.36, 1]`; springs for indicators (`stiffness 420, damping 36`).
- Patterns: route entrance (fade + 6px rise), `Reveal` for sections, `layoutId` indicators for nav/tabs,
  count-up metrics, chart entry (Recharts `isAnimationActive` default), hover = border/surface change,
  press = `active:scale-[0.985]` (built into Button).
- Only transform/opacity; no continuous animation except tiny live indicators and very slow
  background drift; never animate many elements at once; respect reduced motion.

## Charts

Recharts with `axisProps`/`gridProps`/`ChartTooltip` from `components/app/chart-kit`. Series colours:
`var(--chart-1)` cyan, `--chart-2` ice, `--chart-3` mint, `--chart-4` amber, `--chart-5` steel.
Area fills via `GradientDefs`; thin strokes (1.5–2px); dashed predictions/benchmarks.
