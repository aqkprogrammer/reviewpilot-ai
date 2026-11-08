"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import { ControlledConfirm } from "@/components/admin/reason-dialog";
import { Bar, DataTable, Panel, Row, SectionHeader, Td, Th, adminPatch, adminPost, relTime, useAdmin, type AdminPage } from "@/components/admin/ui";

interface FlagRow { id: string; key: string; description: string | null; enabled: boolean; rollout_percentage: number; organization_ids: string[]; plan_codes: string[]; updated_at: string }
const PLANS = ["starter", "growth", "agency", "enterprise"];

function FlagDialog({ flag, onClose }: { flag: FlagRow | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = flag === "new";
  const [f, setF] = React.useState({ key: "", description: "", enabled: false, rollout_percentage: 100, plan_codes: [] as string[], organization_ids: [] as string[] });
  const [err, setErr] = React.useState<string | null>(null);
  const orgs = useAdmin<AdminPage<{ id: string; name: string }>>("/organizations", { page_size: 100 }, { enabled: !!flag });
  React.useEffect(() => {
    setErr(null);
    if (flag && flag !== "new") setF({ key: flag.key, description: flag.description ?? "", enabled: flag.enabled, rollout_percentage: flag.rollout_percentage, plan_codes: flag.plan_codes, organization_ids: flag.organization_ids });
    else if (flag === "new") setF({ key: "", description: "", enabled: false, rollout_percentage: 100, plan_codes: [], organization_ids: [] });
  }, [flag]);
  const save = useMutation({
    mutationFn: () => isNew ? adminPost("/feature-flags", f) : adminPatch(`/feature-flags/${(flag as FlagRow).id}`, { description: f.description, enabled: f.enabled, rollout_percentage: f.rollout_percentage, plan_codes: f.plan_codes, organization_ids: f.organization_ids }),
    onSuccess: () => { toast.success(isNew ? "Flag created" : "Flag updated"); qc.invalidateQueries({ queryKey: ["admin", "/feature-flags"] }); onClose(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggle = (k: "plan_codes" | "organization_ids", v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  return (
    <Dialog open={!!flag} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{isNew ? "New feature flag" : f.key}</DialogTitle><DialogDescription>Targeting: explicit organizations and plans are always included; others get the rollout percentage.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (isNew && !/^[a-z][a-z0-9_.]{1,95}$/.test(f.key)) { setErr("Key must be lowercase snake_case"); return; } save.mutate(); }}>
          {isNew && <FormField label="Key" htmlFor="ff-key"><Input id="ff-key" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} className="font-mono" placeholder="e.g. smart_reminders" /></FormField>}
          <FormField label="Description" htmlFor="ff-desc"><Input id="ff-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-[13px]">Enabled<Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} /></label>
            <FormField label={`Rollout: ${f.rollout_percentage}%`} htmlFor="ff-roll"><input id="ff-roll" type="range" min={0} max={100} step={5} value={f.rollout_percentage} onChange={(e) => setF({ ...f, rollout_percentage: Number(e.target.value) })} className="w-full accent-[#2f7bff]" /></FormField>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground-soft">Plans</p>
            <div className="flex flex-wrap gap-2">{PLANS.map((p) => <label key={p} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px]"><Checkbox checked={f.plan_codes.includes(p)} onCheckedChange={() => toggle("plan_codes", p)} />{titleCase(p)}</label>)}</div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground-soft">Organization allow-list</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2 scrollbar-thin">
              {orgs.data?.items.map((o) => <label key={o.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted"><Checkbox checked={f.organization_ids.includes(o.id)} onCheckedChange={() => toggle("organization_ids", o.id)} />{o.name}</label>)}
            </div>
          </div>
          {err && <p className="text-[13px] text-danger-foreground" role="alert">{err}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{isNew ? "Create flag" : "Save"}</Button></DialogFooter>
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
  return (
    <>
      <SectionHeader eyebrow="Governance" title="Feature flags" description="Gradual rollouts and kill switches. Every change is audited." actions={<Button size="sm" onClick={() => setEditing("new")}><Plus /> New flag</Button>} />
      <Panel flush bodyClassName="mt-0">
        <DataTable colSpan={6} loading={q.isLoading} empty={q.data && !q.data.length ? <EmptyState compact icon={Flag} title="No flags" description="Create a flag to gate a feature." /> : false}
          head={<><Th>Flag</Th><Th>Enabled</Th><Th>Rollout</Th><Th>Targeting</Th><Th>Updated</Th><Th /></>}>
          {q.data?.map((f) => (
            <Row key={f.id}>
              <Td><code className="font-mono text-[12.5px] text-foreground">{f.key}</code><p className="text-[12px] text-muted-foreground">{f.description}</p></Td>
              <Td><Switch checked={f.enabled} onCheckedChange={() => setToggling(f)} aria-label={`Toggle ${f.key}`} /></Td>
              <Td className="w-40"><div className="flex items-center gap-2"><Bar value={f.rollout_percentage} max={100} /><span className="font-mono text-[11.5px]">{f.rollout_percentage}%</span></div></Td>
              <Td className="text-[12px]">{[f.plan_codes.length ? `${f.plan_codes.length} plan(s)` : null, f.organization_ids.length ? `${f.organization_ids.length} org(s)` : null].filter(Boolean).join(" · ") || "Everyone"}</Td>
              <Td>{relTime(f.updated_at)}</Td>
              <Td align="right"><Button variant="ghost" size="icon-xs" onClick={() => setEditing(f)} aria-label={`Edit ${f.key}`}><Pencil /></Button></Td>
            </Row>
          ))}
        </DataTable>
      </Panel>
      <FlagDialog flag={editing} onClose={() => setEditing(null)} />
      <ControlledConfirm
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={`${toggling?.enabled ? "Disable" : "Enable"} ${toggling?.key ?? ""}?`}
        description="The change takes effect for targeted organizations immediately."
        confirmLabel={toggling?.enabled ? "Disable" : "Enable"}
        destructive={toggling?.enabled}
        onConfirm={async () => {
          try { await adminPatch(`/feature-flags/${toggling!.id}`, { enabled: !toggling!.enabled }); toast.success("Flag updated"); qc.invalidateQueries({ queryKey: ["admin", "/feature-flags"] }); }
          catch (e) { toast.error(errorMessage(e)); }
        }}
      />
    </>
  );
}
