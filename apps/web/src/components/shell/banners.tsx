"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Info, X } from "lucide-react";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ShellBanners() {
  const { me, membership, orgId } = useOrg();
  const org = membership.organization;
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("rp_dismissed_ann") || "[]"));
    } catch {}
  }, []);
  const ann = useQuery({
    queryKey: ["announcements", orgId],
    queryFn: () => api.get<{ id: string; title: string; body: string; level: string; dismissible: boolean }[]>("/announcements/active", { organization_id: orgId }, { orgId: null }),
    staleTime: 300_000,
  });
  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem("rp_dismissed_ann", JSON.stringify(next));
    } catch {}
  };
  const status = org.subscription_status;
  return (
    <div className="space-y-px">
      {(me.demo_mode || org.is_demo) && (
        <div className="flex items-center justify-center gap-2.5 border-b border-[color-mix(in_oklab,var(--amber)_22%,transparent)] bg-[color-mix(in_oklab,var(--amber)_7%,var(--background))] px-4 py-1.5 text-center text-[12px] text-foreground-soft">
          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[color-mix(in_oklab,var(--amber)_40%,transparent)] px-1.5 font-mono text-[10px] tracking-[0.12em] text-amber"><FlaskConical className="size-3" />DEMO</span>
          {org.is_demo ? "Demo organization — reviews, customers and payments shown are sample data, not real records." : "Demo mode — integrations without credentials are simulated and clearly labelled."}
        </div>
      )}
      {(status === "grace_period" || status === "past_due") && (
        <Bar tone="danger" icon={AlertTriangle}>Your last payment failed. Update billing to avoid interruption. <Link href="/app/subscription" className="font-semibold underline">Fix billing</Link></Bar>
      )}
      {(status === "expired" || status === "canceled") && (
        <Bar tone="warning" icon={AlertTriangle}>Your subscription is inactive — campaigns and AI are paused. <Link href="/app/subscription" className="font-semibold underline">Choose a plan</Link></Bar>
      )}
      {!me.user.email_verified && (
        <Bar tone="info" icon={Info}>Please verify your email address. <Link href="/app/settings?tab=profile" className="font-semibold underline">Resend verification</Link></Bar>
      )}
      {ann.data?.filter((a) => !dismissed.includes(a.id)).map((a) => (
        <Bar key={a.id} tone={a.level === "critical" ? "danger" : a.level === "warning" ? "warning" : "info"} icon={a.level === "info" ? Info : AlertTriangle} onDismiss={a.dismissible ? () => dismiss(a.id) : undefined}>
          <span className="font-semibold">{a.title}</span> — {a.body}
        </Bar>
      ))}
    </div>
  );
}

function Bar({ tone, icon: Icon, children, onDismiss }: { tone: "danger" | "warning" | "info"; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div className={cn("flex items-center gap-2.5 border-b px-4 py-2 text-[12.5px] sm:px-6", tone === "danger" && "border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-danger-soft text-danger-foreground", tone === "warning" && "border-[color-mix(in_oklab,var(--warning)_25%,transparent)] bg-warning-soft text-warning-foreground", tone === "info" && "border-[color-mix(in_oklab,var(--ice)_22%,transparent)] bg-ice-soft text-ice")}>
      <Icon className="size-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onDismiss && <button onClick={onDismiss} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss"><X className="size-3.5" /></button>}
    </div>
  );
}
