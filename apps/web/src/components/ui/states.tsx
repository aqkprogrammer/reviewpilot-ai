import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden {...props} />;
}

export function EmptyState({
  icon: Icon, title, description, action, className, compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center overflow-hidden text-center", compact ? "px-6 py-10" : "px-6 py-16", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-70 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_45%,#000_20%,transparent_75%)]" />
      <div className="tech-corners relative mb-5 flex size-12 items-center justify-center rounded-lg border border-border-strong bg-card-elevated">
        <Icon className="size-5 text-primary" />
      </div>
      <h3 className="relative text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)} role="alert">
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger-foreground">
        <AlertTriangle className="size-5" />
      </div>
      <p className="micro-label mb-1.5 !text-danger-foreground">Error</p>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function InlineAlert({
  variant = "info", title, children, icon: Icon, className, action,
}: {
  variant?: "info" | "warning" | "danger" | "success" | "primary";
  title?: string;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  action?: React.ReactNode;
}) {
  const styles = {
    info: "border-[color-mix(in_oklab,var(--ice)_25%,transparent)] bg-ice-soft [&_.ia-icon]:text-ice before:bg-ice",
    primary: "border-[color-mix(in_oklab,var(--primary)_25%,transparent)] bg-primary-soft [&_.ia-icon]:text-primary before:bg-primary",
    warning: "border-[color-mix(in_oklab,var(--warning)_28%,transparent)] bg-warning-soft [&_.ia-icon]:text-warning-foreground before:bg-warning",
    danger: "border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft [&_.ia-icon]:text-danger-foreground before:bg-danger",
    success: "border-[color-mix(in_oklab,var(--success)_26%,transparent)] bg-success-soft [&_.ia-icon]:text-success-foreground before:bg-success",
  }[variant];
  return (
    <div
      className={cn("relative flex items-start gap-3 overflow-hidden rounded-lg border py-3 pl-4 pr-4 before:absolute before:inset-y-0 before:left-0 before:w-[2px]", styles, className)}
      role={variant === "danger" ? "alert" : undefined}
    >
      {Icon && <Icon className="ia-icon mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {children && <div className="text-foreground-soft">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
