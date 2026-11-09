"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil, Plus, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/tech";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SearchInput, Toolbar } from "@/components/admin/table";
import { EmptyLine, Notice, Panel, QueryState, SectionHeader, adminPut, relTime, useAdmin } from "@/components/admin/ui";

interface SettingsResp { settings: { id: string; key: string; value: Record<string, unknown>; description: string | null; updated_at: string }[]; environment: Record<string, string | number | boolean> }
const SENSITIVE = ["secret", "token", "password", "key"];

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useAdmin<SettingsResp>("/settings");
  const [editing, setEditing] = React.useState<{ key: string; value: string; description: string; isNew: boolean } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const parsed = React.useMemo(() => {
    if (!editing) return null;
    try { const v = JSON.parse(editing.value); return typeof v === "object" && v && !Array.isArray(v) ? { ok: true as const } : { ok: false as const, msg: "Value must be a JSON object" }; }
    catch (e) { return { ok: false as const, msg: e instanceof Error ? e.message : "Invalid JSON" }; }
  }, [editing]);
  const keyBlocked = !!editing?.isNew && SENSITIVE.some((h) => editing.key.toLowerCase().includes(h));
  const save = useMutation({
    mutationFn: () => adminPut(`/settings/${encodeURIComponent(editing!.key)}`, { value: JSON.parse(editing!.value), description: editing!.description || null }),
    onSuccess: () => { toast.success("Setting saved"); qc.invalidateQueries({ queryKey: ["admin", "/settings"] }); setEditing(null); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const rows = (q.data?.settings ?? []).filter((s) => !search || `${s.key} ${s.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <SectionHeader title="Settings" description="Platform-wide configuration stored in the database. Secrets live only in environment variables and are never readable here." actions={<Button size="sm" onClick={() => { setErr(null); setEditing({ key: "", value: "{\n  \"value\": \"\"\n}", description: "", isNew: true }); }}><Plus /> Add setting</Button>} meta={q.data ? `${q.data.settings.length} keys` : undefined} />
      <QueryState query={q}>
        {q.data && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel title="System settings" description="JSON values · before/after diff recorded on every change" flush>
              <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Filter keys" /></Toolbar>
              <ul className="divide-y divide-border">
                {rows.map((s) => (
                  <li key={s.id} className="group grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-[12.5px] text-foreground">{s.key}</code>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">updated {relTime(s.updated_at)}</span>
                      </div>
                      {s.description && <p className="mt-0.5 text-[12px] text-muted-foreground">{s.description}</p>}
                      <pre className="mt-2 max-w-full overflow-x-auto rounded-md border border-border bg-background-subtle px-3 py-2 font-mono text-[11.5px] text-primary scrollbar-thin">{JSON.stringify(s.value)}</pre>
                    </div>
                    <Button variant="outline" size="xs" className="self-start" aria-label={`Edit ${s.key}`} onClick={() => { setErr(null); setEditing({ key: s.key, value: JSON.stringify(s.value, null, 2), description: s.description ?? "", isNew: false }); }}><Pencil /> Edit</Button>
                  </li>
                ))}
                {!rows.length && <li><EmptyLine>No settings match</EmptyLine></li>}
              </ul>
            </Panel>
            <div className="space-y-4">
              <Panel title="Runtime environment" description="Read-only · set via environment variables" actions={<ServerCog className="size-4 text-subtle-foreground" />} flush>
                <dl className="divide-y divide-border">
                  {Object.entries(q.data.environment).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-4 py-2">
                      <dt className="font-mono text-[11px] text-muted-foreground">{k}</dt>
                      <dd className={cn("truncate font-mono text-[11.5px] tabular", typeof v === "boolean" ? (v ? "text-success" : "text-subtle-foreground") : "text-foreground")}>
                        {typeof v === "boolean" ? <span className="inline-flex items-center gap-1.5"><StatusDot tone={v ? "ok" : "idle"} />{v ? "true" : "false"}</span> : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Notice tone="ice" icon={Lock}><span className="font-medium text-foreground">Secrets are never stored here.</span> API keys, OAuth client secrets and webhook secrets are configured through the deployment environment. Keys containing <span className="font-mono">secret</span>, <span className="font-mono">token</span>, <span className="font-mono">password</span> or <span className="font-mono">key</span> are rejected by the API.</Notice>
            </div>
          </div>
        )}
      </QueryState>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <p className="micro-label">System setting · {editing?.isNew ? "new" : "edit"}</p>
            <DialogTitle className={cn(!editing?.isNew && "font-mono text-[15px]")}>{editing?.isNew ? "Add setting" : editing?.key}</DialogTitle>
            <DialogDescription>Changes are audited with before/after values.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(null); if (parsed?.ok && !keyBlocked) save.mutate(); }}>
              {editing.isNew && (
                <FormField label="Key" htmlFor="s-key" hint="e.g. support.response_sla_hours" error={keyBlocked ? "Secrets belong in environment variables, not settings." : undefined}>
                  <Input id="s-key" value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} className="font-mono" invalid={keyBlocked} />
                </FormField>
              )}
              <FormField label="Value (JSON object)" htmlFor="s-val" error={parsed && !parsed.ok ? parsed.msg : undefined} hint={parsed?.ok ? "Valid JSON" : undefined}>
                <Textarea id="s-val" rows={7} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="font-mono text-[12.5px]" invalid={!!parsed && !parsed.ok} spellCheck={false} />
              </FormField>
              <FormField label="Description" htmlFor="s-desc"><Input id="s-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></FormField>
              {err && <Notice tone="danger">{err}</Notice>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={save.isPending} disabled={!editing.key || !parsed?.ok || keyBlocked}>Save setting</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
