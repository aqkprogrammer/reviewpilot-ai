"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox, Switch } from "@/components/ui/controls";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { adminPost, adminPut, useAdmin, type AdminPage } from "./ui";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  audience: "all" | "organizations" | "plans";
  organization_ids: string[];
  plan_codes: string[];
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  dismissible: boolean;
  created_at: string;
}

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const LEVEL = {
  info: { icon: Info, cls: "border-[color-mix(in_oklab,var(--ice)_28%,transparent)] bg-ice-soft text-ice" },
  warning: { icon: TriangleAlert, cls: "border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft text-warning-foreground" },
  critical: { icon: OctagonAlert, cls: "border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger-foreground" },
} as const;

/** Visual preview of how the banner renders in the business app. */
export function BannerPreview({ level, title, body, dismissible }: { level: keyof typeof LEVEL; title: string; body: string; dismissible: boolean }) {
  const L = LEVEL[level] ?? LEVEL.info;
  const Icon = L.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-2.5", L.cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
        <p className="font-semibold text-foreground">{title || "Announcement title"}</p>
        <p className="line-clamp-2 text-foreground-soft">{body || "Your message appears here."}</p>
      </div>
      {dismissible && <X className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />}
    </div>
  );
}

export function AnnouncementDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: AnnouncementRow | null }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    title: "", body: "", level: "info", audience: "all", organization_ids: [] as string[], plan_codes: [] as string[], starts_at: "", ends_at: "", dismissible: true, publish: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      initial
        ? { title: initial.title, body: initial.body, level: initial.level, audience: initial.audience, organization_ids: initial.organization_ids, plan_codes: initial.plan_codes, starts_at: toLocal(initial.starts_at), ends_at: toLocal(initial.ends_at), dismissible: initial.dismissible, publish: !!initial.published_at }
        : { title: "", body: "", level: "info", audience: "all", organization_ids: [], plan_codes: [], starts_at: "", ends_at: "", dismissible: true, publish: true },
    );
  }, [open, initial]);

  const orgs = useAdmin<AdminPage<{ id: string; name: string }>>("/organizations", { page_size: 100 }, { enabled: open && form.audience === "organizations" });
  const plans = useAdmin<{ code: string; name: string }[]>("/plans", undefined, { enabled: open && form.audience === "plans" });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null };
      return initial ? adminPut(`/announcements/${initial.id}`, body) : adminPost("/announcements", body);
    },
    onSuccess: () => {
      toast.success(initial ? "Announcement updated" : form.publish ? "Announcement published" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["admin", "/announcements"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.title.trim().length < 3) errs.title = "Title must be at least 3 characters";
    if (form.body.trim().length < 3) errs.body = "Write a short message";
    if (form.audience === "organizations" && !form.organization_ids.length) errs.audience = "Pick at least one organization";
    if (form.audience === "plans" && !form.plan_codes.length) errs.audience = "Pick at least one plan";
    if (form.starts_at && form.ends_at && form.ends_at < form.starts_at) errs.ends_at = "End must be after start";
    setErrors(errs);
    if (!Object.keys(errs).length) save.mutate();
  };

  const toggle = (key: "organization_ids" | "plan_codes", v: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));

  const choices = form.audience === "organizations" ? (orgs.data?.items ?? []).map((o) => ({ v: o.id, l: o.name })) : (plans.data ?? []).map((p) => ({ v: p.code, l: p.name }));
  const key = form.audience === "organizations" ? "organization_ids" : "plan_codes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <p className="micro-label">Broadcast · in-app banner</p>
          <DialogTitle>{initial ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Shown as a banner inside the business app for the selected audience. Creation and edits are audited.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label="Title" htmlFor="ann-title" error={errors.title} required>
            <Input id="ann-title" value={form.title} invalid={!!errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
          </FormField>
          <FormField label="Message" htmlFor="ann-body" error={errors.body} required>
            <Textarea id="ann-body" rows={3} value={form.body} invalid={!!errors.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={4000} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Severity">
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Audience" error={errors.audience}>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="organizations">Selected organizations</SelectItem>
                  <SelectItem value="plans">Selected plans</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {form.audience !== "all" && (
            <div className="rounded-lg border border-border bg-background-subtle">
              <p className="flex items-center justify-between border-b border-border px-3 py-1.5 micro-label">
                <span>{form.audience === "organizations" ? "Organizations" : "Plans"}</span>
                <span className="tabular">{form[key].length} selected</span>
              </p>
              <div className="max-h-40 space-y-px overflow-y-auto p-1.5 scrollbar-thin">
                {choices.map((o) => {
                  const checked = form[key].includes(o.v);
                  return (
                    <label key={o.v} className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-hover", checked && "bg-primary-soft")}>
                      <Checkbox checked={checked} onCheckedChange={() => toggle(key, o.v)} />
                      {o.l}
                    </label>
                  );
                })}
                {(orgs.isLoading || plans.isLoading) && <p className="px-2 py-1 font-mono text-[11px] text-muted-foreground">Loading…</p>}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Starts (optional)" htmlFor="ann-start">
              <Input id="ann-start" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </FormField>
            <FormField label="Ends (optional)" htmlFor="ann-end" error={errors.ends_at}>
              <Input id="ann-end" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 text-[13px] text-foreground-soft">
              <Switch checked={form.dismissible} onCheckedChange={(v) => setForm({ ...form, dismissible: v })} /> Users can dismiss
            </label>
            {!initial && (
              <label className="flex items-center gap-2.5 text-[13px] text-foreground-soft">
                <Switch checked={form.publish} onCheckedChange={(v) => setForm({ ...form, publish: v })} /> Publish immediately
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="micro-label">Preview</p>
            <BannerPreview level={form.level as "info"} title={form.title} body={form.body} dismissible={form.dismissible} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{initial ? "Save changes" : form.publish ? "Publish" : "Save draft"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
