"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Eye, KeyRound, Lock, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, errorMessage } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { KeyValue, Panel, QueryState, StatusPill, adminGet, adminPatch, adminPost, relTime, shortDate, useAdmin } from "@/components/admin/ui";

interface Detail {
  ticket: { id: string; subject: string; category: string; status: string; priority: string; assignee_id: string | null; data_access_granted_until: string | null; data_access_active: boolean; created_at: string; resolved_at: string | null };
  organization: { id: string; name: string; status: string } | null;
  requester: { id: string; full_name: string; email: string } | null;
  messages: { id: string; body: string; author_name: string | null; is_internal: boolean; is_from_staff: boolean; created_at: string }[];
  admins: { id: string; full_name: string }[];
}
interface Snapshot { granted_until: string; locations: { name: string; google_review_url_set: boolean; google_linked: boolean; is_active: boolean }[]; google: { status: string; last_error: string | null; last_synced_at: string | null }; recent_reviews: { rating: number; comment: string; source: string; response_status: string; created_at: string }[]; recent_campaigns: { name: string; channel: string; status: string; launched_at: string | null }[] }

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useAdmin<Detail>(`/support/tickets/${id}`);
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const reply = useMutation({
    mutationFn: () => adminPost(`/support/tickets/${id}/messages`, { body, internal }),
    onSuccess: () => { setBody(""); toast.success(internal ? "Internal note added" : "Reply sent to the customer"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => adminPatch(`/support/tickets/${id}`, patch),
    onSuccess: () => { toast.success("Ticket updated"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const loadSnapshot = useMutation({
    mutationFn: () => adminGet<Snapshot>(`/support/tickets/${id}/org-snapshot`),
    onSuccess: setSnapshot,
    onError: (e) => toast.error(e instanceof ApiError && e.code === "data_access_not_granted" ? "The customer hasn't granted data access for this ticket." : errorMessage(e)),
  });
  const d = q.data;
  return (
    <>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Support tickets</Link>
      <QueryState query={q}>
        {d && (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-4">
              <div>
                <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{d.ticket.subject}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground"><StatusPill status={d.ticket.status} /><StatusPill status={d.ticket.priority} /> {titleCase(d.ticket.category)} · opened {relTime(d.ticket.created_at)}</p>
              </div>
              <Panel flush bodyClassName="mt-0">
                <ol className="space-y-4 p-5">
                  {d.messages.map((m) => (
                    <li key={m.id} className={cn("flex gap-3", m.is_from_staff && "flex-row-reverse")}>
                      <Avatar name={m.author_name ?? "?"} size={30} />
                      <div className={cn("max-w-[85%] rounded-2xl border px-4 py-3", m.is_internal ? "border-[#f59e0b]/30 bg-warning-soft" : m.is_from_staff ? "border-[#2f7bff]/30 bg-[rgb(47_123_255/0.10)]" : "border-border bg-card-elevated")}>
                        <p className="mb-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                          <span className="font-medium text-foreground-soft">{m.author_name ?? "Unknown"}</span>
                          {m.is_internal && <span className="inline-flex items-center gap-1 text-warning-foreground"><Lock className="size-3" /> Internal note</span>}
                          <span>{relTime(m.created_at)}</span>
                        </p>
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{m.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <form className="border-t border-border p-4" onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(); }}>
                  <div className="mb-2 inline-flex rounded-lg border border-border bg-muted/60 p-0.5 text-[12px]">
                    <button type="button" onClick={() => setInternal(false)} className={cn("rounded-md px-3 py-1", !internal && "bg-card text-foreground shadow-sm")}>Reply to customer</button>
                    <button type="button" onClick={() => setInternal(true)} className={cn("rounded-md px-3 py-1", internal && "bg-card text-foreground shadow-sm")}>Internal note</button>
                  </div>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={internal ? "Visible to Super Admins only…" : "Write a reply — the customer is notified by email…"} aria-label="Message" />
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" variant={internal ? "outline" : "primary"} loading={reply.isPending} disabled={!body.trim()}>{internal ? <><StickyNote /> Add note</> : <><Send /> Send reply</>}</Button>
                  </div>
                </form>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title="Details">
                <KeyValue className="sm:grid-cols-1" items={[
                  ["Organization", d.organization ? <Link key="o" href={`/admin/organizations/${d.organization.id}`} className="hover:underline">{d.organization.name}</Link> : "—"],
                  ["Requester", d.requester ? `${d.requester.full_name} · ${d.requester.email}` : "—"],
                  ["Resolved", shortDate(d.ticket.resolved_at)],
                ]} />
                <div className="mt-4 space-y-3">
                  <Select value={d.ticket.status} onValueChange={(v) => update.mutate({ status: v })}>
                    <SelectTrigger size="sm" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{["open", "pending", "resolved", "closed"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={d.ticket.priority} onValueChange={(v) => update.mutate({ priority: v })}>
                    <SelectTrigger size="sm" aria-label="Priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "normal", "high", "urgent"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)} priority</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={d.ticket.assignee_id ?? "none"} onValueChange={(v) => update.mutate(v === "none" ? { unassign: true } : { assignee_id: v })}>
                    <SelectTrigger size="sm" aria-label="Assignee"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Unassigned</SelectItem>{d.admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  {d.ticket.status !== "resolved" && <Button className="w-full" variant="soft" onClick={() => update.mutate({ status: "resolved" })} loading={update.isPending}><CheckCircle2 /> Mark resolved</Button>}
                </div>
              </Panel>
              <Panel title="Customer data access">
                {d.ticket.data_access_active ? (
                  <>
                    <InlineAlert variant="success" icon={KeyRound}>Granted until {shortDate(d.ticket.data_access_granted_until)}. Each view is audited.</InlineAlert>
                    <Button className="mt-3 w-full" variant="outline" onClick={() => loadSnapshot.mutate()} loading={loadSnapshot.isPending}><Eye /> View limited snapshot</Button>
                  </>
                ) : (
                  <InlineAlert variant="info" icon={Lock}>No active grant. The customer can grant time-boxed access when opening a ticket. Org content stays hidden.</InlineAlert>
                )}
                {snapshot && (
                  <div className="mt-4 space-y-3 text-[12.5px]">
                    <p className="font-mono text-[10.5px] uppercase tracking-wider text-subtle-foreground">Google · <StatusPill status={snapshot.google.status} /></p>
                    {snapshot.google.last_error && <p className="text-danger-foreground">{snapshot.google.last_error}</p>}
                    <ul className="space-y-1">{snapshot.locations.map((l) => <li key={l.name} className="flex justify-between"><span>{l.name}</span><span className="text-muted-foreground">{l.google_review_url_set ? "review link set" : "no review link"}</span></li>)}</ul>
                    <p className="pt-2 font-mono text-[10.5px] uppercase tracking-wider text-subtle-foreground">Latest reviews</p>
                    <ul className="space-y-2">{snapshot.recent_reviews.map((r, i) => <li key={i} className="rounded-lg border border-border px-3 py-2"><span className="font-mono">{r.rating}★</span> <span className="text-muted-foreground">{r.response_status}</span><p className="mt-0.5 text-foreground-soft">{r.comment || "(no text)"}</p></li>)}</ul>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
