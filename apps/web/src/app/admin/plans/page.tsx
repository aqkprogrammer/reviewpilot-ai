"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/controls";
import { errorMessage } from "@/lib/api";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { Panel, QueryState, SectionHeader, StatusPill, adminPatch, adminPost, money, useAdmin } from "@/components/admin/ui";

interface Plan {
  id: string; code: string; name: string; description: string | null; currency: string; price_monthly_minor: number; price_yearly_minor: number; max_locations: number; max_team_members: number;
  max_organizations: number; ai_requests_per_month: number; monthly_message_quota: number; features: string[]; entitlements: Record<string, boolean>; is_popular: boolean;
  is_custom_pricing: boolean; is_active: boolean; sort_order: number; subscriptions: number;
}
const ENTITLEMENTS = ["qr_codes", "email_campaigns", "whatsapp_campaigns", "ai_replies", "advanced_analytics", "customer_management", "white_label"];
const blank: Plan = { id: "", code: "", name: "", description: "", currency: "INR", price_monthly_minor: 0, price_yearly_minor: 0, max_locations: 1, max_team_members: 3, max_organizations: 1, ai_requests_per_month: 0, monthly_message_quota: 300, features: [], entitlements: { qr_codes: true }, is_popular: false, is_custom_pricing: false, is_active: true, sort_order: 10, subscriptions: 0 };

function PlanDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = plan?.id === "";
  const [f, setF] = React.useState<Plan>(blank);
  const [featuresText, setFeaturesText] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (plan) { setF(plan); setFeaturesText(plan.features.join("\n")); setErr(null); } }, [plan]);
  const rupees = (minor: number) => String(minor / 100);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, description: f.description, price_monthly_minor: f.price_monthly_minor, price_yearly_minor: f.price_yearly_minor, max_locations: f.max_locations, max_team_members: f.max_team_members,
        max_organizations: f.max_organizations, ai_requests_per_month: f.ai_requests_per_month, monthly_message_quota: f.monthly_message_quota, features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
        entitlements: f.entitlements, is_popular: f.is_popular, is_custom_pricing: f.is_custom_pricing, is_active: f.is_active, sort_order: f.sort_order,
      };
      return isNew ? adminPost("/plans", { ...body, code: f.code, currency: f.currency }) : adminPatch(`/plans/${f.id}`, body);
    },
    onSuccess: () => { toast.success(isNew ? "Plan created" : "Plan updated — pricing pages refresh within 5 minutes"); qc.invalidateQueries({ queryKey: ["admin", "/plans"] }); onClose(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const num = (k: keyof Plan) => ({ value: String(f[k] as number), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(0, parseInt(e.target.value || "0", 10)) }) });
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create plan" : `Edit ${plan?.name}`}</DialogTitle>
          <DialogDescription>Changes apply to new checkouts. Existing subscribers keep their price until they change plan. All edits are audited.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.name || (isNew && !/^[a-z][a-z0-9_]{1,31}$/.test(f.code))) { setErr("Name and a lowercase code are required"); return; } save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            {isNew && <FormField label="Code" htmlFor="p-code" hint="lowercase, e.g. pro_plus"><Input id="p-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-mono" /></FormField>}
            <FormField label="Name" htmlFor="p-name" className={isNew ? "" : "sm:col-span-2"}><Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
            <FormField label="Sort order" htmlFor="p-sort"><Input id="p-sort" type="number" {...num("sort_order")} /></FormField>
          </div>
          <FormField label="Description" htmlFor="p-desc"><Input id="p-desc" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Monthly price (₹)" htmlFor="p-m"><Input id="p-m" type="number" min={0} value={rupees(f.price_monthly_minor)} onChange={(e) => setF({ ...f, price_monthly_minor: Math.round(Number(e.target.value || 0) * 100) })} /></FormField>
            <FormField label="Yearly price (₹)" htmlFor="p-y" hint="Typically 10× monthly"><Input id="p-y" type="number" min={0} value={rupees(f.price_yearly_minor)} onChange={(e) => setF({ ...f, price_yearly_minor: Math.round(Number(e.target.value || 0) * 100) })} /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Locations" htmlFor="p-l"><Input id="p-l" type="number" min={1} {...num("max_locations")} /></FormField>
            <FormField label="Team members" htmlFor="p-t"><Input id="p-t" type="number" min={1} {...num("max_team_members")} /></FormField>
            <FormField label="Organizations" htmlFor="p-o"><Input id="p-o" type="number" min={1} {...num("max_organizations")} /></FormField>
            <FormField label="AI requests / month" htmlFor="p-ai"><Input id="p-ai" type="number" {...num("ai_requests_per_month")} /></FormField>
            <FormField label="Messages / month" htmlFor="p-msg"><Input id="p-msg" type="number" {...num("monthly_message_quota")} /></FormField>
          </div>
          <FormField label="Marketing features" htmlFor="p-f" hint="One per line — shown on the pricing page"><Textarea id="p-f" rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} /></FormField>
          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground-soft">Entitlements (enforced server-side)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ENTITLEMENTS.map((k) => (
                <label key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]">
                  {titleCase(k)}
                  <Switch checked={!!f.entitlements[k]} onCheckedChange={(v) => setF({ ...f, entitlements: { ...f.entitlements, [k]: v } })} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-[13px] text-foreground-soft">
            <label className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Active</label>
            <label className="flex items-center gap-2"><Switch checked={f.is_popular} onCheckedChange={(v) => setF({ ...f, is_popular: v })} /> Most popular</label>
            <label className="flex items-center gap-2"><Switch checked={f.is_custom_pricing} onCheckedChange={(v) => setF({ ...f, is_custom_pricing: v })} /> Custom pricing (contact sales)</label>
          </div>
          {err && <p className="text-[13px] text-danger-foreground" role="alert">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{isNew ? "Create plan" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PlansPage() {
  const q = useAdmin<Plan[]>("/plans");
  const [editing, setEditing] = React.useState<Plan | null>(null);
  return (
    <>
      <SectionHeader eyebrow="Billing" title="Plans & pricing" description="Prices, limits and entitlements served to the pricing page, checkout and plan enforcement." actions={<Button size="sm" onClick={() => setEditing(blank)}><Plus /> New plan</Button>} />
      <QueryState query={q}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {q.data?.map((p) => (
            <Panel key={p.id} className={cn(p.is_popular && "border-[#2f7bff]/45 shadow-[0_0_40px_-18px_rgb(47_123_255/0.8)]", !p.is_active && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">{p.code}</p>
                  <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold">{p.name}{p.is_popular && <Sparkles className="size-4 text-[#7eaaff]" />}</h3>
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil /></Button>
              </div>
              <p className="mt-3 font-mono text-[26px] font-semibold tracking-tight">{p.is_custom_pricing ? "Custom" : money(p.price_monthly_minor)}<span className="text-[12px] font-normal text-muted-foreground">{p.is_custom_pricing ? "" : " /mo"}</span></p>
              {!p.is_custom_pricing && <p className="text-[12px] text-muted-foreground">{money(p.price_yearly_minor)} billed yearly</p>}
              <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                {[["Locations", p.max_locations], ["Team", p.max_team_members], ["AI / mo", p.ai_requests_per_month], ["Msgs / mo", p.monthly_message_quota]].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-border bg-background-subtle px-2.5 py-1.5"><p className="text-subtle-foreground">{k}</p><p className="font-mono text-foreground">{formatNumber(v as number)}</p></div>
                ))}
              </div>
              <ul className="mt-4 space-y-1.5">
                {p.features.slice(0, 5).map((f) => <li key={f} className="flex gap-2 text-[12.5px] text-foreground-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-success-foreground" />{f}</li>)}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px]">
                <span className="text-muted-foreground">{p.subscriptions} subscriptions</span>
                <StatusPill status={p.is_active ? "active" : "disabled"} label={p.is_active ? "Active" : "Hidden"} />
              </div>
            </Panel>
          ))}
        </div>
      </QueryState>
      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}
