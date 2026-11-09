"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Minus, Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/controls";
import { errorMessage } from "@/lib/api";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { Notice, Panel, QueryState, SectionHeader, StatusPill, adminPatch, adminPost, money, useAdmin } from "@/components/admin/ui";

interface Plan {
  id: string; code: string; name: string; description: string | null; currency: string; price_monthly_minor: number; price_yearly_minor: number; max_locations: number; max_team_members: number;
  max_organizations: number; ai_requests_per_month: number; monthly_message_quota: number; features: string[]; entitlements: Record<string, boolean>; is_popular: boolean;
  is_custom_pricing: boolean; is_active: boolean; sort_order: number; subscriptions: number;
}
const ENTITLEMENTS = ["qr_codes", "email_campaigns", "whatsapp_campaigns", "ai_replies", "advanced_analytics", "customer_management", "white_label"];
const blank: Plan = { id: "", code: "", name: "", description: "", currency: "INR", price_monthly_minor: 0, price_yearly_minor: 0, max_locations: 1, max_team_members: 3, max_organizations: 1, ai_requests_per_month: 0, monthly_message_quota: 300, features: [], entitlements: { qr_codes: true }, is_popular: false, is_custom_pricing: false, is_active: true, sort_order: 10, subscriptions: 0 };

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2"><span className="font-mono text-[10.5px] text-primary">{index}</span><span className="micro-label">{title}</span><span aria-hidden className="h-px flex-1 bg-border" /></h3>
      {children}
    </section>
  );
}

function PlanEditor({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = plan?.id === "";
  const [f, setF] = React.useState<Plan>(blank);
  const [featuresText, setFeaturesText] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (plan) { setF(plan); setFeaturesText(plan.features.join("\n")); setErr(null); } }, [plan]);
  const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
  const changed = plan && !isNew
    ? (["name", "description", "price_monthly_minor", "price_yearly_minor", "max_locations", "max_team_members", "max_organizations", "ai_requests_per_month", "monthly_message_quota", "is_popular", "is_custom_pricing", "is_active", "sort_order"] as (keyof Plan)[]).filter((k) => f[k] !== plan[k]).length
      + (JSON.stringify(features) !== JSON.stringify(plan.features) ? 1 : 0)
      + ENTITLEMENTS.filter((k) => !!f.entitlements[k] !== !!plan.entitlements[k]).length
    : 0;
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, description: f.description, price_monthly_minor: f.price_monthly_minor, price_yearly_minor: f.price_yearly_minor, max_locations: f.max_locations, max_team_members: f.max_team_members,
        max_organizations: f.max_organizations, ai_requests_per_month: f.ai_requests_per_month, monthly_message_quota: f.monthly_message_quota, features,
        entitlements: f.entitlements, is_popular: f.is_popular, is_custom_pricing: f.is_custom_pricing, is_active: f.is_active, sort_order: f.sort_order,
      };
      return isNew ? adminPost("/plans", { ...body, code: f.code, currency: f.currency }) : adminPatch(`/plans/${f.id}`, body);
    },
    onSuccess: () => { toast.success(isNew ? "Plan created" : "Plan updated — pricing pages refresh within 5 minutes"); qc.invalidateQueries({ queryKey: ["admin", "/plans"] }); onClose(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const num = (k: keyof Plan, min = 0) => ({
    type: "number", min, className: "font-mono", value: String(f[k] as number),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(min, parseInt(e.target.value || "0", 10) || 0) }),
  });
  const rupees = (minor: number) => String(minor / 100);
  const discount = f.price_monthly_minor > 0 && f.price_yearly_minor > 0 ? 1 - f.price_yearly_minor / (f.price_monthly_minor * 12) : null;
  return (
    <Sheet open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[640px]">
        <SheetHeader>
          <p className="micro-label mb-1">{isNew ? "Plan editor · new" : `Plan editor · ${plan?.code}`}</p>
          <SheetTitle>{isNew ? "Create plan" : `Edit ${plan?.name}`}</SheetTitle>
          <SheetDescription>Applies to new checkouts. Existing subscribers keep their price until they change plan. Every edit is audited.</SheetDescription>
        </SheetHeader>
        <form id="plan-form" className="contents" onSubmit={(e) => { e.preventDefault(); if (!f.name || (isNew && !/^[a-z][a-z0-9_]{1,31}$/.test(f.code))) { setErr("Name and a lowercase code (e.g. pro_plus) are required."); return; } save.mutate(); }}>
          <SheetBody className="space-y-7">
            <Section index="01" title="Identity">
              <div className="grid gap-4 sm:grid-cols-3">
                {isNew && <FormField label="Code" htmlFor="p-code" hint="lowercase, immutable"><Input id="p-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-mono" /></FormField>}
                <FormField label="Name" htmlFor="p-name" className={isNew ? "" : "sm:col-span-2"}><Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FormField>
                <FormField label="Sort order" htmlFor="p-sort"><Input id="p-sort" {...num("sort_order")} /></FormField>
              </div>
              <FormField label="Description" htmlFor="p-desc"><Input id="p-desc" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField>
            </Section>
            <Section index="02" title="Pricing · INR">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Monthly price (₹)" htmlFor="p-m"><Input id="p-m" type="number" min={0} className="font-mono" value={rupees(f.price_monthly_minor)} onChange={(e) => setF({ ...f, price_monthly_minor: Math.round(Number(e.target.value || 0) * 100) })} /></FormField>
                <FormField label="Yearly price (₹)" htmlFor="p-y" hint={discount != null ? `${(discount * 100).toFixed(0)}% vs 12× monthly` : "Typically 10× monthly"}><Input id="p-y" type="number" min={0} className="font-mono" value={rupees(f.price_yearly_minor)} onChange={(e) => setF({ ...f, price_yearly_minor: Math.round(Number(e.target.value || 0) * 100) })} /></FormField>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-[13px]">Custom pricing (contact sales)<Switch checked={f.is_custom_pricing} onCheckedChange={(v) => setF({ ...f, is_custom_pricing: v })} /></label>
            </Section>
            <Section index="03" title="Limits">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Locations" htmlFor="p-l"><Input id="p-l" {...num("max_locations", 1)} /></FormField>
                <FormField label="Team members" htmlFor="p-t"><Input id="p-t" {...num("max_team_members", 1)} /></FormField>
                <FormField label="Organizations" htmlFor="p-o"><Input id="p-o" {...num("max_organizations", 1)} /></FormField>
                <FormField label="AI requests / mo" htmlFor="p-ai"><Input id="p-ai" {...num("ai_requests_per_month")} /></FormField>
                <FormField label="Messages / mo" htmlFor="p-msg"><Input id="p-msg" {...num("monthly_message_quota")} /></FormField>
              </div>
            </Section>
            <Section index="04" title="Entitlements · enforced server-side">
              <div className="grid gap-2 sm:grid-cols-2">
                {ENTITLEMENTS.map((k) => (
                  <label key={k} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-[13px] transition-colors", f.entitlements[k] ? "border-[color-mix(in_oklab,var(--primary)_28%,transparent)] bg-primary-soft" : "border-border")}>
                    <span className="font-mono text-[11.5px]">{k}</span>
                    <Switch checked={!!f.entitlements[k]} onCheckedChange={(v) => setF({ ...f, entitlements: { ...f.entitlements, [k]: v } })} aria-label={titleCase(k)} />
                  </label>
                ))}
              </div>
            </Section>
            <Section index="05" title="Pricing page copy">
              <FormField label="Marketing features" htmlFor="p-f" hint={`One per line · ${features.length} lines`}><Textarea id="p-f" rows={5} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} /></FormField>
            </Section>
            <Section index="06" title="Visibility">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-[13px]">Active (offered at checkout)<Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /></label>
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-[13px]">Highlight as most popular<Switch checked={f.is_popular} onCheckedChange={(v) => setF({ ...f, is_popular: v })} /></label>
              </div>
              {!f.is_active && !isNew && plan && plan.subscriptions > 0 && <Notice>{plan.subscriptions} existing subscriptions keep this plan; it's only hidden from new checkouts.</Notice>}
            </Section>
            {err && <Notice tone="danger">{err}</Notice>}
          </SheetBody>
          <SheetFooter className="justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{isNew ? "New plan" : changed ? <span className="text-amber">{changed} pending change{changed === 1 ? "" : "s"}</span> : "No changes"}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="plan-form" loading={save.isPending} disabled={!isNew && !changed}>{isNew ? "Create plan" : "Save changes"}</Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function PlansPage() {
  const q = useAdmin<Plan[]>("/plans");
  const [editing, setEditing] = React.useState<Plan | null>(null);
  const plans = q.data ?? [];
  const rows: { label: string; get: (p: Plan) => React.ReactNode }[] = [
    { label: "Monthly", get: (p) => (p.is_custom_pricing ? "Custom" : money(p.price_monthly_minor)) },
    { label: "Yearly", get: (p) => (p.is_custom_pricing ? "Custom" : money(p.price_yearly_minor)) },
    { label: "Locations", get: (p) => formatNumber(p.max_locations) },
    { label: "Team members", get: (p) => formatNumber(p.max_team_members) },
    { label: "Organizations", get: (p) => formatNumber(p.max_organizations) },
    { label: "AI requests / mo", get: (p) => formatNumber(p.ai_requests_per_month) },
    { label: "Messages / mo", get: (p) => formatNumber(p.monthly_message_quota) },
  ];
  return (
    <>
      <SectionHeader title="Plans & pricing" description="Prices, limits and entitlements served to the pricing page, checkout and server-side plan enforcement." actions={<Button size="sm" onClick={() => setEditing(blank)}><Plus /> New plan</Button>} meta={q.data ? `${plans.length} plans` : undefined} />
      <QueryState query={q}>
        <div className="space-y-4">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => (
              <article key={p.id} className={cn("relative flex flex-col bg-card p-5", p.is_popular && "bg-[linear-gradient(180deg,var(--primary-soft),var(--card)_55%)]", !p.is_active && "opacity-60")}>
                {p.is_popular && <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-primary shadow-[0_0_12px_var(--primary)]" />}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">{p.code} · #{p.sort_order}</p>
                    <h3 className="mt-1 flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em]">{p.name}{p.is_popular && <Sparkles className="size-3.5 text-primary" aria-label="Most popular" />}</h3>
                  </div>
                  <Button variant="outline" size="xs" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil /> Edit</Button>
                </div>
                <p className="mt-4 text-[26px] font-semibold tracking-[-0.035em] tabular">
                  {p.is_custom_pricing ? "Custom" : money(p.price_monthly_minor)}
                  {!p.is_custom_pricing && <span className="ml-1 font-mono text-[11px] font-normal tracking-normal text-muted-foreground">/mo</span>}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">{p.is_custom_pricing ? "Contact sales" : `${money(p.price_yearly_minor)} billed yearly`}</p>
                {p.description && <p className="mt-3 line-clamp-2 text-[12.5px] text-muted-foreground">{p.description}</p>}
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.slice(0, 4).map((f) => <li key={f} className="flex gap-2 text-[12.5px] text-foreground-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{f}</li>)}
                  {p.features.length > 4 && <li className="pl-5 font-mono text-[10.5px] text-subtle-foreground">+{p.features.length - 4} more</li>}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-mono text-[11px] tabular text-muted-foreground"><span className="text-foreground">{p.subscriptions}</span> subscriptions</span>
                  <StatusPill status={p.is_active ? "active" : "hidden"} label={p.is_active ? "Live" : "Hidden"} />
                </div>
              </article>
            ))}
          </div>

          <Panel title="Comparison matrix" description="Limits and entitlements as enforced by the API" flush>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
                <caption className="sr-only">Plan comparison</caption>
                <thead>
                  <tr className="border-b border-border bg-[color-mix(in_oklab,var(--card-elevated)_92%,transparent)]">
                    <th scope="col" className="h-9 px-4 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-subtle-foreground">Attribute</th>
                    {plans.map((p) => <th key={p.id} scope="col" className={cn("h-9 px-4 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em]", p.is_popular ? "text-primary" : "text-subtle-foreground")}>{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-border">
                      <th scope="row" className="px-4 py-2 text-left font-normal text-muted-foreground">{r.label}</th>
                      {plans.map((p) => <td key={p.id} className="px-4 py-2 text-right font-mono tabular text-foreground">{r.get(p)}</td>)}
                    </tr>
                  ))}
                  <tr className="border-b border-border bg-background-subtle/60"><th scope="row" colSpan={plans.length + 1} className="px-4 py-1.5 text-left micro-label">Entitlements</th></tr>
                  {ENTITLEMENTS.map((k) => (
                    <tr key={k} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-mono text-[11.5px] font-normal text-muted-foreground">{k}</th>
                      {plans.map((p) => (
                        <td key={p.id} className="px-4 py-2 text-right">
                          {p.entitlements[k] ? <Check className="ml-auto size-3.5 text-primary" aria-label="Included" /> : <Minus className="ml-auto size-3.5 text-subtle-foreground" aria-label="Not included" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </QueryState>
      <PlanEditor plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}
