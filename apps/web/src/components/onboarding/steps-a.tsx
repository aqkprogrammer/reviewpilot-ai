"use client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Building2, CircleCheck, ExternalLink, Globe, Link2, MapPin, MessageSquareText, Phone, Sparkles, Store } from "lucide-react";
import { INDUSTRIES } from "@reviewpilot/shared-types";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { api, errorMessage, setActiveOrgId } from "@/lib/api";
import type { Location } from "@/lib/types";
import { COUNTRIES } from "@/components/auth/auth-utils";
import { StepFooter, StepHeader } from "./ui";
import type { OrgFull, WizardCtx } from "./types";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Kathmandu", "Asia/Colombo", "Asia/Riyadh", "Europe/London", "Europe/Berlin", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Australia/Sydney"];

// ------------------------------------------------------------------ 1. Welcome

export function WelcomeStep({ ctx }: { ctx: WizardCtx }) {
  const first = ctx.me.user.full_name.split(" ")[0];
  const items = [
    { icon: Store, title: "Your business & first location", body: "So every review request and feedback page carries your name and brand." },
    { icon: GoogleIcon, title: "Google review link", body: "Connect Business Profile, or paste your review link — takes a minute." },
    { icon: WhatsAppIcon, title: "How you'll ask for reviews", body: "Table-card QR codes, WhatsApp and email — to every customer, equally." },
    { icon: Sparkles, title: "AI replies & insights", body: "Draft replies in English, Hindi or Hinglish. Nothing is published without your approval." },
  ];
  return (
    <div>
      <StepHeader step={1} title={`Welcome, ${first}. Let's get you collecting reviews.`} description="About five minutes. Every integration can be skipped and finished later — your progress saves after each step." />
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-md border border-border bg-background-subtle text-primary"><it.icon className="size-5" /></span>
              <span className="font-mono text-[10px] tracking-[0.12em] text-subtle-foreground">{`M.0${i + 1}`}</span>
            </div>
            <p className="mt-5 text-[14.5px] font-semibold">{it.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
      <InlineAlert variant="primary" icon={MessageSquareText} className="mt-6">
        ReviewPilot never filters who gets asked for a Google review. Every customer gets the same chance to share an honest opinion.
      </InlineAlert>
      <StepFooter primary={<Button size="lg" onClick={() => ctx.next()}>Let&apos;s begin <ArrowRight /></Button>} />
    </div>
  );
}

// ------------------------------------------------------------------ 2. Business details

const bizSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(160),
  industry: z.string().min(1, "Choose a category"),
  description: z.string().trim().max(2000).optional(),
  website: z.string().trim().max(512).refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/.test(v), "Use a full URL, e.g. https://yourbusiness.in").optional(),
  phone: z.string().trim().max(32).refine((v) => !v || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number").optional(),
  country: z.string().length(2),
  address: z.string().trim().max(1000).optional(),
  timezone: z.string().min(1),
});
type Biz = z.infer<typeof bizSchema>;

export function BusinessStep({ ctx }: { ctx: WizardCtx }) {
  const o = ctx.org;
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Biz>({
    resolver: zodResolver(bizSchema),
    defaultValues: {
      name: o?.name ?? "", industry: o?.industry ?? "", description: o?.description ?? "", website: o?.website ?? "",
      phone: o?.phone ?? ctx.me.user.phone ?? "", country: o?.country ?? "IN", address: o?.address ?? "", timezone: o?.timezone ?? "Asia/Kolkata",
    },
  });
  const onSubmit = async (v: Biz) => {
    try {
      let org = o;
      if (!org) {
        org = await api.post<OrgFull>("/organizations", { name: v.name, industry: v.industry, country: v.country, phone: v.phone || null }, { orgId: null });
        setActiveOrgId(org.id);
        ctx.setOrg(org);
      }
      const updated = await api.patch<OrgFull>(
        "/organizations/current",
        { name: v.name, industry: v.industry, description: v.description || null, website: v.website || null, phone: v.phone || null, country: v.country, address: v.address || null, timezone: v.timezone },
        { orgId: org.id },
      );
      ctx.setOrg(updated);
      await ctx.next({ business: { completed: true } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <StepHeader step={2} icon={Building2} title="Tell us about your business" description="This appears on your feedback page, QR cards and review requests." />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Business name" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
          <Input id="name" autoComplete="organization" invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Category" htmlFor="industry" error={errors.industry?.message} required>
          <Controller control={control} name="industry" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="industry" aria-invalid={!!errors.industry}><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Business phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" leading={<Phone />} placeholder="+91 98765 43210" invalid={!!errors.phone} {...register("phone")} />
        </FormField>
        <FormField label="Website" htmlFor="website" error={errors.website?.message}>
          <Input id="website" type="url" autoComplete="url" leading={<Globe />} placeholder="https://" invalid={!!errors.website} {...register("website")} />
        </FormField>
        <FormField label="Country" htmlFor="country">
          <Controller control={control} name="country" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="country"><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Address" htmlFor="address" className="sm:col-span-2">
          <Input id="address" autoComplete="street-address" placeholder="Head office address" {...register("address")} />
        </FormField>
        <FormField label="Time zone" htmlFor="timezone">
          <Controller control={control} name="timezone" render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Short description" htmlFor="description" hint="Optional — helps the AI write replies that sound like you." className="sm:col-span-2">
          <Textarea id="description" rows={3} placeholder="Family-run North Indian restaurant known for our tandoor and warm service." {...register("description")} />
        </FormField>
      </div>
      <StepFooter onBack={ctx.back} primary={<Button type="submit" size="lg" loading={isSubmitting}>Save & continue <ArrowRight /></Button>} />
    </form>
  );
}

// ------------------------------------------------------------------ 3. Location

const locSchema = z.object({
  name: z.string().trim().min(2, "Name this location").max(160),
  address_line: z.string().trim().max(300).optional(),
  city: z.string().trim().min(2, "Enter the city").max(120),
  state: z.string().trim().max(120).optional(),
  postal_code: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(32).optional(),
});
type Loc = z.infer<typeof locSchema>;

export function LocationStep({ ctx }: { ctx: WizardCtx }) {
  const [adding, setAdding] = React.useState(ctx.locations.length === 0);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Loc>({
    resolver: zodResolver(locSchema),
    defaultValues: { name: ctx.org?.name ?? "", address_line: "", city: "", state: "", postal_code: "", phone: ctx.org?.phone ?? "" },
  });
  const onSubmit = async (v: Loc) => {
    try {
      await api.post<Location>("/locations", { ...v, country: ctx.org?.country ?? "IN", timezone: ctx.org?.timezone ?? "Asia/Kolkata", phone: v.phone || null });
      await ctx.refreshLocations();
      toast.success("Location added");
      reset({ name: "", address_line: "", city: "", state: "", postal_code: "", phone: "" });
      setAdding(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div>
      <StepHeader step={3} icon={MapPin} title="Add your first location" description="Each location gets its own feedback page, QR codes and review link. You can add more later (plan limits apply)." />
      {ctx.locations.length > 0 && (
        <ul className="mb-6 space-y-2">
          {ctx.locations.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-md border border-[color-mix(in_oklab,var(--mint)_28%,transparent)] bg-mint-soft text-mint"><CircleCheck className="size-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{l.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[l.address_line, l.city, l.state].filter(Boolean).join(", ") || "No address"}</p>
              </div>
              <span className="hidden font-mono text-[11px] text-subtle-foreground sm:block">/r/{l.slug}</span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-border bg-card/60 p-5 hairline-top">
          <p className="micro-label mb-4">{ctx.locations.length ? "Add another location" : "Location 01"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Location name" htmlFor="loc-name" error={errors.name?.message} required hint="e.g. “Bandra West” or your business name" className="sm:col-span-2">
              <Input id="loc-name" invalid={!!errors.name} {...register("name")} />
            </FormField>
            <FormField label="Street address" htmlFor="loc-addr" className="sm:col-span-2">
              <Input id="loc-addr" autoComplete="address-line1" {...register("address_line")} />
            </FormField>
            <FormField label="City" htmlFor="loc-city" error={errors.city?.message} required>
              <Input id="loc-city" autoComplete="address-level2" invalid={!!errors.city} {...register("city")} />
            </FormField>
            <FormField label="State" htmlFor="loc-state">
              <Input id="loc-state" autoComplete="address-level1" {...register("state")} />
            </FormField>
            <FormField label="PIN / postal code" htmlFor="loc-pin">
              <Input id="loc-pin" autoComplete="postal-code" inputMode="numeric" {...register("postal_code")} />
            </FormField>
            <FormField label="Location phone" htmlFor="loc-phone">
              <Input id="loc-phone" type="tel" autoComplete="tel" {...register("phone")} />
            </FormField>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            {ctx.locations.length > 0 && <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>}
            <Button type="submit" variant={ctx.locations.length ? "outline" : "primary"} loading={isSubmitting}>Add location</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}><MapPin /> Add another location</Button>
      )}
      <StepFooter
        onBack={ctx.back}
        onSkip={ctx.locations.length === 0 ? () => ctx.next({ location: { skipped: true } }) : undefined}
        primary={<Button size="lg" disabled={ctx.locations.length === 0} onClick={() => ctx.next({ location: { count: ctx.locations.length } })}>Continue <ArrowRight /></Button>}
      />
    </div>
  );
}

// ------------------------------------------------------------------ 4. Google

interface GoogleStatus { platform_configured: boolean; status: string; email: string | null; last_error: string | null }

export function GoogleStep({ ctx }: { ctx: WizardCtx }) {
  const [status, setStatus] = React.useState<GoogleStatus | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [urls, setUrls] = React.useState<Record<string, string>>(() => Object.fromEntries(ctx.locations.map((l) => [l.id, l.google_review_url ?? ""])));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.get<GoogleStatus>("/integrations/google").then(setStatus).catch(() => setStatus({ platform_configured: false, status: "not_connected", email: null, last_error: null }));
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      await api.put("/onboarding", { step: 4, data: { google: { connect_started: true } } });
      const { url } = await api.post<{ url: string }>("/integrations/google/connect");
      window.location.href = url;
    } catch (err) {
      toast.error(errorMessage(err));
      setConnecting(false);
    }
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    for (const l of ctx.locations) {
      const v = (urls[l.id] ?? "").trim();
      if (v && !/^https:\/\//.test(v)) errs[l.id] = "Link must start with https://";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      for (const l of ctx.locations) {
        const v = (urls[l.id] ?? "").trim();
        if (v !== (l.google_review_url ?? "")) {
          try {
            await api.patch(`/locations/${l.id}`, { google_review_url: v || null });
          } catch (err) {
            setErrors((e) => ({ ...e, [l.id]: errorMessage(err) }));
            setSaving(false);
            return;
          }
        }
      }
      await ctx.refreshLocations();
      await ctx.next({ google: { manual_links: Object.values(urls).filter(Boolean).length, status: status?.status } });
    } finally {
      setSaving(false);
    }
  };

  const connected = status?.status === "connected";
  return (
    <div>
      <StepHeader step={4} icon={GoogleIcon} title="Connect Google reviews" description="Sync your Google reviews and reply from ReviewPilot — or simply add your Google review link so customers can reach it in one tap." />

      <div className="rounded-lg border border-border bg-card p-5 hairline-top">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-md border border-border bg-background-subtle"><GoogleIcon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold">Google Business Profile</p>
              {status && <StatusBadge status={status.platform_configured ? status.status : "not_configured"} />}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {status?.platform_configured
                ? "Uses Google's official Business Profile API. Google must approve API access for this project, so syncing may show “pending authorization” at first."
                : "Google OAuth isn't configured on this server yet, so connecting is unavailable. Your manual review link below works without it."}
            </p>
            {connected && status?.email && <p className="mt-2 text-xs text-success-foreground">Connected as {status.email}</p>}
            {status?.last_error && <p className="mt-2 text-xs text-warning-foreground">{status.last_error}</p>}
          </div>
          <Button variant={connected ? "outline" : "primary"} disabled={!status?.platform_configured} loading={connecting} onClick={connect}>
            {connected ? "Reconnect" : "Connect Google"}
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          <p className="text-[14px] font-semibold">Google review link</p>
          <Badge variant="outline" size="sm">Works without API access</Badge>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          In Google Business Profile (search your business name on Google while signed in), choose <span className="font-medium text-foreground">Ask for reviews</span> and copy the link — it looks like <span className="font-mono text-[12px]">g.page/r/…/review</span>.
        </p>
        {ctx.locations.length === 0 ? (
          <InlineAlert variant="warning" icon={MapPin} className="mt-4">Add a location first to save its review link. You can do it later from Locations.</InlineAlert>
        ) : (
          <div className="mt-4 space-y-3">
            {ctx.locations.map((l) => (
              <FormField key={l.id} label={l.name} htmlFor={`g-${l.id}`} error={errors[l.id]}>
                <Input id={`g-${l.id}`} type="url" placeholder="https://g.page/r/…/review" value={urls[l.id] ?? ""} onChange={(e) => setUrls((u) => ({ ...u, [l.id]: e.target.value }))} invalid={!!errors[l.id]}
                  trailing={urls[l.id] ? <a href={urls[l.id]} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-subtle-foreground hover:bg-muted hover:text-foreground" aria-label="Open link"><ExternalLink className="size-4" /></a> : undefined} />
              </FormField>
            ))}
          </div>
        )}
      </div>
      <StepFooter onBack={ctx.back} onSkip={() => ctx.next({ google: { skipped: true } })} primary={<Button size="lg" loading={saving} onClick={save} disabled={ctx.locations.length === 0}>Save & continue <ArrowRight /></Button>} />
    </div>
  );
}

