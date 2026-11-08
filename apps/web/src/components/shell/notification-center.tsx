"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, CheckCheck, CreditCard, Megaphone, MessageSquareText, Plug, Sparkles, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/controls";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "review.new": Star, "feedback.new": MessageSquareText, "campaign.completed": Megaphone, "campaign.failed": Megaphone,
  "integration.disconnected": Plug, "billing.payment_succeeded": CreditCard, "billing.payment_failed": CreditCard,
  "team.invitation": Users, "ai.usage_limit": Sparkles, "system.announcement": Megaphone,
};
const TONE: Record<string, string> = {
  "campaign.failed": "bg-danger-soft text-danger-foreground", "billing.payment_failed": "bg-danger-soft text-danger-foreground",
  "integration.disconnected": "bg-warning-soft text-warning-foreground", "billing.payment_succeeded": "bg-success-soft text-success-foreground",
};

export function NotificationCenter() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const count = useQuery({ queryKey: ["notifications", "count"], queryFn: () => api.get<{ count: number }>("/notifications/unread-count", undefined, { orgId: null }), refetchInterval: 60_000 });
  const list = useQuery({
    queryKey: ["notifications", "list", orgId],
    queryFn: () => api.get<{ items: Notification[] }>("/notifications", { page_size: 15, organization_id: orgId }, { orgId: null }),
    enabled: open,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const readAll = useMutation({ mutationFn: () => api.post("/notifications/read-all", undefined, { orgId: null }), onSuccess: invalidate });
  const readOne = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`, undefined, { orgId: null }), onSuccess: invalidate });
  const unread = count.data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-bold text-white ring-2 ring-card">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => readAll.mutate()} disabled={!unread || readAll.isPending}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {list.isLoading ? (
            <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !list.data?.items.length ? (
            <EmptyState compact icon={BellOff} title="No notifications yet" description="New reviews, feedback and campaign results will appear here." />
          ) : (
            <ul>
              {list.data.items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const content = (
                  <div className={cn("flex gap-3 px-4 py-3 transition hover:bg-muted/60", !n.read_at && "bg-primary-soft/30")}>
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[n.type] ?? "bg-primary-soft text-primary-soft-foreground")}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-subtle-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                );
                return (
                  <li key={n.id} className="border-b border-border last:border-0">
                    {n.link ? (
                      <Link href={n.link} onClick={() => { if (!n.read_at) readOne.mutate(n.id); setOpen(false); }}>{content}</Link>
                    ) : (
                      <button className="w-full text-left" onClick={() => !n.read_at && readOne.mutate(n.id)}>{content}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link href="/app/settings?tab=notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">Notification preferences</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
