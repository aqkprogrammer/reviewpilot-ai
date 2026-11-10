"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, MapPin, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { ChannelIcon } from "@/components/campaigns/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FlowChips } from "./flow";
import { RuleEditorDialog } from "./rule-editor";
import { type Rule, automationKeys } from "./types";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <dt className="micro-label truncate">{label}</dt>
      <dd className={cn("mt-1 font-mono text-[15px] tabular", value ? tone ?? "text-foreground" : "text-subtle-foreground")}>{value}</dd>
    </div>
  );
}

function RuleCard({ rule, overridden, onEdit }: { rule: Rule; overridden: boolean; onEdit: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.patch<Rule>(`/automations/rules/${rule.id}`, { enabled }),
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: automationKeys.rules(orgId) });
      const prev = qc.getQueryData<Rule[]>(automationKeys.rules(orgId));
      qc.setQueryData<Rule[]>(automationKeys.rules(orgId), (rs) => rs?.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
      return { prev };
    },
    onError: (e, _v, c) => {
      qc.setQueryData(automationKeys.rules(orgId), c?.prev);
      toast.error(errorMessage(e));
    },
    onSuccess: (r) => toast.success(r.enabled ? `“${r.name}” is live` : `“${r.name}” paused`),
    onSettled: () => qc.invalidateQueries({ queryKey: automationKeys.all }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/automations/rules/${rule.id}`),
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: automationKeys.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = rule.stats;
  return (
    <Card className={cn("card-hover flex min-w-0 flex-col overflow-hidden", !rule.enabled && "opacity-80")}>
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", rule.enabled ? "bg-primary/70" : "bg-border-strong")} />
      <div className="flex items-start gap-3.5 p-5 pb-4">
        {rule.channel === "auto" ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background-subtle text-primary"><Layers className="size-[17px]" /></span>
        ) : (
          <ChannelIcon channel={rule.channel} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{rule.name}</h3>
            <Badge size="sm" mono variant={rule.enabled ? "success" : "neutral"} dot={rule.enabled}>{rule.enabled ? "Live" : "Paused"}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{rule.location_name ?? "All locations"}</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{rule.template_name ? `Template · ${rule.template_name}` : "Custom message"}</span>
          </p>
          {overridden && <p className="mt-1.5 text-[11.5px] text-amber">Location-specific rules take priority where they exist.</p>}
        </div>
        <Switch checked={rule.enabled} onCheckedChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} aria-label={`${rule.enabled ? "Pause" : "Enable"} ${rule.name}`} />
      </div>
      <div className="px-5 pb-4"><FlowChips channel={rule.channel} delay={rule.delay_minutes} quiet={rule.quiet_hours} cooldown={rule.cooldown_days} /></div>
      {rule.message_body && <p className="mx-5 mb-4 line-clamp-2 rounded-lg border border-border bg-background-subtle/60 px-3 py-2 text-[12.5px] leading-relaxed text-foreground-soft">{rule.message_body}</p>}
      <dl className="mt-auto grid grid-cols-3 divide-x divide-border border-t border-border bg-background-subtle/40 sm:grid-cols-5">
        <Stat label="Visits 7d" value={s.visits_7d} />
        <Stat label="Sent 7d" value={s.sent_7d} tone="text-success-foreground" />
        <Stat label="Queued" value={s.scheduled} tone="text-ice" />
        <Stat label="Skipped" value={s.skipped_7d} />
        <Stat label="Failed" value={s.failed_7d} tone="text-danger-foreground" />
      </dl>
      <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onEdit}><Pencil /> Edit</Button>
        <ConfirmDialog
          trigger={<Button variant="ghost" size="sm" className="text-danger-foreground hover:text-danger-foreground"><Trash2 /> Delete</Button>}
          title={`Delete “${rule.name}”?`}
          description={s.scheduled ? `${s.scheduled} scheduled visit${s.scheduled === 1 ? "" : "s"} will be skipped instead of sent. The activity log is kept.` : "New visits will no longer match this rule. The activity log is kept."}
          confirmLabel="Delete rule"
          destructive
          onConfirm={async () => { await remove.mutateAsync(); }}
        />
      </div>
    </Card>
  );
}

export function RulesTab({ onCreate }: { onCreate: () => void }) {
  const { orgId } = useOrg();
  const [editing, setEditing] = React.useState<Rule | null>(null);
  const rules = useQuery({ queryKey: automationKeys.rules(orgId), queryFn: () => api.get<Rule[]>("/automations/rules") });

  if (rules.isError) return <Card><ErrorState message={errorMessage(rules.error)} onRetry={() => rules.refetch()} /></Card>;
  if (rules.isLoading) return <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>;
  const list = rules.data ?? [];
  if (!list.length) {
    return (
      <Card>
        <EmptyState
          icon={Workflow}
          title="No automation rules yet"
          description="A rule turns every recorded visit into one review request — after a delay you choose, outside quiet hours, and only for customers who consented."
          action={<Button onClick={onCreate}><Plus /> Create your first rule</Button>}
        />
      </Card>
    );
  }
  const specificLocations = new Set(list.filter((r) => r.location_id && r.enabled).map((r) => r.location_id));
  const live = list.filter((r) => r.enabled).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
          <StatusDot tone={live ? "live" : "idle"} pulse={!!live} /> {live} of {list.length} live · location rules beat “all locations”
        </p>
        <Button variant="outline" size="sm" onClick={onCreate}><Plus /> New rule</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((r) => <RuleCard key={r.id} rule={r} overridden={!r.location_id && specificLocations.size > 0} onEdit={() => setEditing(r)} />)}
      </div>
      <RuleEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} rule={editing} />
    </div>
  );
}
