"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Lock, Mail, MessageCircle, Phone, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { Pagination } from "@/components/app/pagination";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SENTIMENT_STYLE, type Feedback } from "./types";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export function FeedbackList() {
  const { orgId, locationId, locations, can } = useOrg();
  const qc = useQueryClient();
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const q = useQuery({
    queryKey: ["feedback", orgId, locationId, status, page],
    queryFn: () => api.get<{ items: Feedback[]; total: number; page: number; pages: number; page_size: number }>("/feedback", { page, page_size: 15, status: status === "all" ? undefined : status, location_id: locationId }),
    placeholderData: (p) => p,
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<Feedback>(`/feedback/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback"] }); toast.success("Feedback status updated"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const locName = (id: string) => locations.find((l) => l.id === id)?.name;

  return (
    <div className="space-y-4">
      <InlineAlert variant="primary" icon={Lock} title="Private feedback stays private">
        Feedback submitted on your public feedback page goes only to your team. It is never posted to Google — and every customer is offered the same option to leave a public Google review.
      </InlineAlert>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-[13px] text-muted-foreground">{q.data ? `${q.data.total} submissions` : "Loading…"}</p>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]" size="sm" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <div className="space-y-4 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !q.data?.items.length ? (
          <EmptyState icon={MessageCircle} title="No private feedback yet" description="Share your feedback page link or a QR code — customers can write to you directly." />
        ) : (
          <ul className="divide-y divide-border">
            {q.data.items.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{f.name || "Anonymous customer"}</span>
                    {f.rating && <Stars rating={f.rating} size={12} />}
                    {f.sentiment && <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-medium capitalize", SENTIMENT_STYLE[f.sentiment])}>{f.sentiment}</span>}
                    <Badge size="sm" variant="neutral">{f.channel === "qr" ? <QrCode /> : <MessageCircle />}{f.channel === "qr" ? "QR scan" : f.channel === "direct" ? "Direct link" : f.channel}</Badge>
                    {f.language === "hi" && <Badge size="sm" variant="outline">Hindi</Badge>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground-soft">{f.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                    <span>{format(new Date(f.created_at), "d MMM yyyy, h:mm a")}</span>
                    {locName(f.location_id) && <span>{locName(f.location_id)}</span>}
                    {f.consent_contact && f.email && <span className="inline-flex items-center gap-1"><Mail className="size-3" />{f.email}</span>}
                    {f.consent_contact && f.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{f.phone}</span>}
                    {!f.consent_contact && (f.email || f.phone) && <span>Contact details shared without consent to be contacted</span>}
                  </div>
                </div>
                <Select value={f.status} onValueChange={(v) => update.mutate({ id: f.id, status: v })} disabled={!can("reviews.reply")}>
                  <SelectTrigger size="sm" className="w-[150px] shrink-0" aria-label="Feedback status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
        {q.data && <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} pageSize={q.data.page_size} onPage={setPage} />}
      </Card>
    </div>
  );
}
