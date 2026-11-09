"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Eye, KeyRound, Lock, Send, StickyNote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd, StatusDot } from "@/components/ui/tech";
import { ApiError, errorMessage } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { StatusTabs } from "@/components/admin/table";
import { CopyId, EmptyLine, KeyValue, Monogram, Notice, Panel, QueryState, StatusPill, adminGet, adminPatch, adminPost, relTime, shortDate, shortId, stamp, useAdmin } from "@/components/admin/ui";

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
  const [mode, setMode] = React.useState<"reply" | "note">("reply");
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const internal = mode === "note";
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const reply = useMutation({
    mutationFn: () => adminPost(`/support/tickets/${id}/messages`, { body, internal }),
    onSuccess: () => { setBody(""); toast.success(internal ? "Internal note added" : "Reply sent — the customer is notified by email"); refresh(); },
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
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [d?.messages.length]);
  const submit = () => { if (body.trim() && !reply.isPending) reply.mutate(); };

  return (
    <>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-3.5" /> Support desk</Link>
      <QueryState query={q}>
        {d && (
          <div className="space-y-4">
            <header className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="micro-label mb-1.5 flex items-center gap-2"><span className="text-primary">Ticket</span> · <CopyId value={d.ticket.id} display={`#${shortId(d.ticket.id, 6)}`} className="text-[10.5px]" /> · {titleCase(d.ticket.category)}</p>
                <h1 className="text-[21px] font-semibold tracking-[-0.025em] sm:text-[23px]">{d.ticket.subject}</h1>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground"><StatusPill status={d.ticket.status} /><StatusPill status={d.ticket.priority} label={`${d.ticket.priority} priority`} dot={false} /> opened {stamp(d.ticket.created_at, false)} · {d.messages.length} messages</p>
              </div>
              {!["resolved", "closed"].includes(d.ticket.status) && (
                <Button variant="soft" size="sm" onClick={() => update.mutate({ status: "resolved" })} loading={update.isPending}><CheckCircle2 /> Mark resolved</Button>
              )}
            </header>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Panel title="Conversation" description="Customer-visible replies and staff-only internal notes" meta={`${d.messages.filter((m) => m.is_internal).length} notes`} flush>
                <ol className="max-h-[560px] space-y-5 overflow-y-auto px-4 py-5 scrollbar-thin" aria-label="Messages">
                  {d.messages.map((m) => {
                    const staff = m.is_from_staff;
                    return (
                      <li key={m.id} className={cn("flex gap-3", staff && "flex-row-reverse")}>
                        <Monogram name={m.author_name ?? "?"} size={28} round />
                        <div className={cn("max-w-[82%] min-w-0", staff && "text-right")}>
                          <p className={cn("mb-1 flex items-center gap-2 font-mono text-[10.5px] text-subtle-foreground", staff && "justify-end")}>
                            <span className="text-foreground-soft">{m.author_name ?? "Unknown"}</span>
                            {staff && !m.is_internal && <span className="uppercase tracking-[0.1em] text-primary">Staff</span>}
                            {m.is_internal && <span className="inline-flex items-center gap-1 uppercase tracking-[0.1em] text-amber"><Lock className="size-3" /> Internal</span>}
                            <span>{stamp(m.created_at, false)}</span>
                          </p>
                          <div className={cn(
                            "rounded-lg border px-3.5 py-2.5 text-left",
                            m.is_internal ? "border-dashed border-[color-mix(in_oklab,var(--amber)_40%,transparent)] bg-amber-soft"
                              : staff ? "border-[color-mix(in_oklab,var(--primary)_26%,transparent)] bg-primary-soft"
                              : "border-border bg-card-elevated",
                          )}>
                            <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground">{m.body}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {!d.messages.length && <li><EmptyLine>No messages yet</EmptyLine></li>}
                  <div ref={endRef} />
                </ol>
                <form className="border-t border-border bg-background-subtle/50 p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <StatusTabs id="composer" value={mode} onChange={(v) => setMode(v as "reply" | "note")} items={[{ value: "reply", label: "Reply to customer" }, { value: "note", label: "Internal note" }]} />
                    <span className={cn("flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em]", internal ? "text-amber" : "text-primary")}>
                      {internal ? <><Lock className="size-3" /> Visible to super admins only</> : <><Send className="size-3" /> Emails {d.requester?.email ?? "the requester"}</>}
                    </span>
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
                    rows={4}
                    placeholder={internal ? "Context for other operators…" : "Write a reply…"}
                    aria-label={internal ? "Internal note" : "Reply to customer"}
                    className={cn(internal && "border-[color-mix(in_oklab,var(--amber)_35%,transparent)]")}
                    maxLength={5000}
                  />
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-subtle-foreground sm:flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd> to send · {body.length}/5000</span>
                    <Button type="submit" variant={internal ? "outline" : "primary"} loading={reply.isPending} disabled={!body.trim()} className="ml-auto">{internal ? <><StickyNote /> Add note</> : <><Send /> Send reply</>}</Button>
                  </div>
                </form>
              </Panel>

              <div className="space-y-4">
                <Panel title="Controls" description="Changes are audited">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="t-status">Status</Label>
                      <Select value={d.ticket.status} onValueChange={(v) => update.mutate({ status: v })}>
                        <SelectTrigger id="t-status" size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["open", "pending", "resolved", "closed"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-priority">Priority</Label>
                      <Select value={d.ticket.priority} onValueChange={(v) => update.mutate({ priority: v })}>
                        <SelectTrigger id="t-priority" size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["low", "normal", "high", "urgent"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-assignee">Assignee</Label>
                      <Select value={d.ticket.assignee_id ?? "none"} onValueChange={(v) => update.mutate(v === "none" ? { unassign: true } : { assignee_id: v })}>
                        <SelectTrigger id="t-assignee" size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Unassigned</SelectItem>{d.admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </Panel>
                <Panel title="Requester">
                  {d.requester && (
                    <div className="mb-4 flex items-center gap-3">
                      <Monogram name={d.requester.full_name} size={32} round />
                      <div className="min-w-0">
                        <Link href={`/admin/users?user=${d.requester.id}`} className="block truncate text-[13px] font-medium text-foreground hover:text-primary">{d.requester.full_name}</Link>
                        <CopyId value={d.requester.email} className="text-[11px]" />
                      </div>
                    </div>
                  )}
                  <KeyValue cols={1} items={[
                    ["Organization", d.organization ? <Link key="o" href={`/admin/organizations/${d.organization.id}`} className="inline-flex items-center gap-2 hover:text-primary">{d.organization.name} <StatusPill status={d.organization.status} dot={false} /></Link> : "—"],
                    ["Opened", `${shortDate(d.ticket.created_at)} · ${relTime(d.ticket.created_at)}`],
                    ["Resolved", shortDate(d.ticket.resolved_at)],
                  ]} />
                </Panel>
                <Panel title="Customer data access" description="Time-boxed grant from the customer" actions={<StatusDot tone={d.ticket.data_access_active ? "live" : "idle"} pulse={d.ticket.data_access_active} label={d.ticket.data_access_active ? "Grant active" : "No grant"} />}>
                  {d.ticket.data_access_active ? (
                    <>
                      <Notice tone="ice" icon={KeyRound}>Granted until <span className="font-mono">{stamp(d.ticket.data_access_granted_until, false)}</span>. Each snapshot view is audited.</Notice>
                      <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => loadSnapshot.mutate()} loading={loadSnapshot.isPending}><Eye /> {snapshot ? "Refresh snapshot" : "View limited snapshot"}</Button>
                    </>
                  ) : (
                    <Notice tone="ice" icon={Lock}>No active grant. Customers can grant time-boxed access when opening a ticket; organization content stays hidden until then.</Notice>
                  )}
                  {snapshot && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4 text-[12.5px]">
                      <p className="flex items-center justify-between"><span className="micro-label">Google</span><StatusPill status={snapshot.google.status} /></p>
                      {snapshot.google.last_error && <p className="text-[12px] text-danger-foreground">{snapshot.google.last_error}</p>}
                      <ul className="space-y-1">{snapshot.locations.map((l) => <li key={l.name} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="font-mono text-[10.5px] uppercase text-muted-foreground">{l.google_review_url_set ? "link set" : "no link"}</span></li>)}</ul>
                      <p className="micro-label pt-1">Latest reviews</p>
                      <ul className="space-y-2">
                        {snapshot.recent_reviews.map((r, i) => (
                          <li key={i} className="rounded-md border border-border bg-background-subtle px-3 py-2">
                            <p className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground"><span className="flex items-center gap-0.5 text-amber">{r.rating}<Star className="size-3 fill-current" /></span> {r.source} · {r.response_status}</p>
                            <p className="mt-0.5 text-foreground-soft">{r.comment || "(no text)"}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
