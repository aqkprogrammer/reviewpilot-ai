"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import { KeyValue, Panel, QueryState, SectionHeader, adminPut, relTime, useAdmin } from "@/components/admin/ui";

interface SettingsResp { settings: { id: string; key: string; value: Record<string, unknown>; description: string | null; updated_at: string }[]; environment: Record<string, string | number | boolean> }

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useAdmin<SettingsResp>("/settings");
  const [editing, setEditing] = React.useState<{ key: string; value: string; description: string; isNew: boolean } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      let value: unknown;
      try { value = JSON.parse(editing!.value); } catch { throw new Error("Value must be valid JSON, e.g. {\"value\": 18}"); }
      if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Value must be a JSON object");
      return adminPut(`/settings/${encodeURIComponent(editing!.key)}`, { value, description: editing!.description || null });
    },
    onSuccess: () => { toast.success("Setting saved"); qc.invalidateQueries({ queryKey: ["admin", "/settings"] }); setEditing(null); },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <>
      <SectionHeader eyebrow="Governance" title="Settings" description="Platform-wide configuration stored in the database. Secrets live only in environment variables." actions={<Button size="sm" onClick={() => { setErr(null); setEditing({ key: "", value: "{\n  \"value\": \"\"\n}", description: "", isNew: true }); }}><Plus /> Add setting</Button>} />
      <QueryState query={q}>
        {q.data && (
          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <Panel title="System settings" flush>
              <ul className="divide-y divide-border">
                {q.data.settings.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <code className="font-mono text-[12.5px] text-foreground">{s.key}</code>
                      {s.description && <p className="mt-0.5 text-[12px] text-muted-foreground">{s.description}</p>}
                      <pre className="mt-2 max-w-full overflow-x-auto rounded-lg border border-border bg-background-subtle px-3 py-2 font-mono text-[11.5px] text-[#7eaaff] scrollbar-thin">{JSON.stringify(s.value)}</pre>
                      <p className="mt-1 text-[11px] text-subtle-foreground">Updated {relTime(s.updated_at)}</p>
                    </div>
                    <Button variant="ghost" size="icon-xs" aria-label={`Edit ${s.key}`} onClick={() => { setErr(null); setEditing({ key: s.key, value: JSON.stringify(s.value, null, 2), description: s.description ?? "", isNew: false }); }}><Pencil /></Button>
                  </li>
                ))}
              </ul>
            </Panel>
            <div className="space-y-4">
              <Panel title="Runtime environment" description="Read-only — set via environment variables">
                <KeyValue className="sm:grid-cols-1" items={Object.entries(q.data.environment).map(([k, v]) => [titleCase(k), typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)])} />
              </Panel>
              <InlineAlert variant="info" icon={Lock} title="Secrets are never stored here">API keys, OAuth secrets and webhook secrets are configured through the deployment environment and are not readable from the console.</InlineAlert>
            </div>
          </div>
        )}
      </QueryState>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.isNew ? "Add setting" : editing?.key}</DialogTitle><DialogDescription>Changes are audited with before/after values.</DialogDescription></DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(); }}>
              {editing.isNew && <FormField label="Key" htmlFor="s-key" hint="e.g. support.response_sla_hours"><Input id="s-key" value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} className="font-mono" /></FormField>}
              <FormField label="Value (JSON object)" htmlFor="s-val"><Textarea id="s-val" rows={6} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="font-mono text-[12.5px]" /></FormField>
              <FormField label="Description" htmlFor="s-desc"><Input id="s-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></FormField>
              {err && <p className="text-[13px] text-danger-foreground" role="alert">{err}</p>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={save.isPending} disabled={!editing.key}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
