"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, LifeBuoy, Plus, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";

interface Ticket { id: string; subject: string; status: string; priority: string; category: string; created_at: string; updated_at: string }
interface TicketDetail { id: string; subject: string; status: string; priority: string; messages: { id: string; body: string; from_staff: boolean; created_at: string }[] }

export function SupportTab() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const list = useQuery({ queryKey: ["support", "tickets"], queryFn: () => api.get<Ticket[]>("/support/tickets", undefined, { orgId: null }) });
  if (open) return <TicketView id={open} onBack={() => { setOpen(null); qc.invalidateQueries({ queryKey: ["support"] }); }} />;
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-blue/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-soft text-blue"><LifeBuoy className="size-5" /></span>
          <div className="flex-1"><p className="text-[15px] font-semibold">Need a hand?</p><p className="text-[13px] text-muted-foreground">Our team replies within one business day (IST). Urgent billing or sync issues are prioritised.</p></div>
          <Button onClick={() => setCreating(true)}><Plus /> New ticket</Button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4"><CardTitle>Your tickets</CardTitle></CardHeader>
        {list.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : !list.data?.length ? (
          <EmptyState compact icon={LifeBuoy} title="No support tickets" description="Questions about integrations, billing or campaigns? Open a ticket." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {list.data.map((t) => (
              <li key={t.id}>
                <button onClick={() => setOpen(t.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{titleCase(t.category)} · updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</p>
                  </div>
                  {t.priority !== "normal" && <Badge size="sm" variant={t.priority === "urgent" || t.priority === "high" ? "danger" : "neutral"}>{titleCase(t.priority)}</Badge>}
                  <StatusBadge status={t.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <NewTicketDialog open={creating} onOpenChange={setCreating} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["support"] }); setOpen(id); }} />
    </div>
  );
}

function NewTicketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { orgId, membership } = useOrg();
  const [v, setV] = React.useState({ subject: "", category: "general", priority: "normal", message: "", grant: "0" });
  React.useEffect(() => { if (open) setV({ subject: "", category: "general", priority: "normal", message: "", grant: "0" }); }, [open]);
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/support/tickets", { subject: v.subject, category: v.category, priority: v.priority, message: v.message, organization_id: orgId, grant_data_access_days: Number(v.grant) }, { orgId: null }),
    onSuccess: (r) => { toast.success("Ticket created"); onOpenChange(false); onCreated(r.id); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = v.subject.trim().length >= 4 && v.message.trim().length >= 10;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>New support ticket</DialogTitle><DialogDescription>For {membership.organization.name}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <FormField label="Subject" htmlFor="t-sub"><Input id="t-sub" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} placeholder="WhatsApp template stuck in review" /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category">
              <Select value={v.category} onValueChange={(category) => setV({ ...v, category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["general", "billing", "integrations", "technical", "account", "feature_request"].map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={v.priority} onValueChange={(priority) => setV({ ...v, priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "normal", "high", "urgent"].map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Describe the issue" htmlFor="t-msg" hint="Include steps to reproduce, location names and what you expected."><Textarea id="t-msg" rows={5} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></FormField>
          <div className="rounded-xl border border-border bg-background-subtle p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold">Allow support to view your organization's data</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">ReviewPilot staff can't see your reviews or customer details by default. Grant temporary, audited access only if it helps resolve this ticket. Access expires automatically.</p>
                <Select value={v.grant} onValueChange={(grant) => setV({ ...v, grant })}>
                  <SelectTrigger size="sm" className="mt-3 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Don't grant access</SelectItem>
                    <SelectItem value="1">Grant for 1 day</SelectItem>
                    <SelectItem value="3">Grant for 3 days</SelectItem>
                    <SelectItem value="7">Grant for 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>Submit ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const [msg, setMsg] = React.useState("");
  const q = useQuery({ queryKey: ["support", "ticket", id], queryFn: () => api.get<TicketDetail>(`/support/tickets/${id}`, undefined, { orgId: null }) });
  const reply = useMutation({ mutationFn: () => api.post(`/support/tickets/${id}/messages`, { body: msg }, { orgId: null }), onSuccess: () => { setMsg(""); q.refetch(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> All tickets</button>
          <CardTitle className="truncate">{q.data?.subject ?? "Loading…"}</CardTitle>
          {q.data && <CardDescription>Priority {q.data.priority}</CardDescription>}
        </div>
        {q.data && <StatusBadge status={q.data.status} size="md" />}
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? <Skeleton className="h-40" /> : (
          <ol className="space-y-3">
            {q.data?.messages.map((m) => (
              <li key={m.id} className={cn("flex", m.from_staff ? "justify-start" : "justify-end")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed", m.from_staff ? "rounded-tl-sm border border-border bg-background-subtle" : "rounded-tr-sm bg-primary text-primary-foreground")}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-1 text-[10.5px]", m.from_staff ? "text-subtle-foreground" : "text-white/70")}>{m.from_staff ? "ReviewPilot support · " : "You · "}{format(new Date(m.created_at), "d MMM, HH:mm")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) reply.mutate(); }} className="flex items-end gap-2 border-t border-border pt-4">
          <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a reply…" aria-label="Reply" className="min-h-14" />
          <Button type="submit" disabled={!msg.trim()} loading={reply.isPending}><Send /> Send</Button>
        </form>
      </CardContent>
    </Card>
  );
}
