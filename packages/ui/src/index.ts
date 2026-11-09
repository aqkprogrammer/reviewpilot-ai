/** Design tokens exposed to TypeScript (charts, canvas, inline styles). Mirrors tokens.css. */
export const chartColors = {
  cyan: "var(--chart-1)",
  ice: "var(--chart-2)",
  mint: "var(--chart-3)",
  amber: "var(--chart-4)",
  steel: "var(--chart-5)",
  grid: "var(--chart-grid)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

export const ratingColors: Record<number, string> = {
  5: "var(--success)",
  4: "var(--chart-2)",
  3: "var(--warning)",
  2: "color-mix(in oklab, var(--warning) 50%, var(--danger))",
  1: "var(--danger)",
};

export const motion = {
  ease: [0.22, 1, 0.36, 1] as const,
  fast: 0.12,
  base: 0.2,
  slow: 0.36,
};
