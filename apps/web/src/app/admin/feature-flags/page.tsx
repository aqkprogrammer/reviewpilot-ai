"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { ControlledConfirm } from "@/components/admin/reason-dialog";
import { DataTable, MobileCard, Responsive, Row, RowMenu, SearchInput, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort } from "@/components/admin/table";
import { EmptyLine, Kpi, KpiGrid, Meter, Notice, Panel, SectionHeader, adminPatch, adminPost, relTime, useAdmin, type AdminPage } from "@/components/admin/ui";

interface FlagRow { id: string; key: string; description: string | null; enabled: boolean; rollout_percentage: number; organization_ids: string[]; plan_codes: string[]; updated_at: string }
const PLANS = ["starter", "growth", "agency", "enterprise"];

function FlagDialog({ flag, onClose }: { flag: FlagRow | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = flag === "new";
  const [f, setF] = React.useState({ key: "", description: "", enabled: false, rollout_percentage: 100, plan_codes: [] as string[], organization_ids: [] as string[] });
  const [err, setErr] = React.useState<string | null>(null);
  const [orgSearch, setOrgSearch] = React.useState("");
  const orgs = useAdmin<AdminPage<{ id: string; name: string }>>("/organizations", { page_size: 100 }, { enabled: !!flag });
  React.useEffect(() => {
    setErr(null); setOrgSearch("");
    if (flag && flag !== "new") setF({ key: flag.key, description: flag.description ?? "", enabled: flag.enabled, rollout_percentage: flag.rollout_percentage, plan_codes: flag.plan_codes, organization_ids: flag.organization_ids });
    else if (flag === "new") setF({ key: "", description: "", enabled: false, rollout_percentage: 100, plan_codes: [], organization_ids: [] });
  }, [flag]);
  const save = useMutation({
    mutationFn: () => isNew ? adminPost("/feature-flags", f) : adminPatch(`/feature-flags/${(flag as FlagRow).id}`, { description: f.description, enabled: f.enabled, rollout_percentage: f.rollout_percentage, plan_codes: f.plan_codes, organization_ids: f.organization_ids }),
    onSuccess: () => { toast.success(isNew ? "Flag created" : "Flag updated"); qc.invalidateQueries({ queryKey: ["admin", "/feature-flags"] }); onClose(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggle = (k: "plan_codes" | "organization_ids", v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const orgList = (orgs.data?.items ?? []).filter((o) => !orgSearch || o.name.toLowerCase().includes(orgSearch.toLowerCase()));
  return (
    <Dialog open={!!flag} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <p className="micro-label">{isNew ? "Feature flag · new" : "Feature flag · edit"}</p>
          <DialogTitle className={cn(!isNew && "font-mono text-[16px]")}>{isNew ? "New feature flag" : f.key}</DialogTitle>
          <DialogDescription>Targeting: allow-listed organizations and plans are always on; everyone else gets the rollout percentage. Changes are audited with before/after values.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (isNew && !/^[a-z][a-z0-9_.]{1,95}$/.test(f.key)) { setErr("Key must be lowercase snake_case (dots allowed)."); return; } save.mutate(); }}>
          {isNew && <FormField label="Key" htmlFor="ff-key" hint="Immutable once created"><Input id="ff-key" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} className="font-mono" placeholder="e.g. smart_reminders" /></FormField>}
          <FormField label="Description" htmlFor="ff-desc"><Input id="ff-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={cn("flex items-center justify-between rounded-lg border px-4 py-3 text-[13px]", f.enabled ? "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft" : "border-border")}>
              <span><span className="block font-medium text-foreground">Enabled</span><span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">Kill switch</span></span>
              <Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} />
            </label>
            <div className="rounded-lg border border-border px-4 py-3">
              <label htmlFor="ff-roll" className="flex items-center justify-between text-[13px]"><span className="font-medium text-foreground">Rollout</span><span className="font-mono tabular text-primary">{f.rollout_percentage}%</span></label>
              <input id="ff-roll" type="range" min={0} max={100} step={5} value={f.rollout_percentage} onChange={(e) => setF({ ...f, rollout_percentage: Number(e.target.value) })} className="mt-2 w-full accent-[var(--primary)]" />
            </div>
          </div>
          <div>
            <p className="micro-label mb-2">Plan allow-list</p>
            <div className="flex flex-wrap gap-2">{PLANS.map((p) => <label key={p} className={cn("flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px]", f.plan_codes.includes(p) ? "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft" : "border-border")}><Checkbox checked={f.plan_codes.includes(p)} onCheckedChange={() => toggle("plan_codes", p)} />{titleCase(p)}</label>)}</div>
          </div>
          <div className="rounded-lg border border-border bg-background-subtle">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
              <span className="micro-label">Organization allow-list · {f.organization_ids.length}</span>
              <input value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)} placeholder="Filter…" aria-label="Filter organizations" className="h-6 w-32 rounded border border-border bg-card px-2 text-[12px] outline-none focus:border-primary" />
            </div>
            <div className="max-h-40 space-y-px overflow-y-auto p-1.5 scrollbar-thin">
              {orgs.isLoading && <Skeleton className="h-8" />}
              {orgList.map((o) => <label key={o.id} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-hover", f.organization_ids.includes(o.id) && "bg-primary-soft")}><Checkbox checked={f.organization_ids.includes(o.id)} onCheckedChange={() => toggle("organization_ids", o.id)} />{o.name}</label>)}
            </div>
          </div>
          {err && <Notice tone="danger">{err}</Notice>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{isNew ? "Create flag" : "Save flag"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const q = useAdmin<FlagRow[]>("/feature-flags");
  const [editing, setEditing] = React.useState<FlagRow | "new" | null>(null);
  const [toggling, setToggling] = React.useState<FlagRow | null>(null);
  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const flags = q.data ?? [];
  const rows = flags.filter((f) => (tab === "all" || (tab === "on" ? f.enabled : !f.enabled)) && (!search || `${f.key} ${f.description ?? ""}`.toLowerCase().includes(search.toLowerCase())));
  const { sorted, sort, toggle } = useClientSort(rows, { key: (f) => f.key, enabled: (f) => (f.enabled ? 0 : 1), rollout: (f) => f.rollout_percentage, updated: (f) => f.updated_at });
  const on = flags.filter((f) => f.enabled).length;
  const targeting = (f: FlagRow) => [f.plan_codes.length ? `${f.plan_codes.length} plan${f.plan_codes.length > 1 ? "s" : ""}` : null, f.organization_ids.length ? `${f.organization_ids.length} org${f.organization_ids.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") || "Everyone";
  const menu = (f: FlagRow) => [
    { label: "Edit targeting", icon: Pencil, onSelect: () => setEditing(f) },
    { label: f.enabled ? "Disable…" : "Enable…", icon: f.enabled ? PowerOff : Power, destructive: f.enabled, onSelect: () => setToggling(f) },
  ];
  return (
    <>
      <SectionHeader title="Feature flags" description="Gradual rollouts and kill switches evaluated server-side. Every change is audited." actions={<Button size="sm" onClick={() => setEditing("new")}><Plus /> New flag</Button>} />
      <KpiGrid className="mb-4 grid-cols-3">
        <Kpi label="Flags" value={flags.length} icon={Flag} tone="ice" sub="Defined" loading={q.isLoading} />
        <Kpi label="Enabled" value={on} icon={Power} tone="success" sub="Serving traffic" loading={q.isLoading} />
        <Kpi label="Partial rollout" value={flags.filter((f) => f.enabled && f.rollout_percentage < 100).length} icon={Flag} tone="amber" sub="Under 100%" loading={q.isLoading} />
      </KpiGrid>
      <StatusTabs id="flags" className="mb-3 w-fit" value={tab} onChange={setTab} items={[{ value: "all", label: "All", count: flags.length }, { value: "on", label: "Enabled", count: on }, { value: "off", label: "Disabled", count: flags.length - on }]} />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} base="A–Z by key" />}><SearchInput value={search} onChange={setSearch} placeholder="Search key or description" /></Toolbar>
        <Responsive
          table={
            <DataTable colSpan={6} minWidth={820} loading={q.isLoading} empty={q.data && !sorted.length ? <EmptyState compact icon={Flag} title="No flags here" description="Create a flag to gate a feature." /> : false} caption="Feature flags"
              head={<><Th sortKey="key" sort={sort} onSort={toggle}>Flag</Th><Th sortKey="enabled" sort={sort} onSort={toggle}>State</Th><Th sortKey="rollout" sort={sort} onSort={toggle}>Rollout</Th><Th>Targeting</Th><Th sortKey="updated" sort={sort} onSort={toggle}>Updated</Th><Th srOnly>Actions</Th></>}>
              {sorted.map((f) => (
                <Row key={f.id}>
                  <Td className="max-w-[360px]"><code className="font-mono text-[12.5px] text-foreground">{f.key}</code><p className="truncate text-[12px] text-muted-foreground">{f.description}</p></Td>
                  <Td><span className="flex items-center gap-2.5"><Switch checked={f.enabled} onCheckedChange={() => setToggling(f)} aria-label={`${f.enabled ? "Disable" : "Enable"} ${f.key}`} /><span className={cn("font-mono text-[10.5px] uppercase tracking-[0.1em]", f.enabled ? "text-success" : "text-subtle-foreground")}>{f.enabled ? "On" : "Off"}</span></span></Td>
                  <Td className="w-44"><div className="flex items-center gap-2"><Meter value={f.rollout_percentage} max={100} tone={f.enabled ? "signal" : "neutral"} label={`${f.key} rollout`} /><span className="w-9 text-right font-mono text-[11px] tabular">{f.rollout_percentage}%</span></div></Td>
                  <Td className="font-mono text-[11px]">{targeting(f)}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11px]">{relTime(f.updated_at)}</Td>
                  <Td align="right"><RowMenu items={menu(f)} label={`Actions for ${f.key}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            !sorted.length ? <EmptyLine>No flags</EmptyLine> : sorted.map((f) => (
              <MobileCard key={f.id}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1"><code className="block truncate font-mono text-[12.5px] text-foreground">{f.key}</code><p className="font-mono text-[10.5px] text-subtle-foreground">{f.rollout_percentage}% · {targeting(f)}</p></div>
                  <Switch checked={f.enabled} onCheckedChange={() => setToggling(f)} aria-label={`Toggle ${f.key}`} />
                  <RowMenu items={menu(f)} />
                </div>
              </MobileCard>
            ))
          }
        />
      </Panel>
      <FlagDialog flag={editing} onClose={() => setEditing(null)} />
      <ControlledConfirm
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={`${toggling?.enabled ? "Disable" : "Enable"} ${toggling?.key ?? ""}?`}
        description={toggling?.enabled ? "Targeted organizations lose this feature immediately." : `Targeted organizations get this feature immediately (${toggling?.rollout_percentage ?? 0}% rollout).`}
        confirmLabel={toggling?.enabled ? "Disable flag" : "Enable flag"}
        destructive={toggling?.enabled}
        onConfirm={async () => {
          try { await adminPatch(`/feature-flags/${toggling!.id}`, { enabled: !toggling!.enabled }); toast.success("Flag updated"); qc.invalidateQueries({ queryKey: ["admin", "/feature-flags"] }); }
          catch (e) { toast.error(errorMessage(e)); }
        }}
      />
    </>
  );
}
