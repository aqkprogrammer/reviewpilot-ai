import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * "Secure access terminal" field: a hairline rail on the left that lights up in cyan while any
 * control inside has focus (CSS only — transform/opacity, no JS), plus an optional mono index.
 */
export function TerminalField({ index, children, className }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "group/tf relative pl-4",
        "before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border-strong",
        "after:absolute after:inset-y-0 after:left-0 after:w-px after:origin-top after:scale-y-0 after:bg-primary after:opacity-0 after:shadow-[0_0_8px_var(--primary)] after:transition-[transform,opacity] after:duration-300 after:ease-out focus-within:after:scale-y-100 focus-within:after:opacity-100",
        className,
      )}
    >
      {index && (
        <span aria-hidden className="absolute -left-[3px] top-0 flex h-[13px] items-center bg-background font-mono text-[8.5px] leading-none text-subtle-foreground transition-colors group-focus-within/tf:text-primary">
          <span className="size-[7px] rounded-[2px] border border-current bg-background" />
        </span>
      )}
      {children}
    </div>
  );
}

/** Framed panel with a mono status strip, used to give auth forms an instrument feel. */
export function TerminalPanel({ label, status, children, className }: { label: React.ReactNode; status?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("tech-corners relative rounded-xl border border-border-strong bg-card/60 shadow-lg backdrop-blur-sm hairline-top", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">
        <span className="truncate">{label}</span>
        {status}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
