"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ImageUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { INDUSTRIES } from "@reviewpilot/shared-types";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { logout, meQueryKey, useOrg } from "@/lib/session";

interface Org {
  id: string; name: string; industry: string; description: string | null; website: string | null; phone: string | null; email: string | null; country: string;
  address: string | null; timezone: string; logo_url: string | null; brand_color: string; brand_tone: string; default_language: string; auto_publish_replies: boolean; is_demo: boolean;
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
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6a4cff"),
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>Brand</CardTitle><CardDescription>Shown on your public feedback pages, emails and QR cards</CardDescription></div></CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-subtle">
            {o.logo_url ? <img src={o.logo_url} alt={`${o.name} logo`} className="size-full object-contain" /> : <span className="text-2xl font-semibold text-subtle-foreground">{o.name[0]}</span>}
          </div>
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">PNG, JPEG or WebP, up to 2 MB. Square images look best.</p>
            {manage && <Button variant="outline" size="sm" loading={logo.isPending} onClick={() => fileRef.current?.click()}><ImageUp /> Upload logo</Button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Logo file" onChange={(e) => { const f = e.target.files?.[0]; if (f) logo.mutate(f); e.target.value = ""; }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Business details</CardTitle><CardDescription>Used by the AI assistant and on customer-facing pages</CardDescription></div></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
            <fieldset disabled={!manage} className="grid gap-4 sm:grid-cols-2">
              <FormField label="Business name" htmlFor="o-name" error={errors.name?.message}><Input id="o-name" invalid={!!errors.name} {...register("name")} /></FormField>
              <FormField label="Industry">{sel("industry", INDUSTRIES.map((i) => ({ value: i.value, label: i.label })))}</FormField>
              <FormField label="Description" htmlFor="o-desc" className="sm:col-span-2"><Textarea id="o-desc" rows={3} {...register("description")} placeholder="What makes your business special" /></FormField>
              <FormField label="Website" htmlFor="o-web" error={errors.website?.message}><Input id="o-web" placeholder="https://" {...register("website")} /></FormField>
              <FormField label="Business email" htmlFor="o-email" error={errors.email?.message}><Input id="o-email" type="email" {...register("email")} /></FormField>
              <FormField label="Phone" htmlFor="o-phone"><Input id="o-phone" {...register("phone")} /></FormField>
              <FormField label="Country">{sel("country", COUNTRIES.map(([value, label]) => ({ value, label })))}</FormField>
              <FormField label="Time zone">{sel("timezone", TIMEZONES.map((t) => ({ value: t, label: t.replace("_", " ") })))}</FormField>
              <FormField label="Default language">{sel("default_language", [{ value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "hinglish", label: "Hinglish" }])}</FormField>
              <FormField label="Address" htmlFor="o-addr" className="sm:col-span-2"><Textarea id="o-addr" rows={2} {...register("address")} /></FormField>
              <FormField label="Brand colour" htmlFor="o-color" error={errors.brand_color?.message}>
                <div className="flex gap-2">
                  <input type="color" aria-label="Pick brand colour" value={watch("brand_color") ?? "#6a4cff"} onChange={(e) => setValue("brand_color", e.target.value, { shouldDirty: true })} className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-card p-1" />
                  <Input id="o-color" className="font-mono" {...register("brand_color")} />
                </div>
              </FormField>
              <FormField label="Brand tone for AI replies">{sel("brand_tone", ["professional", "friendly", "empathetic", "appreciative", "concise"].map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })))}</FormField>
            </fieldset>
            {manage && <div className="flex justify-end"><Button type="submit" disabled={!isDirty} loading={save.isPending}>Save changes</Button></div>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><Bot className="size-4 text-primary" />AI reply publishing</CardTitle><CardDescription>By default, every AI-drafted reply needs a person to review and publish it.</CardDescription></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div><p className="text-[13px] font-medium">Auto-publish AI replies</p><p className="text-xs text-muted-foreground">{owner ? "Owner-only setting." : "Only organization owners can change this."}</p></div>
            <Switch checked={o.auto_publish_replies} disabled={!owner || autoPub.isPending} onCheckedChange={(on) => autoPub.mutate(on)} aria-label="Auto-publish AI replies" />
          </div>
          <InlineAlert variant="warning" icon={TriangleAlert} title="Think carefully before enabling">
            Replies to Google reviews are public and permanent. AI can misread sarcasm, complaints or sensitive situations. We strongly recommend keeping human approval on, especially for negative reviews.
          </InlineAlert>
        </CardContent>
      </Card>

      {owner && (
        <Card className="border-danger/30">
          <CardHeader><div><CardTitle className="text-danger-foreground">Danger zone</CardTitle><CardDescription>Deleting the organization removes access for every member. Data is purged after 30 days.</CardDescription></div></CardHeader>
          <CardContent>
            <ConfirmDialog destructive title={`Delete ${o.name}?`} description="All locations, feedback pages, QR codes, campaigns and team access are disabled immediately. This cannot be undone from the app." confirmText={o.name} confirmLabel="Delete organization"
              onConfirm={async () => { try { await api.delete("/organizations/current"); toast.success("Organization deleted"); await logout(); } catch (e) { toast.error(errorMessage(e)); } }}
              trigger={<Button variant="danger">Delete organization</Button>} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
