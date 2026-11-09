"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ImageUp, Palette, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { INDUSTRIES } from "@reviewpilot/shared-types";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/console/kit";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { logout, meQueryKey, useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface Org {
  id: string; name: string; industry: string; description: string | null; website: string | null; phone: string | null; email: string | null; country: string;
  address: string | null; timezone: string; logo_url: string | null; brand_color: string; brand_tone: string; default_language: string; auto_publish_replies: boolean; is_demo: boolean;
}

/** New Instrument default brand colour (cyan signal). */
const DEFAULT_BRAND = "#52E3E8";
/** The pre-2026 default brand colour, identified by its RGB triplet (106, 76, 255). */
function isLegacyBrand(hex?: string | null) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return !!m && parseInt(m[1], 16) === 106 && parseInt(m[2], 16) === 76 && parseInt(m[3], 16) === 255;
}

const schema = z.object({
  name: z.string().min(2, "Required").max(160),
  industry: z.string(),
  description: z.string().max(2000).optional(),
  website: z.union([z.literal(""), z.url("Enter a full URL, e.g. https://example.com")]).optional(),
  phone: z.string().max(32).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  country: z.string().length(2),
  address: z.string().max(1000).optional(),
  timezone: z.string(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, `Use a hex colour like ${DEFAULT_BRAND}`),
  brand_tone: z.string(),
  default_language: z.string(),
});
type Values = z.infer<typeof schema>;

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];
const COUNTRIES = [["IN", "India"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"], ["US", "United States"], ["SG", "Singapore"], ["AU", "Australia"], ["DE", "Germany"]];

export function OrganizationTab() {
  const { orgId, can, membership } = useOrg();
  const qc = useQueryClient();
  const manage = can("settings.manage");
  const owner = membership.role === "owner";
  const q = useQuery({ queryKey: ["organization", orgId], queryFn: () => api.get<Org>("/organizations/current") });
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  React.useEffect(() => {
    const o = q.data;
    if (o) form.reset({ name: o.name, industry: o.industry, description: o.description ?? "", website: o.website ?? "", phone: o.phone ?? "", email: o.email ?? "", country: o.country, address: o.address ?? "", timezone: o.timezone, brand_color: o.brand_color, brand_tone: o.brand_tone, default_language: o.default_language });
  }, [q.data, form]);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["organization"] }); qc.invalidateQueries({ queryKey: meQueryKey }); };
  const save = useMutation({
    mutationFn: (v: Values) => api.patch<Org>("/organizations/current", Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]))),
    onSuccess: () => { toast.success("Organization updated"); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const autoPub = useMutation({ mutationFn: (on: boolean) => api.patch("/organizations/current", { auto_publish_replies: on }), onSuccess: (_d, on) => { toast.success(on ? "Auto-publish enabled" : "Auto-publish disabled"); invalidate(); }, onError: (e) => toast.error(errorMessage(e)) });
  const fileRef = React.useRef<HTMLInputElement>(null);
  const logo = useMutation({
    mutationFn: (f: File) => { const fd = new FormData(); fd.append("file", f); return api.post("/organizations/current/logo", fd); },
    onSuccess: () => { toast.success("Logo updated"); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton className="h-[600px]" />;
  if (q.error) return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const { register, watch, setValue, formState: { errors, isDirty } } = form;
  const sel = (name: keyof Values, options: { value: string; label: string }[]) => (
    <Select value={watch(name) as string} onValueChange={(v) => setValue(name, v, { shouldDirty: true })} disabled={!manage}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
    </Select>
  );

  const brand = watch("brand_color") ?? DEFAULT_BRAND;
  const brandValid = /^#[0-9a-fA-F]{6}$/.test(brand);
  const legacy = isLegacyBrand(brand);

  return (
    <div className="space-y-6">
      <Panel index="01" label="Identity" title="Brand" description="Shown on your public feedback pages, emails and QR cards">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="tech-corners flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-background-subtle text-primary/60">
            {o.logo_url ? <img src={o.logo_url} alt={`${o.name} logo`} className="size-full object-contain" /> : <span className="font-mono text-2xl font-semibold text-subtle-foreground">{o.name[0]}</span>}
          </div>
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">PNG, JPEG or WebP, up to 2 MB. Square images look best.</p>
            {manage && <Button variant="outline" size="sm" loading={logo.isPending} onClick={() => fileRef.current?.click()}><ImageUp /> Upload logo</Button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Logo file" onChange={(e) => { const f = e.target.files?.[0]; if (f) logo.mutate(f); e.target.value = ""; }} />
          </div>
          {o.is_demo && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber sm:ml-auto">Demo organization</span>}
        </div>
      </Panel>

      <Panel index="02" label="Profile" title="Business details" description="Used by the AI assistant and on customer-facing pages"
        actions={isDirty && <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-warning-foreground"><span className="size-1.5 rounded-full bg-current" />Unsaved</span>}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <fieldset disabled={!manage} className="grid gap-4 sm:grid-cols-2">
            <FormField label="Business name" htmlFor="o-name" error={errors.name?.message}><Input id="o-name" invalid={!!errors.name} {...register("name")} /></FormField>
            <FormField label="Industry">{sel("industry", INDUSTRIES.map((i) => ({ value: i.value, label: i.label })))}</FormField>
            <FormField label="Description" htmlFor="o-desc" className="sm:col-span-2"><Textarea id="o-desc" rows={3} {...register("description")} placeholder="What makes your business special" /></FormField>
            <FormField label="Website" htmlFor="o-web" error={errors.website?.message}><Input id="o-web" placeholder="https://" {...register("website")} /></FormField>
            <FormField label="Business email" htmlFor="o-email" error={errors.email?.message}><Input id="o-email" type="email" {...register("email")} /></FormField>
            <FormField label="Phone" htmlFor="o-phone"><Input id="o-phone" className="font-mono" {...register("phone")} /></FormField>
            <FormField label="Country">{sel("country", COUNTRIES.map(([value, label]) => ({ value, label })))}</FormField>
            <FormField label="Time zone">{sel("timezone", TIMEZONES.map((t) => ({ value: t, label: t.replace("_", " ") })))}</FormField>
            <FormField label="Default language">{sel("default_language", [{ value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "hinglish", label: "Hinglish" }])}</FormField>
            <FormField label="Address" htmlFor="o-addr" className="sm:col-span-2"><Textarea id="o-addr" rows={2} {...register("address")} /></FormField>
            <FormField label="Brand colour" htmlFor="o-color" error={errors.brand_color?.message}>
              <div className="flex gap-2">
                <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-input" style={{ background: brandValid ? brand : undefined }}>
                  <span className="sr-only">Pick brand colour</span>
                  <input type="color" value={brandValid ? brand.toLowerCase() : DEFAULT_BRAND.toLowerCase()} onChange={(e) => setValue("brand_color", e.target.value, { shouldDirty: true })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                </label>
                <Input id="o-color" className="font-mono uppercase" {...register("brand_color")} />
              </div>
            </FormField>
            <FormField label="Brand tone for AI replies">{sel("brand_tone", ["professional", "friendly", "empathetic", "appreciative", "concise"].map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })))}</FormField>
            {legacy && (
              <div className="sm:col-span-2">
                <InlineAlert variant="info" icon={Palette} title="You're using the previous default brand colour"
                  action={manage && <Button type="button" size="sm" variant="outline" onClick={() => setValue("brand_color", DEFAULT_BRAND, { shouldDirty: true })}><span className="size-3 rounded-[3px] bg-primary" aria-hidden />Use {DEFAULT_BRAND}</Button>}>
                  It still works everywhere. The new ReviewPilot default is <span className="font-mono text-foreground">{DEFAULT_BRAND}</span> — switch if you haven&apos;t chosen this colour deliberately.
                </InlineAlert>
              </div>
            )}
            {brandValid && (
              <div className="sm:col-span-2">
                <p className="micro-label mb-2">Preview · public feedback button</p>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background-subtle/60 p-3">
                  <span className="inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold text-white shadow-sm" style={{ background: brand }}>Share feedback</span>
                  <span className="inline-flex h-9 items-center rounded-lg border px-4 text-[13px] font-semibold" style={{ borderColor: brand, color: brand }}>Review on Google</span>
                  <span className="ml-auto font-mono text-[11px] uppercase text-subtle-foreground">{brand}</span>
                </div>
              </div>
            )}
          </fieldset>
          {manage && <div className="flex justify-end gap-2 border-t border-border pt-4">{isDirty && <Button type="button" variant="ghost" onClick={() => form.reset()}>Discard</Button>}<Button type="submit" disabled={!isDirty} loading={save.isPending}>Save changes</Button></div>}
        </form>
      </Panel>

      <Panel index="03" label="Automation" title={<><Bot className="size-4 text-primary" />AI reply publishing</>} description="By default, every AI-drafted reply needs a person to review and publish it.">
        <div className="space-y-4">
          <div className={cn("flex items-center justify-between gap-4 rounded-lg border px-4 py-3", o.auto_publish_replies ? "border-[color-mix(in_oklab,var(--warning)_35%,var(--border))] bg-warning-soft/60" : "border-border bg-background-subtle/60")}>
            <div>
              <p className="text-[13px] font-medium">Auto-publish AI replies</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{o.auto_publish_replies ? "Enabled · replies post without review" : "Human approval required"} · {owner ? "owner-only" : "only owners can change"}</p>
            </div>
            <Switch checked={o.auto_publish_replies} disabled={!owner || autoPub.isPending} onCheckedChange={(on) => autoPub.mutate(on)} aria-label="Auto-publish AI replies" />
          </div>
          <InlineAlert variant="warning" icon={TriangleAlert} title="Think carefully before enabling">
            Replies to Google reviews are public and permanent. AI can misread sarcasm, complaints or sensitive situations. We strongly recommend keeping human approval on, especially for negative reviews.
          </InlineAlert>
        </div>
      </Panel>

      {owner && (
        <Panel index="04" label="Danger zone" title={<span className="text-danger-foreground">Delete organization</span>} className="border-[color-mix(in_oklab,var(--danger)_30%,var(--border))]" description="Deleting the organization removes access for every member. Data is purged after 30 days.">
          <ConfirmDialog destructive title={`Delete ${o.name}?`} description="All locations, feedback pages, QR codes, campaigns and team access are disabled immediately. This cannot be undone from the app." confirmText={o.name} confirmLabel="Delete organization"
            onConfirm={async () => { try { await api.delete("/organizations/current"); toast.success("Organization deleted"); await logout(); } catch (e) { toast.error(errorMessage(e)); } }}
            trigger={<Button variant="danger-soft">Delete organization</Button>} />
        </Panel>
      )}
    </div>
  );
}
