/** Design tokens exposed to TypeScript (charts, canvas, inline styles). */
export const chartColors = {
  primary: "var(--chart-1)",
  blue: "var(--chart-2)",
  purple: "var(--chart-3)",
  cyan: "var(--chart-4)",
  amber: "var(--chart-5)",
  grid: "var(--chart-grid)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

export const ratingColors: Record<number, string> = {
  5: "var(--success)",
  4: "var(--chart-2)",
  3: "var(--warning)",
  2: "#fb923c",
  1: "var(--danger)",
};

export const motion = {
  ease: [0.22, 1, 0.36, 1] as const,
  fast: 0.12,
  base: 0.2,
  slow: 0.36,
};
