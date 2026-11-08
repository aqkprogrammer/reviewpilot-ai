import * as React from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

export function IntegrationCard({ icon, name, tagline, status, children, footer, className }: { icon: React.ReactNode; name: string; tagline: string; status: string; children?: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm [&_svg]:size-6">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-semibold tracking-tight">{name}</h3><StatusBadge status={status} /></div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{tagline}</p>
        </div>
      </div>
      {children && <div className="flex-1 space-y-4 border-t border-border px-5 py-4">{children}</div>}
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background-subtle px-5 py-3">{footer}</div>}
    </Card>
  );
}

export function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right text-foreground", mono && "font-mono text-xs")}>{value ?? "—"}</span>
    </div>
  );
}
