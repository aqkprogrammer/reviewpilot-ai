import * as React from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden {...props} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-6 py-10" : "px-6 py-16", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-primary-soft opacity-60 blur-xl" aria-hidden />
        <div className="relative flex size-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Icon className="size-5 text-primary" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)} role="alert">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger-foreground">
        <AlertCircle className="size-5" />
      </div>
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
  variant = "info",
  title,
  children,
  icon: Icon,
  className,
  action,
}: {
  variant?: "info" | "warning" | "danger" | "success" | "primary";
  title?: string;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  action?: React.ReactNode;
}) {
  const styles = {
    info: "border-blue/20 bg-blue-soft/60 text-foreground [&_.ia-icon]:text-blue",
    primary: "border-primary/20 bg-primary-soft/60 [&_.ia-icon]:text-primary",
    warning: "border-warning/25 bg-warning-soft [&_.ia-icon]:text-warning-foreground",
    danger: "border-danger/25 bg-danger-soft [&_.ia-icon]:text-danger-foreground",
    success: "border-success/25 bg-success-soft [&_.ia-icon]:text-success-foreground",
  }[variant];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", styles, className)} role={variant === "danger" ? "alert" : undefined}>
      {Icon && <Icon className="ia-icon mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {children && <div className="text-foreground-soft">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
