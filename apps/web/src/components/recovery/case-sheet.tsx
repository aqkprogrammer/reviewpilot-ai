"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import {
  ArrowUpRight, CheckCircle2, Lock, Mail, MapPin, MessageCircle, MessageSquareText, NotebookPen, Phone, PhoneCall, RotateCcw, ShieldCheck, UserRound,
} from "lucide-react";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { StatusDot } from "@/components/ui/tech";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";
import { AssigneeSelect } from "./assignee-select";
import { CaseStatusBadge, SeverityBadge, SlaClock } from "./sla";
import {
  CHANNELS, OUTCOMES, POLICY_HINT, RESOLUTIONS, STATUS, policyIssue,
  type CaseDetail, type CaseStatus, type ContactChannel, type ContactOutcome, type Resolution, type Severity, type TimelineEntry,
} from "./types";

const EVENT_LABEL: Record<string, string> = {
  opened: "Case opened", demo_seeded: "Demo case", alert_sent: "Team alerted", whatsapp_alert_sent: "WhatsApp alert sent",
  whatsapp_alert_simulated: "WhatsApp alert simulated", whatsapp_alert_skipped: "WhatsApp alert skipped", whatsapp_alert_failed: "WhatsApp alert failed",
  sla_breached: "SLA breached", assigned: "Assigned", unassigned: "Unassigned", status_changed: "Status changed", severity_changed: "Severity changed",
  note: "Note", contact_logged: "Outreach logged", first_response: "First response", resolved: "Resolved", reopened: "Reopened",
};
const EVENT_TONE: Record<string, "ok" | "warn" | "error" | "signal" | "idle" | "live"> = {
  opened: "signal", demo_seeded: "idle", alert_sent: "signal", whatsapp_alert_sent: "ok", whatsapp_alert_simulated: "idle", whatsapp_alert_skipped: "idle",
  whatsapp_alert_failed: "error", sla_breached: "error", contact_logged: "live", first_response: "ok", resolved: "ok", reopened: "warn", note: "idle",
};
const CHANNEL_ICON: Record<ContactChannel, React.ComponentType<{ className?: string }>> = { call: PhoneCall, whatsapp: MessageCircle, email: Mail, sms: MessageSquareText };

function Section({ index, label, children, aside }: { index: string; label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="micro-label flex items-center gap-2"><span className="text-primary/80">{index}</span><span aria-hidden className="h-px w-3 bg-border-strong" />{label}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function CaseSheet({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!caseId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[640px]" aria-describedby={undefined}>
        {caseId ? <CaseBody key={caseId} caseId={caseId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

function CaseBody({ caseId }: { caseId: string }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const key = ["recovery", "case", orgId, caseId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<CaseDetail>(`/recovery/${caseId}`) });
  const c = q.data;

  const apply = (d: CaseDetail) => {
    qc.setQueryData(key, d);
    qc.invalidateQueries({ queryKey: ["recovery", "cases"] });
    qc.invalidateQueries({ queryKey: ["recovery", "summary"] });
    qc.invalidateQueries({ queryKey: ["recovery", "lookup"] });
  };
  const onError = (e: unknown) => toast.error(e instanceof ApiError && e.code === "recovery_policy" ? e.message : errorMessage(e));
  const patch = useMutation({
    mutationFn: (body: { status?: CaseStatus; severity?: Severity }) => api.patch<CaseDetail>(`/recovery/${caseId}`, body),
    onSuccess: (d) => { apply(d); toast.success("Case updated"); },
    onError,
  });

  if (q.isError) {
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Recovery case</SheetTitle>
        <ErrorState message={q.error instanceof ApiError && q.error.status === 404 ? "This case doesn't exist or isn't in your locations." : errorMessage(q.error)} onRetry={() => q.refetch()} />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <SheetTitle className="sr-only">Loading recovery case</SheetTitle>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const closed = c.status === "resolved" || c.status === "closed";
  const act = c.can_act;
  const outreach = c.timeline.filter((e) => e.event === "contact_logged");
  let n = 0;
  const nx = () => String(++n).padStart(2, "0");
  const ix = { source: nx(), contact: nx(), form: act && !closed ? nx() : "", log: outreach.length ? nx() : "", note: act ? nx() : "", resolution: act ? nx() : "", timeline: nx() };

  return (
    <>
      <SheetHeader className="space-y-3">
        <p className="micro-label flex flex-wrap items-center gap-2">
          <StatusDot tone={c.breached ? "error" : STATUS[c.status].dot} pulse={c.breached} />
          Recovery case · <span className="font-mono normal-case tracking-normal text-subtle-foreground">{c.id.slice(0, 8)}</span>
          <span className="text-border-strong">/</span>
          <span>{c.source === "review" ? "Public review" : c.source === "feedback" ? "Private feedback" : "Manual"}</span>
        </p>
        <SheetTitle className="text-[17px] leading-snug tracking-[-0.015em]">{c.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {c.location_name && <span className="inline-flex items-center gap-1 text-[12px]"><MapPin className="size-3" />{c.location_name}</span>}
          <MonoTime>Opened {format(new Date(c.created_at), "dd MMM yyyy · HH:mm")}</MonoTime>
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={c.severity} />
          <CaseStatusBadge status={c.status} />
          {c.sla_missed && !c.breached && <Badge size="sm" variant="warning" mono>SLA missed</Badge>}
          {c.is_demo && <Badge size="sm" variant="amber" mono>Demo data</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <div className="bg-background-subtle px-3.5 py-2.5">
            <p className="micro-label">First response · {c.sla_hours}h SLA</p>
            <SlaClock c={c} size="lg" className="mt-1" />
          </div>
          <div className="bg-background-subtle px-3.5 py-2.5">
            <p className="micro-label">Due</p>
            <p className="mt-1 font-mono text-[13px] tabular text-foreground">{c.due_at ? format(new Date(c.due_at), "dd MMM · HH:mm") : "—"}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle-foreground">{c.due_at ? formatDistanceToNowStrict(new Date(c.due_at), { addSuffix: true }) : ""}</p>
          </div>
          <div className="col-span-2 bg-background-subtle px-3.5 py-2.5 sm:col-span-1">
            <p className="micro-label mb-1">Assignee</p>
            <AssigneeSelect caseId={c.id} locationId={c.location_id} assigneeId={c.assignee_id} assigneeName={c.assignee_name} canAct={act && !closed} onUpdated={apply} className="min-w-0" />
          </div>
        </div>
        {act && !closed && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={c.status} onValueChange={(v) => patch.mutate({ status: v as CaseStatus })} disabled={patch.isPending}>
              <SelectTrigger size="sm" aria-label="Case status"><span className="flex items-center gap-2"><StatusDot tone={STATUS[c.status].dot} className="size-1.5" /><SelectValue /></span></SelectTrigger>
              <SelectContent>
                {(["open", "in_progress", "contacted", "closed"] as CaseStatus[]).map((s) => <SelectItem key={s} value={s}>{s === "closed" ? "Close (not actionable)" : STATUS[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={c.severity} onValueChange={(v) => patch.mutate({ severity: v as Severity })} disabled={patch.isPending}>
              <SelectTrigger size="sm" aria-label="Severity"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical severity</SelectItem>
                <SelectItem value="high">High severity</SelectItem>
                <SelectItem value="medium">Medium severity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </SheetHeader>

      <SheetBody className="space-y-7">
        <Source c={c} index={ix.source} />
        <Contact c={c} index={ix.contact} />
        {act && !closed && <OutreachForm index={ix.form} caseId={c.id} first={!c.first_response_at} onDone={apply} onError={onError} />}
        {outreach.length > 0 && (
          <Section index={ix.log} label={`Outreach log · ${outreach.length}`}>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {[...outreach].reverse().map((e, i) => {
                const Icon = e.channel ? CHANNEL_ICON[e.channel] : PhoneCall;
                return (
                  <li key={i} className="flex gap-3 px-3.5 py-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border-strong bg-card-elevated text-primary"><Icon className="size-3.5" /></span>
                    <div className="min-w-0 flex-1 text-[12.5px]">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-foreground">{CHANNELS.find((x) => x.value === e.channel)?.label ?? "Outreach"}</span>
                        {e.outcome && <Badge size="sm" variant="outline" mono>{OUTCOMES.find((o) => o.value === e.outcome)?.label ?? titleCase(e.outcome)}</Badge>}
                        {e.first && <Badge size="sm" variant="mint" mono>First response</Badge>}
                      </p>
                      {e.note && <p className="mt-1 text-muted-foreground">{e.note}</p>}
                      <MonoTime className="mt-1 block">{format(new Date(e.at), "dd MMM · HH:mm")} · {e.by}</MonoTime>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
        {act && <NoteForm index={ix.note} caseId={c.id} onDone={apply} onError={onError} />}
        {act && <Resolution index={ix.resolution} c={c} onDone={apply} onError={onError} />}
        {!act && closed && c.resolution && (
          <InlineAlert variant="success" icon={CheckCircle2} title={RESOLUTIONS.find((r) => r.value === c.resolution)?.label ?? "Resolved"}>
            {c.resolved_at && `Closed ${formatDistanceToNowStrict(new Date(c.resolved_at), { addSuffix: true })}.`}
          </InlineAlert>
        )}
        {!act && (
          <p className="flex items-center gap-2 rounded-lg border border-border bg-background-subtle/60 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            <Lock className="size-3.5 shrink-0" /> Your role can view recovery cases. Ask a manager or owner to update this case.
          </p>
        )}
        <Timeline index={ix.timeline} entries={c.timeline} />
      </SheetBody>
    </>
  );
}

function Source({ c, index }: { c: CaseDetail; index: string }) {
  if (c.review) {
    const r = c.review;
    return (
      <Section index={index} label={r.source === "demo" ? "Original review · demo" : "Original review · Google"} aside={<Button asChild variant="link" size="xs" className="h-auto"><Link href={`/app/reviews?review=${r.id}`}>Open in Reviews <ArrowUpRight /></Link></Button>}>
        <div className="rounded-lg border border-border bg-background-subtle p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">{r.reviewer_name ?? "Anonymous reviewer"}</span>
            <Stars rating={r.rating} size={12} />
            <MonoTime>{format(new Date(r.review_created_at), "dd MMM yyyy")}</MonoTime>
          </div>
          <blockquote className="relative pl-3 text-[13.5px] leading-relaxed text-foreground before:absolute before:inset-y-0.5 before:left-0 before:w-[2px] before:rounded-full before:bg-danger">
            {r.comment || <span className="italic text-muted-foreground">Rating without text.</span>}
          </blockquote>
          {r.platform_reply ? (
            <p className="mt-3 border-t border-border pt-3 text-[12.5px] text-muted-foreground"><span className="micro-label mr-2">Owner reply</span>{r.platform_reply}</p>
          ) : (
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">No public reply yet — a calm, empathetic reply from the Reviews inbox helps every future reader.</p>
          )}
        </div>
      </Section>
    );
  }
  if (c.feedback) {
    const f = c.feedback;
    return (
      <Section index={index} label="Private feedback">
        <div className="rounded-lg border border-border bg-background-subtle p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">{f.name ?? "Anonymous customer"}</span>
            {f.rating != null && <Stars rating={f.rating} size={12} />}
            <Badge size="sm" variant="outline" mono>{f.channel === "qr" ? "QR scan" : f.channel === "direct" ? "Direct link" : f.channel}</Badge>
            <MonoTime>{format(new Date(f.created_at), "dd MMM yyyy · HH:mm")}</MonoTime>
          </div>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground">{f.message}</p>
        </div>
      </Section>
    );
  }
  return (
    <Section index={index} label="Case details">
      <p className="rounded-lg border border-border bg-background-subtle p-4 text-[13px] leading-relaxed text-foreground-soft">{c.summary || "No details were added when this case was opened."}</p>
    </Section>
  );
}

function Contact({ c, index }: { c: CaseDetail; index: string }) {
  const k = c.contact;
  if (!k) {
    return (
      <Section index={index} label="Customer contact">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background-subtle/60 p-3.5 text-[12.5px] text-muted-foreground">
          <UserRound className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
          {c.source === "review"
            ? <p>Google doesn&apos;t share reviewers&apos; contact details. Reply publicly from the Reviews inbox and invite them to get in touch directly.</p>
            : <p>The customer didn&apos;t leave a phone number or email, so there&apos;s no way to reach them directly.</p>}
        </div>
      </Section>
    );
  }
  const chip = (label: string, on: boolean | undefined) => (
    <Badge key={label} size="sm" variant={on ? "success" : "outline"} mono>{on ? "✓" : "–"} {label}</Badge>
  );
  const disabled = !k.can_contact;
  const reason = k.opted_out ? "This customer has opted out of messages." : "No consent to contact was recorded for this customer.";
  return (
    <Section index={index} label="Customer contact">
      <div className="space-y-3 rounded-lg border border-border bg-background-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">{k.name ?? "Customer"}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11.5px] text-muted-foreground">
              {k.phone && <span>{k.phone}</span>}
              {k.email && <span className="break-all">{k.email}</span>}
            </p>
          </div>
          {k.customer_id && <Button asChild variant="link" size="xs" className="h-auto"><Link href={`/app/customers/${k.customer_id}`}>Customer profile <ArrowUpRight /></Link></Button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip("Asked to be contacted", k.consent_contact)}
          {chip("WhatsApp", k.consents.whatsapp)}
          {chip("Email", k.consents.email)}
          {k.opted_out && <Badge size="sm" variant="danger" mono>Opted out</Badge>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {k.phone && (
            <Button asChild={!disabled} variant="outline" size="sm" disabled={disabled}>
              {disabled ? <span><Phone /> Call</span> : <a href={`tel:${k.phone}`}><Phone /> Call</a>}
            </Button>
          )}
          {k.phone && (
            <Button asChild={!disabled} variant="outline" size="sm" disabled={disabled}>
              {disabled ? <span><MessageCircle /> WhatsApp</span> : <a href={waLink(k.phone, k.suggested_message)} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp chat</a>}
            </Button>
          )}
          {k.email && (
            <Button asChild={!disabled} variant="outline" size="sm" disabled={disabled}>
              {disabled ? <span><Mail /> Email</span> : <a href={`mailto:${k.email}?subject=${encodeURIComponent("About your recent visit")}&body=${encodeURIComponent(k.suggested_email)}`}><Mail /> Email</a>}
            </Button>
          )}
        </div>
        {disabled ? (
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><Lock className="size-3.5 shrink-0" />{reason} Only reach out if they ask you to.</p>
        ) : (
          <details className="group text-[12px] text-muted-foreground">
            <summary className="cursor-pointer select-none font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground hover:text-foreground">Suggested opening message</summary>
            <p className="mt-2 rounded-md border border-border bg-card p-3 leading-relaxed text-foreground-soft">{k.suggested_message}</p>
          </details>
        )}
      </div>
    </Section>
  );
}

function PolicyNote({ text }: { text: string }) {
  if (!text || !policyIssue(text)) return null;
  return <p className="text-xs font-medium text-danger-foreground" role="alert">{POLICY_HINT} Please rephrase.</p>;
}

function OutreachForm({ index, caseId, first, onDone, onError }: { index: string; caseId: string; first: boolean; onDone: (c: CaseDetail) => void; onError: (e: unknown) => void }) {
  const [channel, setChannel] = React.useState<ContactChannel>("call");
  const [outcome, setOutcome] = React.useState<ContactOutcome>("reached");
  const [note, setNote] = React.useState("");
  const log = useMutation({
    mutationFn: () => api.post<CaseDetail>(`/recovery/${caseId}/contact`, { channel, outcome, note: note.trim() || null }),
    onSuccess: (d) => { onDone(d); setNote(""); toast.success(first ? "First response logged — SLA clock stopped" : "Outreach logged"); },
    onError,
  });
  return (
    <Section index={index} label="Log outreach">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); log.mutate(); }}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented id={`ch-${caseId}`} ariaLabel="Outreach channel" size="sm" value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c.value, label: c.label, icon: CHANNEL_ICON[c.value] }))} />
          <Select value={outcome} onValueChange={(v) => setOutcome(v as ContactOutcome)}>
            <SelectTrigger size="sm" className="w-full sm:w-[190px]" aria-label="Outcome"><SelectValue /></SelectTrigger>
            <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="What happened? e.g. Apologised for the wait and asked what we could do better." aria-label="Outreach note" invalid={policyIssue(note)} className="min-h-16" />
        <PolicyNote text={note} />
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{first ? "First outreach stops the SLA clock" : "Adds to the outreach log"}</p>
          <Button type="submit" size="sm" loading={log.isPending} disabled={policyIssue(note)}><PhoneCall /> Log outreach</Button>
        </div>
      </form>
    </Section>
  );
}

function NoteForm({ index, caseId, onDone, onError }: { index: string; caseId: string; onDone: (c: CaseDetail) => void; onError: (e: unknown) => void }) {
  const [note, setNote] = React.useState("");
  const add = useMutation({
    mutationFn: () => api.post<CaseDetail>(`/recovery/${caseId}/notes`, { note: note.trim() }),
    onSuccess: (d) => { onDone(d); setNote(""); toast.success("Note added"); },
    onError,
  });
  return (
    <Section index={index} label="Internal note">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) add.mutate(); }}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Visible to your team only." aria-label="Internal note" invalid={policyIssue(note)} className="min-h-16" />
        <PolicyNote text={note} />
        <div className="flex justify-end">
          <Button type="submit" variant="outline" size="sm" loading={add.isPending} disabled={!note.trim() || policyIssue(note)}><NotebookPen /> Add note</Button>
        </div>
      </form>
    </Section>
  );
}

function Resolution({ index, c, onDone, onError }: { index: string; c: CaseDetail; onDone: (c: CaseDetail) => void; onError: (e: unknown) => void }) {
  const [resolution, setResolution] = React.useState<Resolution>("resolved_happy");
  const [note, setNote] = React.useState("");
  const resolve = useMutation({
    mutationFn: () => api.post<CaseDetail>(`/recovery/${c.id}/resolve`, { resolution, note: note.trim() || null }),
    onSuccess: (d) => { onDone(d); setNote(""); toast.success("Case resolved"); },
    onError,
  });
  const reopen = useMutation({
    mutationFn: () => api.post<CaseDetail>(`/recovery/${c.id}/reopen`, {}),
    onSuccess: (d) => { onDone(d); toast.success("Case reopened"); },
    onError,
  });
  if (c.status === "resolved" || c.status === "closed") {
    const r = RESOLUTIONS.find((x) => x.value === c.resolution);
    return (
      <Section index={index} label="Resolution">
        <InlineAlert
          variant={c.status === "resolved" ? "success" : "info"}
          icon={CheckCircle2}
          title={r?.label ?? (c.status === "closed" ? "Closed" : "Resolved")}
          action={
            <ConfirmDialog
              title="Reopen this case?"
              description="It returns to the active queue with a fresh follow-up deadline."
              confirmLabel="Reopen case"
              onConfirm={async () => { await reopen.mutateAsync().catch(() => undefined); }}
              trigger={<Button variant="outline" size="xs"><RotateCcw /> Reopen</Button>}
            />
          }
        >
          {c.resolved_at && `Closed ${formatDistanceToNowStrict(new Date(c.resolved_at), { addSuffix: true })}.`}
        </InlineAlert>
      </Section>
    );
  }
  return (
    <Section index={index} label="Resolve">
      <form className="space-y-2.5" onSubmit={(e) => { e.preventDefault(); resolve.mutate(); }}>
        <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
          <SelectTrigger size="sm" aria-label="Resolution"><SelectValue /></SelectTrigger>
          <SelectContent>{RESOLUTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-[12px] text-muted-foreground">{RESOLUTIONS.find((r) => r.value === resolution)?.hint}</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="How was it resolved? (optional)" aria-label="Resolution note" invalid={policyIssue(note)} className="min-h-16" />
        <PolicyNote text={note} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={resolve.isPending} disabled={policyIssue(note)}><ShieldCheck /> Resolve case</Button>
        </div>
      </form>
    </Section>
  );
}

function Timeline({ index, entries }: { index: string; entries: TimelineEntry[] }) {
  return (
    <Section index={index} label={`Timeline · ${entries.length}`}>
      <ol className="relative">
        {[...entries].reverse().map((h, i, arr) => {
          const at = new Date(h.at);
          return (
            <li key={i} className="relative grid grid-cols-[78px_14px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
              <div className="pt-px text-right">
                <MonoTime className="block text-foreground-soft">{format(at, "dd MMM yy")}</MonoTime>
                <MonoTime className="block">{format(at, "HH:mm")}</MonoTime>
              </div>
              <div className="relative flex justify-center">
                {i < arr.length - 1 && <span aria-hidden className="absolute top-3 h-[calc(100%+4px)] w-px bg-border" />}
                <StatusDot tone={EVENT_TONE[h.event] ?? "signal"} className="mt-1" />
              </div>
              <div className="min-w-0 text-[12.5px]">
                <p className="font-medium text-foreground">
                  {EVENT_LABEL[h.event] ?? titleCase(h.event)}
                  {h.channel ? <span className="font-normal text-muted-foreground"> · {CHANNELS.find((x) => x.value === h.channel)?.label}</span> : null}
                  <span className="font-normal text-muted-foreground"> · {h.by}</span>
                </p>
                {h.note && <p className={cn("mt-0.5 break-words", h.event === "sla_breached" || h.event === "whatsapp_alert_failed" ? "text-danger-foreground" : "text-muted-foreground")}>{h.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
