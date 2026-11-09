import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      neutral: "border-border bg-muted text-foreground-soft",
      primary: "border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft text-primary-soft-foreground",
      success: "border-[color-mix(in_oklab,var(--success)_26%,transparent)] bg-success-soft text-success-foreground",
      warning: "border-[color-mix(in_oklab,var(--warning)_28%,transparent)] bg-warning-soft text-warning-foreground",
      danger: "border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft text-danger-foreground",
      info: "border-[color-mix(in_oklab,var(--ice)_26%,transparent)] bg-ice-soft text-ice",
      mint: "border-[color-mix(in_oklab,var(--mint)_26%,transparent)] bg-mint-soft text-mint",
      amber: "border-[color-mix(in_oklab,var(--amber)_28%,transparent)] bg-amber-soft text-amber",
      outline: "border-border-strong text-foreground-soft",
    },
    size: { sm: "h-5 px-1.5 text-[10.5px]", md: "h-6 px-2 text-[11.5px]" },
    mono: { true: "font-mono uppercase tracking-[0.08em]", false: "" },
  },
  defaultVariants: { variant: "neutral", size: "md", mono: false },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, mono, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, mono }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" aria-hidden />}
      {children}
    </span>
  );
}

export { badgeVariants };
