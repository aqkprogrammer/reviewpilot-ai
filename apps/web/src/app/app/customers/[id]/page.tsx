"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Ban, Download, ExternalLink, FileJson, Mail, MessageSquare, MessageSquareText, MousePointerClick, MoreHorizontal, Send, ShieldCheck, Smartphone, Star, Trash2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Eyebrow, Monogram, Panel } from "@/components/console/kit";
import { ControlledConfirm } from "@/components/settings/controlled-confirm";
import { CONSENT_CHANNELS } from "@/components/customers/consent-chips";
import { LANGUAGES, type CustomerDetail } from "@/components/customers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Reveal, TechFrame } from "@/components/ui/tech";
import { ApiError, api, downloadFile, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";

const TIMELINE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  created: UserPlus, review_request: Send, click: MousePointerClick, google_click: Star, message: MessageSquare, feedback: MessageSquareText, opt_out: Ban,
};
const TIMELINE_TONE: Record<string, string> = {
  google_click: "border-[color-mix(in_oklab,var(--amber)_40%,transparent)] bg-amber-soft text-amber",
  opt_out: "border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-danger-soft text-danger-foreground",
  feedback: "border-[color-mix(in_oklab,var(--mint)_40%,transparent)] bg-mint-soft text-mint",
  created: "border-border-strong bg-muted text-muted-foreground",
};
const CHANNEL_ICON = { whatsapp: MessageSquare, email: Mail, sms: Smartphone } as const;

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, orgId, locations } = useOrg();
  const canManage = can("customers.manage");
  const [sending, setSending] = React.useState(false);
  const [erasing, setErasing] = React.useState(false);
  const [optingOut, setOptingOut] = React.useState(false);
  const key = ["customers", orgId, "detail", id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["customers"] }); };

  const optOut = useMutation({ mutationFn: () => api.post(`/customers/${id}/opt-out`), onSuccess: () => { toast.success("Customer opted out of all messages"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const exportDsar = () => downloadFile(`/customers/${id}/data-export`, undefined, `customer-${id}.json`).then(() => toast.success("Data export downloaded")).catch((e) => toast.error(errorMessage(e)));

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
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
  const locName = locations.find((l) => l.id === c.location_id)?.name;
  const consentCount = CONSENT_CHANNELS.filter((ch) => c.consents[ch.key]).length;
  const events = c.timeline.filter((t) => t.kind !== "created").length;

  return (
    <div className="space-y-6">
      <Link href="/app/customers" className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" /> Customers
        <span className="text-border-strong">/</span>
        <span className="max-w-[40vw] truncate text-subtle-foreground normal-case tracking-normal">{c.id.slice(0, 8)}</span>
      </Link>

      {/* Identity header */}
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-50 [mask-image:linear-gradient(90deg,#000,transparent_60%)]" />
        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TechFrame className="rounded-xl p-1 text-primary/70">
              <Monogram name={c.name ?? c.email ?? "?"} size={56} />
            </TechFrame>
            <div className="min-w-0">
              <Eyebrow parts={["Customer", titleCase(c.source)]} />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.025em]">{c.name ?? "Unnamed customer"}</h1>
                {optedOut ? <Badge variant="danger" mono size="sm" dot>Opted out</Badge> : <Badge variant={consentCount ? "mint" : "neutral"} mono size="sm" dot>{consentCount ? `${consentCount}/3 channels` : "No consent"}</Badge>}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                {c.email && <span className="flex min-w-0 items-center gap-1.5"><Mail className="size-3.5 shrink-0" /><span className="truncate">{c.email}</span></span>}
                {c.phone && <span className="flex items-center gap-1.5 font-mono text-xs"><Smartphone className="size-3.5" />{c.phone}</span>}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => setSending(true)} disabled={optedOut}><Send /> Send review request</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={exportDsar}><Download /> Export data (DSAR)</DropdownMenuItem>
                  {!optedOut && <DropdownMenuItem onSelect={() => setOptingOut(true)}><Ban /> Opt out of all messages</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setErasing(true)}><Trash2 /> Erase customer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <dl className="relative grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Added", format(new Date(c.created_at), "d MMM yyyy")],
            ["Language", LANGUAGES.find((l) => l.value === c.preferred_language)?.label ?? c.preferred_language],
            ["Location", locName ?? "—"],
            ["Requests", String(c.request_count)],
            ["Last contact", c.last_contacted_at ? formatDistanceToNow(new Date(c.last_contacted_at), { addSuffix: true }) : "Never"],
            ["Events", String(events)],
          ].map(([l, v]) => (
            <div key={l} className="min-w-0 bg-card px-5 py-3">
              <dt className="micro-label">{l}</dt>
              <dd className="mt-1 truncate font-mono text-[12.5px] tabular text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-6">
          <Reveal><ConsentCard customer={c} canManage={canManage} onSaved={refresh} /></Reveal>
          <Reveal delay={0.05}><DetailsCard customer={c} canManage={canManage} onSaved={refresh} /></Reveal>
          {canManage && (
            <Reveal delay={0.1}>
              <Panel index="04" label="Data rights" title="Privacy requests" icon={ShieldCheck} description="Export everything stored about this customer, or erase their personal data permanently.">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={exportDsar} className="group flex items-start gap-3 rounded-lg border border-border bg-background-subtle/60 p-3.5 text-left transition hover:border-border-strong hover:bg-surface-hover">
                    <FileJson className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span><span className="block text-[13px] font-medium">Export data (DSAR)</span><span className="mt-0.5 block text-xs text-muted-foreground">JSON with profile, consent and activity</span></span>
                  </button>
                  <button type="button" onClick={() => setErasing(true)} className="group flex items-start gap-3 rounded-lg border border-[color-mix(in_oklab,var(--danger)_22%,var(--border))] bg-danger-soft/40 p-3.5 text-left transition hover:border-[color-mix(in_oklab,var(--danger)_45%,transparent)] hover:bg-danger-soft">
                    <Trash2 className="mt-0.5 size-4 shrink-0 text-danger-foreground" />
                    <span><span className="block text-[13px] font-medium text-danger-foreground">Erase customer</span><span className="mt-0.5 block text-xs text-muted-foreground">Irreversible — requires typed confirmation</span></span>
                  </button>
                </div>
              </Panel>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.05} className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <Panel index="02" label="Activity log" title="Timeline" description="Review requests, messages, clicks and private feedback"
            actions={<span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{c.timeline.length} entries</span>}>
            {c.timeline.length <= 1 ? (
              <EmptyState compact icon={Send} title="No activity yet" description="Send a review request to start the timeline." />
            ) : (
              <ol className="relative">
                {c.timeline.map((t, i) => {
                  const Icon = TIMELINE_ICON[t.kind] ?? Send;
                  const at = new Date(t.at);
                  const last = i === c.timeline.length - 1;
                  return (
                    <li key={i} className="relative grid grid-cols-[64px_28px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 sm:grid-cols-[76px_28px_minmax(0,1fr)]">
                      <div className="pt-1 text-right font-mono text-[10.5px] leading-tight tabular text-subtle-foreground" title={format(at, "PPpp")}>
                        <span className="block text-muted-foreground">{format(at, "d MMM")}</span>
                        <span className="block">{format(at, "HH:mm")}</span>
                      </div>
                      <div className="relative flex justify-center">
                        {!last && <span aria-hidden className="absolute bottom-[-20px] top-7 w-px bg-[linear-gradient(var(--border-strong),var(--border))]" />}
                        <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-md border", TIMELINE_TONE[t.kind] ?? "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft text-primary")}>
                          <Icon className="size-3.5" />
                        </span>
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-medium text-foreground">{t.title}</p>
                          {t.status && <StatusBadge status={t.status} />}
                        </div>
                        {t.detail && <p className="mt-1.5 rounded-md border border-border bg-background-subtle px-3 py-2 text-xs leading-relaxed text-foreground-soft">{t.detail}</p>}
                        <p className="mt-1 text-[11px] text-subtle-foreground">{formatDistanceToNow(at, { addSuffix: true })}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </Reveal>
      </div>

      <SendRequestDialog open={sending} onOpenChange={setSending} customer={c} />
      <ControlledConfirm
        open={optingOut}
        onOpenChange={setOptingOut}
        title="Opt this customer out?"
        description="All channels are switched off and no further review requests will be sent. You can re-record consent later only if the customer gives it again."
        confirmLabel="Opt out"
        onConfirm={() => optOut.mutateAsync().then(() => undefined)}
      />
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
  const initial = React.useCallback(() => ({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "", location_id: c.location_id ?? "none", preferred_language: c.preferred_language, tags: c.tags.join(", "), notes: c.notes ?? "" }), [c]);
  const [v, setV] = React.useState(initial);
  React.useEffect(() => { setV(initial()); }, [initial]);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial());
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
    <Panel index="03" label="Profile" title="Contact details" description="Used only to contact this customer about their experience"
      actions={dirty && <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-warning-foreground"><span className="size-1.5 rounded-full bg-current" />Unsaved</span>}>
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
          <FormField label="Phone" htmlFor="d-phone" hint="With country code"><Input id="d-phone" className="font-mono" value={v.phone} onChange={set("phone")} /></FormField>
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
        {canManage && (
          <div className="flex justify-end gap-2">
            {dirty && <Button type="button" variant="ghost" size="sm" onClick={() => setV(initial())}>Discard</Button>}
            <Button type="submit" size="sm" disabled={!dirty} loading={save.isPending}>Save changes</Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

function ConsentCard({ customer: c, canManage, onSaved }: { customer: CustomerDetail; canManage: boolean; onSaved: () => void }) {
  const update = useMutation({
    mutationFn: (next: Record<string, boolean>) => api.post(`/customers/${c.id}/consent`, { whatsapp: !!next.whatsapp, email: !!next.email, sms: !!next.sms, source: "manual" }),
    onSuccess: () => { toast.success("Consent updated"); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const needs: Record<string, string | null> = { whatsapp: c.phone, email: c.email, sms: c.phone };
  return (
    <Panel index="01" label="Compliance" title="Messaging consent" icon={ShieldCheck} description="Review requests are only sent on channels with recorded consent">
      <div className="space-y-4">
        {c.opted_out_at && <InlineAlert variant="danger" icon={Ban} title="Opted out">This customer opted out on {format(new Date(c.opted_out_at), "d MMM yyyy")}. No messages will be sent.</InlineAlert>}
        <div className="grid gap-2 sm:grid-cols-3">
          {CONSENT_CHANNELS.map((ch) => {
            const on = !!c.consents[ch.key];
            const has = !!needs[ch.key];
            const Icon = CHANNEL_ICON[ch.key];
            return (
              <div key={ch.key} className={cn("relative flex flex-col gap-3 rounded-lg border p-3.5 transition-colors", on ? "border-[color-mix(in_oklab,var(--mint)_35%,var(--border))] bg-mint-soft/50" : "border-border bg-background-subtle/50")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px] font-medium"><Icon className={cn("size-3.5", on ? "text-mint" : "text-subtle-foreground")} />{ch.label}</span>
                  <Switch
                    checked={on}
                    disabled={!canManage || !!c.opted_out_at || update.isPending || (!has && !on)}
                    onCheckedChange={(v) => update.mutate({ ...c.consents, [ch.key]: v })}
                    aria-label={`${ch.label} consent`}
                  />
                </div>
                <p className={cn("font-mono text-[10px] uppercase tracking-[0.1em]", on ? "text-mint" : "text-subtle-foreground")}>
                  {!has ? (ch.key === "email" ? "No email on file" : "No phone on file") : on ? "● Granted" : "○ Not recorded"}
                </p>
              </div>
            );
          })}
        </div>
        {c.consent_history.length > 0 && (
          <div>
            <p className="micro-label mb-2">Consent ledger</p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {c.consent_history.slice(0, 8).map((h, i) => (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-xs">
                  <span className={cn("font-mono text-[10px] uppercase tracking-[0.1em]", h.status === "granted" ? "text-success-foreground" : "text-danger-foreground")}>{h.status === "granted" ? "+ grant" : "− revoke"}</span>
                  <span className="truncate text-foreground-soft">{titleCase(h.channel)}{h.type === "marketing" ? " (marketing)" : ""} <span className="text-subtle-foreground">via {titleCase(h.source)}</span></span>
                  <span className="shrink-0 font-mono text-[10.5px] tabular text-subtle-foreground">{format(new Date(h.at), "d MMM yy")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
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
              <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-2">
                {CONSENT_CHANNELS.map((ch) => {
                  const ok = available.includes(ch.key);
                  const Icon = CHANNEL_ICON[ch.key];
                  return (
                    <button key={ch.key} type="button" role="radio" aria-checked={channel === ch.key} disabled={!ok} onClick={() => setChannel(ch.key)}
                      className={cn("flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-40",
                        channel === ch.key ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--primary)]" : "border-border hover:border-border-strong")}>
                      <Icon className={cn("size-4", channel === ch.key ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-medium">{ch.label}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">{ok ? "Consented" : "No consent"}</span>
                    </button>
                  );
                })}
              </div>
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
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground"><ExternalLink className="size-3" />Track delivery on the Review Requests page</p>
      </DialogContent>
    </Dialog>
  );
}
