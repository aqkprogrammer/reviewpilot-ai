"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div><CardTitle>Notification preferences</CardTitle><CardDescription>Choose how you hear about activity across your organizations</CardDescription></div>
        <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </CardHeader>
      {q.isLoading ? <div className="p-5"><Skeleton className="h-80" /></div> : (
        <div className="border-t border-border">
          <div className="grid grid-cols-[1fr_64px_64px] items-center border-b border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground"><span>Event</span><span className="text-center">In-app</span><span className="text-center">Email</span></div>
          {prefs.map((p) => (
            <div key={p.type} className="grid grid-cols-[1fr_64px_64px] items-center border-b border-border px-5 py-3 last:border-0">
              <div><p className="text-[13px] font-medium">{LABELS[p.type]?.[0] ?? p.type}</p><p className="text-xs text-muted-foreground">{LABELS[p.type]?.[1]}</p></div>
              <div className="flex justify-center"><Switch checked={p.in_app} onCheckedChange={(v) => toggle(p.type, "in_app", v)} aria-label={`${LABELS[p.type]?.[0]} in-app`} /></div>
              <div className="flex justify-center"><Switch checked={p.email} onCheckedChange={(v) => toggle(p.type, "email", v)} aria-label={`${LABELS[p.type]?.[0]} email`} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
