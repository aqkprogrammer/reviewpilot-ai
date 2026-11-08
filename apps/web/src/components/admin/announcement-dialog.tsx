"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Shown as a banner inside the business app for the selected audience.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label="Title" htmlFor="ann-title" error={errors.title} required>
            <Input id="ann-title" value={form.title} invalid={!!errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
          </FormField>
          <FormField label="Message" htmlFor="ann-body" error={errors.body} required>
            <Textarea id="ann-body" rows={4} value={form.body} invalid={!!errors.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={4000} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Severity">
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Audience" error={errors.audience}>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="organizations">Selected organizations</SelectItem>
                  <SelectItem value="plans">Selected plans</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {form.audience !== "all" && (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background-subtle p-2 scrollbar-thin">
              {(form.audience === "organizations" ? (orgs.data?.items ?? []).map((o) => ({ v: o.id, l: o.name })) : (plans.data ?? []).map((p) => ({ v: p.code, l: p.name }))).map((o) => {
                const key = form.audience === "organizations" ? "organization_ids" : "plan_codes";
                const checked = form[key].includes(o.v);
                return (
                  <label key={o.v} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted", checked && "bg-primary-soft/60")}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(key, o.v)} />
                    {o.l}
                  </label>
                );
              })}
              {(orgs.isLoading || plans.isLoading) && <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{initial ? "Save changes" : form.publish ? "Publish" : "Save draft"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
