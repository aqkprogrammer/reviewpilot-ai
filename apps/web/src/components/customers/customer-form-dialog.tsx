"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LANGUAGES, type Customer } from "./types";

const schema = z
  .object({
    name: z.string().max(200).optional(),
    email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
    phone: z
      .string()
      .optional()
      .refine((v) => !v || /^\+?[0-9 ()-]{8,20}$/.test(v), "Enter a valid phone number"),
    location_id: z.string().optional(),
    tags: z.string().optional(),
    notes: z.string().max(5000).optional(),
    preferred_language: z.enum(["en", "hi", "hinglish"]),
    whatsapp: z.boolean(),
    email_consent: z.boolean(),
    sms: z.boolean(),
  })
  .refine((v) => !!(v.email || v.phone), { message: "Add an email or phone number", path: ["phone"] });

type Values = z.infer<typeof schema>;

export function CustomerFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { locations, locationId } = useOrg();
  const qc = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", location_id: locationId ?? "", tags: "", notes: "", preferred_language: "en", whatsapp: false, email_consent: false, sms: false },
  });
  const { register, handleSubmit, formState, watch, setValue, reset } = form;
  const anyConsent = watch("whatsapp") || watch("email_consent") || watch("sms");

  const create = useMutation({
    mutationFn: (v: Values) =>
      api.post<Customer>("/customers", {
        name: v.name || null,
        email: v.email || null,
        phone: v.phone || null,
        location_id: v.location_id || null,
        tags: (v.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        notes: v.notes || null,
        preferred_language: v.preferred_language,
        consent: anyConsent ? { whatsapp: v.whatsapp, email: v.email_consent, sms: v.sms, source: "manual" } : null,
      }),
    onSuccess: (c) => {
      toast.success(`${c.name ?? "Customer"} added`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>Store contact details so you can send review requests. Only record consent the customer actually gave you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="c-name">
              <Input id="c-name" placeholder="Priya Sharma" {...register("name")} />
            </FormField>
            <FormField label="Preferred language">
              <Select value={watch("preferred_language")} onValueChange={(v) => setValue("preferred_language", v as Values["preferred_language"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Email" htmlFor="c-email" error={formState.errors.email?.message}>
              <Input id="c-email" type="email" placeholder="priya@example.com" invalid={!!formState.errors.email} {...register("email")} />
            </FormField>
            <FormField label="Phone" htmlFor="c-phone" error={formState.errors.phone?.message} hint="Include country code, e.g. +91 98765 43210">
              <Input id="c-phone" className="font-mono" inputMode="tel" placeholder="+91 98765 43210" invalid={!!formState.errors.phone} {...register("phone")} />
            </FormField>
            <FormField label="Location">
              <Select value={watch("location_id") || "none"} onValueChange={(v) => setValue("location_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific location</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tags" htmlFor="c-tags" hint="Comma separated">
              <Input id="c-tags" placeholder="regular, vip" {...register("tags")} />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="c-notes">
            <Textarea id="c-notes" rows={2} placeholder="Anything the team should know" {...register("notes")} />
          </FormField>
          <fieldset className="overflow-hidden rounded-lg border border-border">
            <legend className="sr-only">Messaging consent</legend>
            <div className="flex items-start gap-3 border-b border-border bg-background-subtle/70 px-4 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">Messaging consent</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Tick a channel only if this customer agreed to receive service messages on it. Collecting a phone number for a booking is not consent.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border">
              {([["whatsapp", "WhatsApp", "WA"], ["email_consent", "Email", "EM"], ["sms", "SMS", "SMS"]] as const).map(([k, label, short]) => {
                const on = watch(k);
                return (
                  <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[13px] transition-colors", on ? "bg-mint-soft/60" : "hover:bg-surface-hover")}>
                    <Checkbox checked={on} onCheckedChange={(c) => setValue(k, c === true)} />
                    <span className="min-w-0">
                      <span className="block font-medium">{label}</span>
                      <span className={cn("font-mono text-[9.5px] uppercase tracking-[0.1em]", on ? "text-mint" : "text-subtle-foreground")}>{short} · {on ? "granted" : "off"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Add customer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
