"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert, Heart, Lightbulb, RefreshCw, TrendingDown, X } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { MeterBar, type MeterTone, ReadoutStrip } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Reveal } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Insight { id: string; kind: string; title: string; detail: string; severity: string; evidence_count: number; generated_by: string }

const KINDS: { kind: string; label: string; code: string; icon: React.ComponentType<{ className?: string }>; tone: string; bar: MeterTone }[] = [
  { kind: "complaint", label: "Recurring complaints", code: "CMP", icon: CircleAlert, tone: "text-danger-foreground", bar: "danger" },
  { kind: "trend", label: "Trends", code: "TRD", icon: TrendingDown, tone: "text-warning-foreground", bar: "warning" },
  { kind: "praise", label: "What customers love", code: "PRS", icon: Heart, tone: "text-success-foreground", bar: "success" },
  { kind: "recommendation", label: "Recommendations", code: "REC", icon: Lightbulb, tone: "text-primary", bar: "primary" },
];

/** Severity as stored by the insight engine (critical · warning · positive · info). */
const SEVERITY: Record<string, { label: string; level: number; cls: string }> = {
  critical: { label: "Critical", level: 4, cls: "text-danger-foreground" },
  high: { label: "High", level: 3, cls: "text-danger-foreground" },
  warning: { label: "Warning", level: 3, cls: "text-warning-foreground" },
  medium: { label: "Medium", level: 2, cls: "text-warning-foreground" },
  positive: { label: "Positive", level: 2, cls: "text-success-foreground" },
  low: { label: "Low", level: 1, cls: "text-muted-foreground" },
  info: { label: "Info", level: 1, cls: "text-muted-foreground" },
};

/** Four-step severity readout: ▮▮▯▯ HIGH */
function SeverityReadout({ severity }: { severity: string }) {
  const s = SEVERITY[severity] ?? { label: severity, level: 1, cls: "text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em]", s.cls)} aria-label={`Severity ${s.label}`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((n) => <span key={n} className={cn("w-[3px] rounded-[1px]", n <= s.level ? "bg-current" : "bg-border-strong")} style={{ height: 4 + n * 2 }} />)}
      </span>
      {s.label}
    </span>
  );
}

export function InsightsPanel({ canRefresh }: { canRefresh: boolean }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const [polling, setPolling] = React.useState(false);
  const q = useQuery({
    queryKey: ["ai", "insights", orgId],
    queryFn: () => api.get<{ generated_at: string | null; items: Insight[] }>("/ai/insights"),
    refetchInterval: polling ? 2000 : false,
  });
  const startedAt = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (polling && q.data?.generated_at && q.data.generated_at !== startedAt.current) {
      setPolling(false);
      toast.success("Insights refreshed from your latest reviews");
    }
  }, [q.data?.generated_at, polling]);
  React.useEffect(() => { if (!polling) return; const t = setTimeout(() => setPolling(false), 30000); return () => clearTimeout(t); }, [polling]);

  const refresh = useMutation({
    mutationFn: () => api.post("/ai/insights/refresh"),
    onSuccess: () => { startedAt.current = q.data?.generated_at ?? null; setPolling(true); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => api.post(`/ai/insights/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "insights"] }),
  });

  if (q.isLoading) return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>;
  if (q.error) return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];
  const source = items[0]?.generated_by;
  const high = items.filter((i) => (SEVERITY[i.severity]?.level ?? 0) >= 3).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {q.data?.generated_at ? <>Generated {formatDistanceToNow(new Date(q.data.generated_at), { addSuffix: true })} from the text of your last 90 days of reviews{source === "heuristic" ? " using the offline heuristic engine" : source === "openai" ? " using OpenAI" : ""}. Nothing is invented — each insight cites how many reviews support it.</> : "Insights are derived from your actual review text — nothing is invented."}
        </p>
        {canRefresh && <Button variant="outline" size="sm" loading={refresh.isPending || polling} onClick={() => refresh.mutate()}><RefreshCw /> {polling ? "Analyzing…" : "Refresh insights"}</Button>}
      </div>
      {items.length > 0 && (
        <ReadoutStrip
          items={[
            { label: "Active insights", value: items.length, tone: "signal" },
            { label: "Warnings", value: high, tone: high ? "warn" : "muted", hint: "Insights flagged warning or above" },
            { label: "Generated", value: q.data?.generated_at ? formatDistanceToNow(new Date(q.data.generated_at), { addSuffix: true }) : "—", tone: "muted" },
            { label: "Engine", value: source === "openai" ? "OpenAI" : source === "heuristic" ? "Heuristic" : "—", tone: "muted" },
          ]}
        />
      )}
      {items.length === 0 ? (
        <Card><EmptyState icon={Lightbulb} title="No insights yet" description="Once you have a handful of reviews, ReviewPilot surfaces recurring complaints, praise and trends here." action={canRefresh && <Button onClick={() => refresh.mutate()}>Generate insights</Button>} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {KINDS.map((k, ki) => {
            const group = items.filter((i) => i.kind === k.kind).sort((a, b) => (SEVERITY[b.severity]?.level ?? 0) - (SEVERITY[a.severity]?.level ?? 0) || b.evidence_count - a.evidence_count);
            if (!group.length) return null;
            const max = Math.max(...group.map((g) => g.evidence_count), 1);
            return (
              <Reveal key={k.kind} delay={ki * 0.04} className="min-w-0">
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
                    <k.icon className={cn("size-4", k.tone)} />
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{k.label}</h3>
                    <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{k.code} · {String(group.length).padStart(2, "0")}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {group.map((i) => (
                        <motion.li key={i.id} layout={!reduce} exit={reduce ? undefined : { opacity: 0, x: 12 }} className="group relative px-5 py-4 transition-colors hover:bg-surface-hover/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <SeverityReadout severity={i.severity} />
                              <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-foreground">{i.title}</p>
                            </div>
                            {canRefresh && (
                              <Tooltip content="Dismiss">
                                <button onClick={() => dismiss.mutate(i.id)} className="rounded p-1 text-subtle-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100 max-md:opacity-100" aria-label="Dismiss insight"><X className="size-3.5" /></button>
                              </Tooltip>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                          {i.evidence_count > 0 && (
                            <div className="mt-3 flex items-center gap-3">
                              <MeterBar value={i.evidence_count} max={max} tone={k.bar} className="flex-1" />
                              <span className="shrink-0 font-mono text-[10.5px] tabular text-subtle-foreground">{i.evidence_count} reviews</span>
                            </div>
                          )}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </Card>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
