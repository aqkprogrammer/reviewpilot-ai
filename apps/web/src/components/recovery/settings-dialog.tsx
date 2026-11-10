"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Plus, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/tech";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import type { RecoverySettings, Severity } from "./types";

const E164 = /^\+[1-9]\d{7,14}$/;
const clean = (v: string) => v.replace(/[\s().-]/g, "");

export function RecoverySettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { orgId } = useOrg();
  const q = useQuery({ queryKey: ["recovery", "settings", orgId], queryFn: () => api.get<RecoverySettings>("/recovery/settings"), enabled: open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <p className="micro-label flex items-center gap-2"><Settings2 className="size-3.5 text-primary" /> Recovery · Rules & alerts</p>
          <DialogTitle>Recovery settings</DialogTitle>
          <DialogDescription>When cases open automatically, how fast your team must respond, and who gets a WhatsApp alert.</DialogDescription>
        </DialogHeader>
        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <div className="space-y-3" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-24" /><Skeleton className="h-20" /></div>
        ) : (
          <SettingsForm key={JSON.stringify(q.data)} initial={q.data} onSaved={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ initial, onSaved }: { initial: RecoverySettings; onSaved: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [s, setS] = React.useState<RecoverySettings>(initial);
  const [draftNumber, setDraftNumber] = React.useState("");
  const [numberError, setNumberError] = React.useState<string | null>(null);
  const set = <K extends keyof RecoverySettings>(k: K, v: RecoverySettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const setSla = (k: Severity, v: string) => setS((x) => ({ ...x, sla_hours: { ...x.sla_hours, [k]: Number(v) || 0 } }));

  const slaError = (() => {
    const { critical, high, medium } = s.sla_hours;
    if ([critical, high, medium].some((h) => !Number.isInteger(h) || h < 1)) return "SLA hours must be whole numbers of at least 1.";
    if (critical > 168 || high > 336 || medium > 720) return "Keep SLAs within 7 / 14 / 30 days.";
    if (!(critical <= high && high <= medium)) return "SLA hours should increase from critical to high to medium.";
    return null;
  })();
  const ageError = s.review_max_age_days < 1 || s.review_max_age_days > 90 ? "Between 1 and 90 days." : null;

  const addNumber = () => {
    const num = clean(draftNumber);
    if (!num) return;
    if (!E164.test(num)) return setNumberError("Use international format, e.g. +919876543210");
    if (s.alert_whatsapp.includes(num)) return setNumberError("That number is already on the list");
    if (s.alert_whatsapp.length >= 5) return setNumberError("Up to 5 alert numbers");
    set("alert_whatsapp", [...s.alert_whatsapp, num]);
    setDraftNumber("");
    setNumberError(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const body: Partial<RecoverySettings> = { ...s };
      delete body.whatsapp_channel;
      return api.put<RecoverySettings>("/recovery/settings", body);
    },
    onSuccess: (d) => {
      qc.setQueryData(["recovery", "settings", orgId], d);
      toast.success("Recovery settings saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof ApiError && e.code === "validation_error" ? "Check the highlighted fields." : errorMessage(e)),
  });

  const ch = s.whatsapp_channel;
  const ratingOptions = [1, 2, 3, 4];
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (!slaError && !ageError) save.mutate(); }}>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background-subtle px-4 py-3">
        <div>
          <p className="text-[13.5px] font-medium">Open cases automatically</p>
          <p className="text-[12px] text-muted-foreground">Manual cases can always be opened from a review or feedback.</p>
        </div>
        <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="Open cases automatically" />
      </div>

      <fieldset className="space-y-3" disabled={!s.enabled}>
        <legend className="micro-label mb-2">01 — Auto-open rules</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Google reviews at or below" htmlFor="rv-th" hint="Sample/demo reviews never open cases.">
            <Select value={String(s.review_max_rating)} onValueChange={(v) => set("review_max_rating", Number(v))}>
              <SelectTrigger id="rv-th"><SelectValue /></SelectTrigger>
              <SelectContent>{ratingOptions.map((r) => <SelectItem key={r} value={String(r)}>{r}★</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Private feedback at or below" htmlFor="fb-th">
            <Select value={String(s.feedback_max_rating)} onValueChange={(v) => set("feedback_max_rating", Number(v))}>
              <SelectTrigger id="fb-th"><SelectValue /></SelectTrigger>
              <SelectContent>{ratingOptions.map((r) => <SelectItem key={r} value={String(r)}>{r}★</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="Ignore Google reviews older than (days)" htmlFor="age" error={ageError ?? undefined} hint="Stops a first sync from opening cases for old history.">
            <Input id="age" type="number" min={1} max={90} value={s.review_max_age_days} onChange={(e) => set("review_max_age_days", Number(e.target.value))} invalid={!!ageError} />
          </FormField>
          <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border px-3.5 py-2.5">
            <span className="text-[13px]">Also open for feedback classified negative</span>
            <Switch checked={s.feedback_negative} onCheckedChange={(v) => set("feedback_negative", v)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="micro-label mb-2">02 — First-response SLA (hours)</legend>
        <div className="grid grid-cols-3 gap-3">
          {(["critical", "high", "medium"] as Severity[]).map((k) => (
            <FormField key={k} label={k === "critical" ? "Critical · 1★" : k === "high" ? "High · 2★ / negative" : "Medium"} htmlFor={`sla-${k}`}>
              <Input id={`sla-${k}`} type="number" min={1} inputMode="numeric" value={s.sla_hours[k] || ""} onChange={(e) => setSla(k, e.target.value)} invalid={!!slaError} className="font-mono" />
            </FormField>
          ))}
        </div>
        {slaError && <p className="text-xs font-medium text-danger-foreground" role="alert">{slaError}</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="micro-label mb-2">03 — WhatsApp owner alerts</legend>
        {ch && (
          <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
            <StatusDot tone={ch.mode === "live" ? "ok" : ch.mode === "simulated" ? "warn" : "idle"} />
            {ch.mode === "live" ? "WhatsApp connected · alerts are sent" : ch.mode === "simulated" ? "Demo mode · alerts are simulated, nothing is sent" : "WhatsApp not connected · alerts will be skipped"}
          </p>
        )}
        {ch?.mode === "unavailable" && (
          <InlineAlert variant="info" icon={MessageCircle} title="Connect WhatsApp to alert owners">
            Without a WhatsApp connection, alerts still arrive in-app and by email. <Link href="/app/integrations" className="font-medium text-primary underline">Go to Integrations</Link>
          </InlineAlert>
        )}
        <div className="flex gap-2">
          <Input value={draftNumber} onChange={(e) => { setDraftNumber(e.target.value); setNumberError(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNumber(); } }} placeholder="+919876543210" aria-label="Alert number" invalid={!!numberError} className="font-mono" inputMode="tel" />
          <Button type="button" variant="outline" onClick={addNumber} disabled={!draftNumber.trim()}><Plus /> Add</Button>
        </div>
        {numberError && <p className="text-xs font-medium text-danger-foreground" role="alert">{numberError}</p>}
        {s.alert_whatsapp.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Alert numbers">
            {s.alert_whatsapp.map((n) => (
              <li key={n} className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-border-strong bg-background-subtle pl-2.5 pr-1 font-mono text-[12px] tabular">
                {n}
                <button type="button" onClick={() => set("alert_whatsapp", s.alert_whatsapp.filter((x) => x !== n))} className="rounded-[3px] p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground" aria-label={`Remove ${n}`}><X className="size-3" /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted-foreground">No numbers yet — alerts go to the team in-app and by email only.</p>
        )}
        <FormField label="Approved template name" htmlFor="tpl" hint="Business-initiated WhatsApp messages must use a template approved by Meta.">
          <Input id="tpl" value={s.whatsapp_template} onChange={(e) => set("whatsapp_template", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} className="font-mono" maxLength={128} />
        </FormField>
      </fieldset>

      <DialogFooter className="mt-2">
        <Button type="submit" loading={save.isPending} disabled={!!slaError || !!ageError || !s.whatsapp_template}>Save settings</Button>
      </DialogFooter>
    </form>
  );
}
