"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Ban, Download, ExternalLink, Mail, MessageSquare, MessageSquareText, MousePointerClick, MoreHorizontal, Send, ShieldCheck, Smartphone, Star, Trash2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { ControlledConfirm } from "@/components/settings/controlled-confirm";
import { LANGUAGES, type CustomerDetail } from "@/components/customers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { ApiError, api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";

const TIMELINE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  created: UserPlus, review_request: Send, click: MousePointerClick, google_click: Star, message: MessageSquare, feedback: MessageSquareText, opt_out: Ban,
};

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, orgId } = useOrg();
  const canManage = can("customers.manage");
  const [sending, setSending] = React.useState(false);
  const [erasing, setErasing] = React.useState(false);
  const key = ["customers", orgId, "detail", id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["customers"] }); };

  const optOut = useMutation({ mutationFn: () => api.post(`/customers/${id}/opt-out`), onSuccess: () => { toast.success("Customer opted out of all messages"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-4"><Skeleton className="size-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-72" /></div></div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </div>
    );
  }
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <EmptyState icon={UserPlus} title="Customer not found" description="This customer may have been erased or belongs to another organization." action={<Button asChild variant="outline"><Link href="/app/customers">Back to customers</Link></Button>} />;
    }
    return <QueryErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  const c = query.data!;
  const optedOut = !!c.opted_out_at;

  return (
    <div>
      <Link href="/app/customers" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Customers
      </Link>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={c.name ?? c.email ?? "?"} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{c.name ?? "Unnamed customer"}</h1>
              {optedOut && <Badge variant="danger" dot>Opted out</Badge>}
              <Badge variant="outline" size="sm">{titleCase(c.source)}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {c.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{c.email}</span>}
              {c.phone && <span className="flex items-center gap-1.5 font-mono text-xs"><Smartphone className="size-3.5" />{c.phone}</span>}
              <span>Added {format(new Date(c.created_at), "d MMM yyyy")}</span>
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setSending(true)} disabled={optedOut}><Send /> Send review request</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => downloadFile(`/customers/${id}/data-export`, undefined, `customer-${id}.json`).catch((e) => toast.error(errorMessage(e)))}>
                  <Download /> Export data (DSAR)
                </DropdownMenuItem>
                {!optedOut && <DropdownMenuItem onSelect={() => optOut.mutate()}><Ban /> Opt out of all messages</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setErasing(true)}><Trash2 /> Erase customer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <DetailsCard customer={c} canManage={canManage} onSaved={refresh} />
          <ConsentCard customer={c} canManage={canManage} onSaved={refresh} />
        </div>
        <Card>
          <CardHeader><div><CardTitle>Activity</CardTitle><CardDescription>Review requests, messages, clicks and private feedback</CardDescription></div></CardHeader>
          <CardContent>
            {c.timeline.length <= 1 ? (
              <EmptyState compact icon={Send} title="No activity yet" description="Send a review request to start the timeline." />
            ) : (
              <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
                {c.timeline.map((t, i) => {
                  const Icon = TIMELINE_ICON[t.kind] ?? Send;
                  return (
                    <li key={i} className="relative flex gap-4">
                      <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-4 border-card", t.kind === "google_click" ? "bg-warning-soft text-warning-foreground" : t.kind === "opt_out" ? "bg-danger-soft text-danger-foreground" : t.kind === "feedback" ? "bg-purple-soft text-purple" : "bg-primary-soft text-primary-soft-foreground")}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-medium">{t.title}</p>
                          {t.status && <StatusBadge status={t.status} />}
                        </div>
                        {t.detail && <p className="mt-1 rounded-lg bg-background-subtle px-3 py-2 text-xs leading-relaxed text-muted-foreground">{t.detail}</p>}
                        <p className="mt-1 text-[11px] text-subtle-foreground" title={format(new Date(t.at), "PPpp")}>{formatDistanceToNow(new Date(t.at), { addSuffix: true })}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      <SendRequestDialog open={sending} onOpenChange={setSending} customer={c} />
      <ControlledConfirm
        open={erasing}
        onOpenChange={setErasing}
        destructive
        title="Erase this customer?"
        description={`${c.name ?? "This customer"}'s name, email, phone, notes and tags will be permanently scrubbed, including from private feedback. Anonymous request counts remain for analytics. This cannot be undone.`}
        confirmLabel="Erase permanently"
        confirmText="ERASE"
        onConfirm={async () => {
          try { await api.delete(`/customers/${id}`); toast.success("Customer erased"); refresh(); router.push("/app/customers"); } catch (e) { toast.error(errorMessage(e)); }
        }}
      />
    </div>
  );
}


function DetailsCard({ customer: c, canManage, onSaved }: { customer: CustomerDetail; canManage: boolean; onSaved: () => void }) {
  const { locations } = useOrg();
  const [v, setV] = React.useState({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "", location_id: c.location_id ?? "none", preferred_language: c.preferred_language, tags: c.tags.join(", "), notes: c.notes ?? "" });
  React.useEffect(() => {
    setV({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "", location_id: c.location_id ?? "none", preferred_language: c.preferred_language, tags: c.tags.join(", "), notes: c.notes ?? "" });
  }, [c]);
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/customers/${c.id}`, {
        name: v.name || null, email: v.email || null, phone: v.phone || null, location_id: v.location_id === "none" ? null : v.location_id,
        preferred_language: v.preferred_language, tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean), notes: v.notes || null,
      }),
    onSuccess: () => { toast.success("Customer updated"); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Card>
      <CardHeader><div><CardTitle>Contact details</CardTitle><CardDescription>Used only to contact this customer about their experience</CardDescription></div></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="d-name"><Input id="d-name" value={v.name} onChange={set("name")} /></FormField>
            <FormField label="Language">
              <Select value={v.preferred_language} onValueChange={(x) => setV((s) => ({ ...s, preferred_language: x }))} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Email" htmlFor="d-email"><Input id="d-email" type="email" value={v.email} onChange={set("email")} /></FormField>
            <FormField label="Phone" htmlFor="d-phone" hint="With country code"><Input id="d-phone" value={v.phone} onChange={set("phone")} /></FormField>
            <FormField label="Location">
              <Select value={v.location_id} onValueChange={(x) => setV((s) => ({ ...s, location_id: x }))} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tags" htmlFor="d-tags" hint="Comma separated"><Input id="d-tags" value={v.tags} onChange={set("tags")} /></FormField>
            <FormField label="Notes" htmlFor="d-notes" className="sm:col-span-2"><Textarea id="d-notes" rows={3} value={v.notes} onChange={set("notes")} /></FormField>
          </fieldset>
          {canManage && <div className="flex justify-end"><Button type="submit" size="sm" loading={save.isPending}>Save changes</Button></div>}
        </form>
      </CardContent>
    </Card>
  );
}

function ConsentCard({ customer: c, canManage, onSaved }: { customer: CustomerDetail; canManage: boolean; onSaved: () => void }) {
  const update = useMutation({
    mutationFn: (next: Record<string, boolean>) => api.post(`/customers/${c.id}/consent`, { whatsapp: !!next.whatsapp, email: !!next.email, sms: !!next.sms, source: "manual" }),
    onSuccess: () => { toast.success("Consent updated"); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const channels = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, needs: c.phone },
    { key: "email", label: "Email", icon: Mail, needs: c.email },
    { key: "sms", label: "SMS", icon: Smartphone, needs: c.phone },
  ];
  return (
    <Card>
      <CardHeader><div><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Consent</CardTitle><CardDescription>Review requests are only sent on channels with recorded consent</CardDescription></div></CardHeader>
      <CardContent className="space-y-4">
        {c.opted_out_at && <InlineAlert variant="danger" icon={Ban} title="Opted out">This customer opted out on {format(new Date(c.opted_out_at), "d MMM yyyy")}. No messages will be sent.</InlineAlert>}
        <div className="divide-y divide-border rounded-xl border border-border">
          {channels.map((ch) => (
            <div key={ch.key} className="flex items-center gap-3 px-4 py-3">
              <ch.icon className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{ch.label}</p>
                <p className="text-xs text-muted-foreground">{!ch.needs ? `No ${ch.key === "email" ? "email address" : "phone number"} on file` : c.consents[ch.key] ? "Consent recorded" : "No consent recorded"}</p>
              </div>
              <Switch
                checked={!!c.consents[ch.key]}
                disabled={!canManage || !!c.opted_out_at || update.isPending || (!ch.needs && !c.consents[ch.key])}
                onCheckedChange={(on) => update.mutate({ ...c.consents, [ch.key]: on })}
                aria-label={`${ch.label} consent`}
              />
            </div>
          ))}
        </div>
        {c.consent_history.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">History</p>
            <ul className="space-y-1.5">
              {c.consent_history.slice(0, 8).map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-foreground-soft">
                    <span className={h.status === "granted" ? "text-success-foreground" : "text-danger-foreground"}>{titleCase(h.status)}</span> · {titleCase(h.channel)} {h.type === "marketing" ? "(marketing)" : ""} via {titleCase(h.source)}
                  </span>
                  <span className="shrink-0 text-subtle-foreground">{format(new Date(h.at), "d MMM yyyy")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SendRequestDialog({ open, onOpenChange, customer: c }: { open: boolean; onOpenChange: (o: boolean) => void; customer: CustomerDetail }) {
  const { locations } = useOrg();
  const qc = useQueryClient();
  const available = (["whatsapp", "email", "sms"] as const).filter((k) => c.consents[k]);
  const [channel, setChannel] = React.useState<string>(available[0] ?? "whatsapp");
  const [locationId, setLocationId] = React.useState<string>(c.location_id ?? locations[0]?.id ?? "");
  React.useEffect(() => { if (open) { setChannel(available[0] ?? "whatsapp"); setLocationId(c.location_id ?? locations[0]?.id ?? ""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({
    mutationFn: () => api.post("/review-requests", { customer_id: c.id, location_id: locationId, channel }),
    onSuccess: () => { toast.success("Review request queued"); qc.invalidateQueries({ queryKey: ["customers"] }); onOpenChange(false); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send review request</DialogTitle>
          <DialogDescription>{c.name ?? "The customer"} will receive a link to your feedback page with an equal option to review you on Google.</DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <InlineAlert variant="warning" icon={ShieldCheck} title="No consent recorded">Record consent for at least one channel before sending a request.</InlineAlert>
        ) : (
          <div className="space-y-4">
            <FormField label="Channel">
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{available.map((k) => <SelectItem key={k} value={k}>{titleCase(k)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Location">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!available.length || !locationId} loading={send.isPending} onClick={() => send.mutate()}><Send /> Send request</Button>
        </DialogFooter>
        <p className="mt-3 flex items-center gap-1 text-[11px] text-subtle-foreground"><ExternalLink className="size-3" />Track delivery on the Review Requests page.</p>
      </DialogContent>
    </Dialog>
  );
}
