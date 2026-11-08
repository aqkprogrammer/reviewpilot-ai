"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CircleAlert, Heart, Lightbulb, RefreshCw, TrendingDown, X } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Insight { id: string; kind: string; title: string; detail: string; severity: string; evidence_count: number; generated_by: string }

const KINDS = [
  { kind: "complaint", label: "Recurring complaints", icon: CircleAlert, tone: "bg-danger-soft text-danger-foreground", bar: "bg-danger" },
  { kind: "trend", label: "Trends", icon: TrendingDown, tone: "bg-warning-soft text-warning-foreground", bar: "bg-warning" },
  { kind: "praise", label: "What customers love", icon: Heart, tone: "bg-success-soft text-success-foreground", bar: "bg-success" },
  { kind: "recommendation", label: "Recommendations", icon: Lightbulb, tone: "bg-primary-soft text-primary-soft-foreground", bar: "bg-primary" },
];

export function InsightsPanel({ canRefresh }: { canRefresh: boolean }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
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

  if (q.isLoading) return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  if (q.error) return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];
  const source = items[0]?.generated_by;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted-foreground">
          {q.data?.generated_at ? <>Generated {formatDistanceToNow(new Date(q.data.generated_at), { addSuffix: true })} from the text of your last 90 days of reviews{source === "heuristic" ? " using the offline heuristic engine" : source === "openai" ? " using OpenAI" : ""}.</> : "Insights are derived from your actual review text — nothing is invented."}
        </p>
        {canRefresh && <Button variant="outline" size="sm" loading={refresh.isPending || polling} onClick={() => refresh.mutate()}><RefreshCw /> {polling ? "Analyzing…" : "Refresh insights"}</Button>}
      </div>
      {items.length === 0 ? (
        <Card><EmptyState icon={Lightbulb} title="No insights yet" description="Once you have a handful of reviews, ReviewPilot surfaces recurring complaints, praise and trends here." action={canRefresh && <Button onClick={() => refresh.mutate()}>Generate insights</Button>} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {KINDS.map((k) => {
            const group = items.filter((i) => i.kind === k.kind);
            if (!group.length) return null;
            const max = Math.max(...group.map((g) => g.evidence_count), 1);
            return (
              <Card key={k.kind} className="p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", k.tone)}><k.icon className="size-4" /></span>
                  <h3 className="text-[14px] font-semibold">{k.label}</h3>
                  <Badge size="sm" className="ml-auto">{group.length}</Badge>
                </div>
                <ul className="space-y-3">
                  {group.map((i) => (
                    <li key={i.id} className="group relative rounded-xl border border-border p-3.5 transition hover:border-border-strong">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px] font-medium leading-snug">{i.title}</p>
                        {canRefresh && (
                          <Tooltip content="Dismiss">
                            <button onClick={() => dismiss.mutate(i.id)} className="rounded p-0.5 text-subtle-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus:opacity-100" aria-label="Dismiss insight"><X className="size-3.5" /></button>
                          </Tooltip>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                      {i.evidence_count > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", k.bar)} style={{ width: `${(i.evidence_count / max) * 100}%` }} /></div>
                          <span className="text-[11px] text-subtle-foreground tabular">{i.evidence_count} reviews</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
