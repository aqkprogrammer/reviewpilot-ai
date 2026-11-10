"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link2, Lock, Mail, MessageCircle, Phone, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { StatusDot } from "@/components/ui/tech";
import { Pagination } from "@/components/app/pagination";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { RecoveryCaseLink, useRecoveryLookup } from "@/components/recovery/case-link";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SENTIMENT_VARIANT, type Feedback } from "./types";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];
const STATUS_DOT: Record<string, "signal" | "warn" | "ok"> = { new: "signal", in_progress: "warn", resolved: "ok" };

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
  const cases = useRecoveryLookup({ feedbackIds: q.data?.items.map((f) => f.id) });

  return (
    <div className="space-y-4">
      <InlineAlert variant="primary" icon={Lock} title="Private feedback stays private">
        Feedback submitted on your public feedback page goes only to your team. It is never posted to Google — and every customer is offered the same option to leave a public Google review.
      </InlineAlert>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <Segmented id="feedback-status" ariaLabel="Feedback status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "All" }, ...STATUSES]} />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">{q.data ? `${q.data.total} submissions` : "Loading…"}</p>
        </div>
        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <div className="space-y-4 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : !q.data?.items.length ? (
          <EmptyState icon={MessageCircle} title="No private feedback yet" description="Share your feedback page link or a QR code — customers can write to you directly." />
        ) : (
          <ul className={cn("divide-y divide-border", q.isFetching && "opacity-70")}>
            {q.data.items.map((f) => {
              const at = new Date(f.created_at);
              return (
                <li key={f.id} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[92px_minmax(0,1fr)_160px] md:gap-5">
                  <div className="flex items-center gap-2 md:block">
                    <MonoTime className="block text-foreground-soft">{format(at, "dd MMM yyyy")}</MonoTime>
                    <MonoTime className="block">{format(at, "HH:mm")}</MonoTime>
                    <span className="text-[11px] text-subtle-foreground md:mt-1 md:block">{formatDistanceToNow(at, { addSuffix: true })}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{f.name || "Anonymous customer"}</span>
                      {f.rating && <Stars rating={f.rating} size={11} />}
                      {f.sentiment && <Badge size="sm" variant={SENTIMENT_VARIANT[f.sentiment] ?? "neutral"} dot className="capitalize">{f.sentiment}</Badge>}
                      <Badge size="sm" variant="outline" mono>{f.channel === "qr" ? <QrCode /> : f.channel === "direct" ? <Link2 /> : <MessageCircle />}{f.channel === "qr" ? "QR scan" : f.channel === "direct" ? "Direct link" : f.channel}</Badge>
                      {f.language === "hi" && <Badge size="sm" variant="outline">Hindi</Badge>}
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground-soft">{f.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground">
                      {locName(f.location_id) && <span>{locName(f.location_id)}</span>}
                      {f.consent_contact && f.email && <span className="inline-flex items-center gap-1 normal-case tracking-normal"><Mail className="size-3" />{f.email}</span>}
                      {f.consent_contact && f.phone && <span className="inline-flex items-center gap-1 normal-case tracking-normal"><Phone className="size-3" />{f.phone}</span>}
                      {!f.consent_contact && (f.email || f.phone) && <span className="normal-case tracking-normal">Contact details shared without consent to be contacted</span>}
                    </div>
                  </div>
                  <div className="md:justify-self-end">
                    <Select value={f.status} onValueChange={(v) => update.mutate({ id: f.id, status: v })} disabled={!can("reviews.reply")}>
                      <SelectTrigger size="sm" className="w-full md:w-[156px]" aria-label="Feedback status">
                        <span className="flex items-center gap-2"><StatusDot tone={STATUS_DOT[f.status] ?? "idle"} /><SelectValue /></span>
                      </SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {cases.data && <RecoveryCaseLink feedbackId={f.id} existing={cases.data.feedback[f.id] ?? null} offer={(f.rating ?? 5) <= 3 || f.sentiment === "negative"} size="xs" className="mt-2 w-full md:w-[156px]" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {q.data && <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} pageSize={q.data.page_size} onPage={setPage} />}
      </Card>
    </div>
  );
}
