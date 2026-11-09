"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/console/kit";
import { Switch } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";

interface Pref { type: string; in_app: boolean; email: boolean }
const LABELS: Record<string, [string, string]> = {
  "review.new": ["New Google review", "When a review syncs from Google Business Profile"],
  "feedback.new": ["New private feedback", "When a customer submits feedback on your page"],
  "campaign.completed": ["Campaign completed", "Summary when a campaign finishes sending"],
  "campaign.failed": ["Campaign failures", "When many messages in a campaign fail"],
  "integration.disconnected": ["Integration disconnected", "When Google or WhatsApp authorization expires"],
  "billing.payment_succeeded": ["Payment received", "Receipts for subscription payments"],
  "billing.payment_failed": ["Payment failed", "When a renewal payment fails"],
  "team.invitation": ["Team invitations", "When someone invites you to an organization"],
  "ai.usage_limit": ["AI usage limit", "When you reach 90% of monthly AI requests"],
  "system.announcement": ["Product announcements", "Maintenance windows and new features"],
};

export function NotificationsTab() {
  const q = useQuery({ queryKey: ["notifications", "prefs"], queryFn: () => api.get<Pref[]>("/notifications/preferences", undefined, { orgId: null }) });
  const [prefs, setPrefs] = React.useState<Pref[]>([]);
  React.useEffect(() => { if (q.data) setPrefs(q.data); }, [q.data]);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(q.data ?? []);
  const save = useMutation({ mutationFn: () => api.put<Pref[]>("/notifications/preferences", prefs, { orgId: null }), onSuccess: (d) => { toast.success("Preferences saved"); setPrefs(d); q.refetch(); }, onError: (e) => toast.error(errorMessage(e)) });
  const toggle = (type: string, key: "in_app" | "email", v: boolean) => setPrefs((ps) => ps.map((p) => (p.type === type ? { ...p, [key]: v } : p)));

  const groups = Array.from(new Set(prefs.map((p) => p.type.split(".")[0])));
  return (
    <Panel index="01" label="Routing" title="Notification preferences" description="Choose how you hear about activity across your organizations" flush
      actions={<>{dirty && <Button size="sm" variant="ghost" onClick={() => setPrefs(q.data ?? [])}>Discard</Button>}<Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      {q.isLoading ? <div className="p-5"><Skeleton className="h-80" /></div> : (
        <div role="table" aria-label="Notification preferences">
          <div role="row" className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center border-b border-border bg-background-subtle/60 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground sm:grid-cols-[minmax(0,1fr)_88px_88px]">
            <span role="columnheader">Event</span><span role="columnheader" className="text-center">In-app</span><span role="columnheader" className="text-center">Email</span>
          </div>
          {groups.map((g) => (
            <div key={g} role="rowgroup">
              <p className="border-b border-border px-5 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/80">{g}</p>
              {prefs.filter((p) => p.type.split(".")[0] === g).map((p) => (
                <div key={p.type} role="row" className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center border-b border-border px-5 py-3 transition-colors hover:bg-surface-hover/50 sm:grid-cols-[minmax(0,1fr)_88px_88px]">
                  <div role="cell" className="min-w-0"><p className="text-[13px] font-medium">{LABELS[p.type]?.[0] ?? p.type}</p><p className="text-xs text-muted-foreground">{LABELS[p.type]?.[1]}</p></div>
                  <div role="cell" className="flex justify-center"><Switch checked={p.in_app} onCheckedChange={(v) => toggle(p.type, "in_app", v)} aria-label={`${LABELS[p.type]?.[0] ?? p.type} in-app`} /></div>
                  <div role="cell" className="flex justify-center"><Switch checked={p.email} onCheckedChange={(v) => toggle(p.type, "email", v)} aria-label={`${LABELS[p.type]?.[0] ?? p.type} email`} /></div>
                </div>
              ))}
            </div>
          ))}
          <p className="px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</p>
        </div>
      )}
    </Panel>
  );
}
