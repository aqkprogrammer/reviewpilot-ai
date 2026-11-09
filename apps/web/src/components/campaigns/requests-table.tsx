"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CircleDot, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChannelIcon, REASONS, type RequestRow } from "./shared";

interface Delivery { id: string; provider: string; status: string; error: string | null; is_reminder: boolean; simulated: boolean; created_at: string }

function DeliveryPopover({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const q = useQuery({ queryKey: ["review-requests", "deliveries", id], queryFn: () => api.get<Delivery[]>(`/review-requests/${id}/deliveries`), enabled: open });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="rounded-md p-1 text-subtle-foreground transition hover:bg-surface-hover hover:text-primary" aria-label="Delivery details"><Info className="size-4" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="micro-label mb-3">Delivery attempts</p>
        {q.isLoading ? <Skeleton className="h-16" /> : !q.data?.length ? (
          <p className="text-xs text-muted-foreground">No message was sent for this request.</p>
        ) : (
          <ol className="space-y-2.5">
            {q.data.map((d) => (
              <li key={d.id} className="flex gap-2.5 text-xs">
                <CircleDot className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={d.status} />
                    {d.is_reminder && <Badge size="sm" variant="neutral">Reminder</Badge>}
                    {d.simulated && <Badge size="sm" variant="mint">Simulated</Badge>}
                  </div>
                  <p className="mt-1 text-muted-foreground">{d.simulated ? "Demo mode — nothing was sent" : `via ${d.provider}`} · <span className="font-mono text-[10.5px]">{format(new Date(d.created_at), "dd MMM · HH:mm")}</span></p>
                  {d.error && <p className="mt-0.5 text-danger-foreground">{d.error}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Step({ at, label, tone = "bg-primary" }: { at: string | null; label: string; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-2" title={at ? format(new Date(at), "d MMM yyyy, h:mm a") : undefined}>
      <span aria-hidden className={cn("size-1.5 rounded-full", at ? cn(tone, "shadow-[0_0_6px_currentColor]") : "border border-border-strong")} />
      <span className={cn("font-mono text-[11px] tabular", at ? "text-foreground-soft" : "text-subtle-foreground")}>
        {at ? formatDistanceToNow(new Date(at), { addSuffix: true }) : "—"}
      </span>
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function RequestsTable({ rows, showCampaign = true }: { rows: RequestRow[]; showCampaign?: boolean }) {
  return (
    <Table className="min-w-[760px]">
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Customer</TH>
          {showCampaign && <TH>Campaign</TH>}
          <TH>Status</TH>
          <TH>Sent</TH>
          <TH>Opened page</TH>
          <TH>Google click</TH>
          <TH className="w-10"><span className="sr-only">Details</span></TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.id}>
            <TD>
              <div className="flex items-center gap-3">
                <ChannelIcon channel={r.channel} className="size-8" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.customer_name ?? "Unknown customer"}</p>
                  <p className="truncate font-mono text-[10.5px] text-subtle-foreground">{r.recipient ?? "—"}</p>
                </div>
              </div>
            </TD>
            {showCampaign && <TD className="max-w-[180px] truncate">{r.campaign_name ?? <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">One-off</span>}</TD>}
            <TD>
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={r.status} />
                {r.failed_reason && <span className="max-w-[200px] truncate text-[11px] text-danger-foreground/80" title={r.failed_reason}>{REASONS[r.failed_reason] ?? r.failed_reason}</span>}
                {r.reminders_sent > 0 && <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">{r.reminders_sent} reminder{r.reminders_sent > 1 ? "s" : ""}</span>}
              </div>
            </TD>
            <TD className="whitespace-nowrap"><Step at={r.sent_at} label="sent" tone="bg-ice text-ice" /></TD>
            <TD className="whitespace-nowrap"><Step at={r.clicked_at} label="opened" tone="bg-mint text-mint" /></TD>
            <TD className="whitespace-nowrap"><Step at={r.google_clicked_at} label="google click" tone="bg-amber text-amber" /></TD>
            <TD><DeliveryPopover id={r.id} /></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
