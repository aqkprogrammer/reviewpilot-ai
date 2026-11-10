"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { type IngestResult, SKIP_LABELS, automationKeys, fmtDateTime } from "./types";

function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const CONSENTS = [["whatsapp", "WhatsApp", "WA"], ["email", "Email", "EM"], ["sms", "SMS", "SMS"]] as const;

export function RecordVisitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { locations, locationId: activeLocation } = useOrg();
  const qc = useQueryClient();
  const [loc, setLoc] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [when, setWhen] = React.useState(localNow);
  const [maxWhen, setMaxWhen] = React.useState(localNow);
  const [receipt, setReceipt] = React.useState("");
  const [consent, setConsent] = React.useState({ whatsapp: false, email: false, sms: false });
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoc(activeLocation ?? locations[0]?.id ?? "");
    setName(""); setPhone(""); setEmail(""); setReceipt(""); setNote("");
    const t = localNow();
    setWhen(t);
    setMaxWhen(t);
    setConsent({ whatsapp: false, email: false, sms: false });
    setTouched(false);
  }, [open, activeLocation, locations]);

  const phoneError = phone && !/^\+?[0-9 ()-]{8,20}$/.test(phone) ? "Enter a valid phone number" : undefined;
  const emailError = email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email" : undefined;
  const contactError = !phone.trim() && !email.trim() ? "Add a phone number or email" : undefined;
  const whenError = when && when > maxWhen ? "Visit time can't be in the future" : undefined;
  const consentMismatch = (consent.whatsapp || consent.sms) && !phone.trim() ? "WhatsApp/SMS consent needs a phone number" : consent.email && !email.trim() ? "Email consent needs an email address" : undefined;
  const invalid = !loc || !!(phoneError || emailError || contactError || whenError || consentMismatch);
  const anyConsent = consent.whatsapp || consent.email || consent.sms;

  const record = useMutation({
    mutationFn: () =>
      api.post<IngestResult>("/automations/visits", {
        location_id: loc,
        customer: { name: name.trim() || null, phone: phone.trim() || null, email: email.trim() || null },
        occurred_at: when ? new Date(when).toISOString() : null,
        external_id: receipt.trim() || null,
        consent: anyConsent ? { ...consent, note: note.trim() || null } : null,
      }),
    onSuccess: (r) => {
      if (r.duplicate) toast.info("That receipt/booking number was already recorded — nothing changed.");
      else if (r.status === "scheduled") toast.success(`Visit recorded · review request scheduled for ${fmtDateTime(r.scheduled_for)}`);
      else if (r.status === "sent") toast.success("Visit recorded · review request sent");
      else toast.info(`Visit recorded · not sent: ${SKIP_LABELS[r.skip_reason ?? ""] ?? r.skip_reason ?? r.status}`);
      qc.invalidateQueries({ queryKey: automationKeys.all });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Record a visit</DialogTitle>
          <DialogDescription>The matching automation rule decides when — and whether — a review request goes out. Existing customers are matched by phone or email.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!invalid) record.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Location" required>
              <Select value={loc || undefined} onValueChange={setLoc}>
                <SelectTrigger aria-label="Location"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Visit time" htmlFor="visit-when" error={whenError}>
              <Input id="visit-when" type="datetime-local" className="font-mono" value={when} max={maxWhen} onChange={(e) => setWhen(e.target.value)} invalid={!!whenError} />
            </FormField>
            <FormField label="Customer name" htmlFor="visit-name">
              <Input id="visit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" maxLength={200} />
            </FormField>
            <FormField label="Phone" htmlFor="visit-phone" error={(touched && (phoneError ?? contactError)) || undefined} hint="Include country code">
              <Input id="visit-phone" className="font-mono" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" invalid={touched && !!(phoneError || contactError)} />
            </FormField>
            <FormField label="Email" htmlFor="visit-email" error={(touched && emailError) || undefined}>
              <Input id="visit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" invalid={touched && !!emailError} />
            </FormField>
            <FormField label="Receipt / booking no." htmlFor="visit-ref" hint="Optional — prevents recording the same visit twice">
              <Input id="visit-ref" className="font-mono" value={receipt} onChange={(e) => setReceipt(e.target.value)} maxLength={160} placeholder="INV-10423" />
            </FormField>
          </div>
          <fieldset className="overflow-hidden rounded-lg border border-border">
            <legend className="sr-only">Consent given at this visit</legend>
            <div className="flex items-start gap-3 border-b border-border bg-background-subtle/70 px-4 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="block text-[13px] font-semibold text-foreground">Did the customer agree to a feedback message?</span>
                Tick a channel only if they said yes today. It&apos;s recorded with your name as evidence. Leave all unticked to rely on consent already on file.
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {CONSENTS.map(([k, label, short]) => {
                const on = consent[k];
                return (
                  <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-3 text-[13px] transition-colors sm:px-4", on ? "bg-mint-soft/60" : "hover:bg-surface-hover")}>
                    <Checkbox checked={on} onCheckedChange={(c) => setConsent((s) => ({ ...s, [k]: c === true }))} aria-label={`${label} consent`} />
                    <span className="min-w-0">
                      <span className="block font-medium">{label}</span>
                      <span className={cn("font-mono text-[9.5px] uppercase tracking-[0.1em]", on ? "text-mint" : "text-subtle-foreground")}>{short} · {on ? "granted" : "off"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {anyConsent && (
              <div className="border-t border-border px-4 py-3">
                <Input aria-label="Consent note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note, e.g. “Agreed at checkout”" />
              </div>
            )}
          </fieldset>
          {touched && consentMismatch && <p className="text-xs font-medium text-danger-foreground" role="alert">{consentMismatch}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={record.isPending} disabled={!locations.length}>Record visit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
