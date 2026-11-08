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
import { ChannelIcon, REASONS, type RequestRow } from "./shared";

interface Delivery { id: string; provider: string; status: string; error: string | null; is_reminder: boolean; simulated: boolean; created_at: string }

function DeliveryPopover({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const q = useQuery({ queryKey: ["review-requests", "deliveries", id], queryFn: () => api.get<Delivery[]>(`/review-requests/${id}/deliveries`), enabled: open });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="rounded-md p-1 text-subtle-foreground transition hover:bg-muted hover:text-foreground" aria-label="Delivery details"><Info className="size-4" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-[13px] font-semibold">Delivery attempts</p>
        {q.isLoading ? <Skeleton className="h-16" /> : !q.data?.length ? (
          <p className="text-xs text-muted-foreground">No message was sent for this request.</p>
        ) : (
          <ol className="space-y-2.5">
            {q.data.map((d) => (
              <li key={d.id} className="flex gap-2.5 text-xs">
                <CircleDot className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={d.status} />
                    {d.is_reminder && <Badge size="sm" variant="neutral">Reminder</Badge>}
                    {d.simulated && <Badge size="sm" variant="purple">Simulated</Badge>}
                  </div>
                  <p className="mt-1 text-muted-foreground">{d.simulated ? "Demo mode — nothing was sent" : `via ${d.provider}`} · {format(new Date(d.created_at), "d MMM, h:mm a")}</p>
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

function Step({ at, label }: { at: string | null; label: string }) {
  return (
    <span className={at ? "text-foreground" : "text-subtle-foreground"} title={at ? format(new Date(at), "d MMM yyyy, h:mm a") : undefined}>
      {at ? formatDistanceToNow(new Date(at), { addSuffix: true }) : "—"}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function RequestsTable({ rows, showCampaign = true }: { rows: RequestRow[]; showCampaign?: boolean }) {
  return (
    <Table>
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
                <ChannelIcon channel={r.channel} className="size-8 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.customer_name ?? "Unknown customer"}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{r.recipient ?? "—"}</p>
                </div>
              </div>
            </TD>
            {showCampaign && <TD className="max-w-[180px] truncate">{r.campaign_name ?? <span className="text-muted-foreground">One-off request</span>}</TD>}
            <TD>
              <div className="flex flex-col items-start gap-1">
                <StatusBadge status={r.status} />
                {r.failed_reason && <span className="max-w-[200px] truncate text-[11px] text-muted-foreground" title={r.failed_reason}>{REASONS[r.failed_reason] ?? r.failed_reason}</span>}
                {r.reminders_sent > 0 && <span className="text-[11px] text-muted-foreground">{r.reminders_sent} reminder{r.reminders_sent > 1 ? "s" : ""}</span>}
              </div>
            </TD>
            <TD className="whitespace-nowrap"><Step at={r.sent_at} label="sent" /></TD>
            <TD className="whitespace-nowrap"><Step at={r.clicked_at} label="opened" /></TD>
            <TD className="whitespace-nowrap"><Step at={r.google_clicked_at} label="google click" /></TD>
            <TD><DeliveryPopover id={r.id} /></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
