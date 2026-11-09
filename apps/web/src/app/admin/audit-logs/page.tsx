"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Lock, ScrollText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { useMe } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";
import { ClearFilters, DataTable, FilterSelect, MobileCard, Pagination, Responsive, Row, SearchInput, Td, Th, Toolbar } from "@/components/admin/table";
import { CopyId, EmptyLine, KeyValue, Panel, SectionHeader, stamp, useAdmin, type AdminPage } from "@/components/admin/ui";

interface LogRow { id: string; seq: number; created_at: string; actor_email: string | null; actor_type: string; organization_id: string | null; organization_name: string | null; action: string; target_type: string | null; target_id: string | null; ip_address: string | null; user_agent: string | null; meta: Record<string, unknown> }

const PRESETS = [
  { value: "", label: "All" },
  { value: "admin.", label: "admin.*" },
  { value: "auth.", label: "auth.*" },
  { value: "billing.", label: "billing.*" },
  { value: "review", label: "review*" },
  { value: "campaign", label: "campaign*" },
];

const actionTone = (a: string) => (a.startsWith("admin.") ? "text-amber" : a.includes("fail") || a.includes("denied") ? "text-danger-foreground" : "text-primary");

function AuditInner() {
  const params = useSearchParams();
  const me = useMe();
  const [action, setAction] = React.useState("");
  const [actor, setActor] = React.useState(params.get("actor") ?? "");
  const [actorType, setActorType] = React.useState("");
  const [orgId, setOrgId] = React.useState(params.get("organization_id") ?? "");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [selected, setSelected] = React.useState<LogRow | null>(null);
  React.useEffect(() => { if (params.get("mine") && me.data) setActor(me.data.user.email); }, [params, me.data]);
  React.useEffect(() => setPage(1), [action, actor, actorType, from, to, orgId, pageSize]);
  const q = useAdmin<AdminPage<LogRow>>("/audit-logs", { page, page_size: pageSize, action, actor, actor_type: actorType, organization_id: orgId, date_from: from, date_to: to });
  const d = q.data;
  const orgName = orgId ? d?.items.find((l) => l.organization_id === orgId)?.organization_name : null;
  const exportJson = () => {
    if (!d) return;
    const blob = new Blob([JSON.stringify(d.items, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-page-${page}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <SectionHeader
        title="Audit logs"
        description="Append-only record of security-relevant and administrative actions. Rows can't be edited or deleted — enforced by a database trigger."
        meta={d ? `${formatNumber(d.total)} entries · immutable` : undefined}
        actions={<Button variant="outline" size="sm" onClick={exportJson} disabled={!d?.items.length}><Download /> Export page JSON</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Action presets" className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setAction(p.value)} aria-pressed={action === p.value}
              className={cn("h-7 rounded-md border px-2.5 font-mono text-[11px] transition-colors", action === p.value ? "border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
        {orgId && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft pl-2.5 pr-1 font-mono text-[11px] text-primary">
            org = {orgName ?? orgId.slice(0, 8)}
            <button type="button" onClick={() => setOrgId("")} className="rounded p-0.5 hover:bg-primary-soft" aria-label="Remove organization filter"><X className="size-3" /></button>
          </span>
        )}
      </div>
      <Panel flush>
        <Toolbar>
          <SearchInput value={action} onChange={setAction} placeholder="Action prefix, e.g. admin." className="sm:w-48" />
          <SearchInput value={actor} onChange={setActor} placeholder="Actor email" className="sm:w-48" />
          <FilterSelect value={actorType} onChange={setActorType} placeholder="All actors" options={[{ value: "user", label: "Users" }, { value: "super_admin", label: "Super admins" }, { value: "system", label: "System" }]} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 font-mono text-[12px] sm:w-[136px]" aria-label="From date" max={to || undefined} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 font-mono text-[12px] sm:w-[136px]" aria-label="To date" min={from || undefined} />
          <ClearFilters active={!!(action || actor || actorType || from || to || orgId)} onClear={() => { setAction(""); setActor(""); setActorType(""); setFrom(""); setTo(""); setOrgId(""); }} />
        </Toolbar>
        <Responsive
          table={
            <DataTable colSpan={7} loading={q.isLoading} empty={!!d && !d.items.length} minWidth={1000} maxHeight={680} caption="Audit log"
              head={<><Th>Seq</Th><Th>Timestamp</Th><Th>Action</Th><Th>Actor</Th><Th>Target</Th><Th>Organization</Th><Th>IP</Th></>}>
              {d?.items.map((l) => (
                <Row key={l.id} onClick={() => setSelected(l)} selected={selected?.id === l.id}>
                  <Td className="font-mono text-[11px] tabular text-subtle-foreground">{String(l.seq).padStart(5, "0")}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{stamp(l.created_at)}</Td>
                  <Td><code className={cn("font-mono text-[11.5px]", actionTone(l.action))}>{l.action}</code></Td>
                  <Td className="max-w-[260px]"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-[12.5px] text-foreground">{l.actor_email ?? "—"}</span><span className={cn("shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em]", l.actor_type === "super_admin" ? "text-amber" : "text-subtle-foreground")}>{l.actor_type.replace("_", " ")}</span></span></Td>
                  <Td className="font-mono text-[11px]">{l.target_type ? <>{l.target_type}<span className="text-subtle-foreground">:{(l.target_id ?? "").slice(0, 8)}</span></> : "—"}</Td>
                  <Td className="max-w-[180px] truncate text-[12.5px]">{l.organization_name ?? <span className="text-subtle-foreground">—</span>}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">{l.ip_address ?? "—"}</Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : !d?.items.length ? <EmptyLine>No entries match</EmptyLine>
            : d.items.map((l) => (
              <MobileCard key={l.id} onClick={() => setSelected(l)}>
                <div className="flex items-center gap-2"><code className={cn("min-w-0 flex-1 truncate font-mono text-[12px]", actionTone(l.action))}>{l.action}</code><span className="font-mono text-[10px] text-subtle-foreground">#{l.seq}</span></div>
                <p className="truncate font-mono text-[10.5px] text-muted-foreground">{stamp(l.created_at)} · {l.actor_email ?? l.actor_type}</p>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="entries" pageSize={pageSize} onPageSize={setPageSize} sizes={[25, 50, 100, 200]} />}
      </Panel>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-[560px]">
          <SheetHeader>
            <p className="micro-label mb-1 flex items-center gap-1.5"><ScrollText className="size-3" /> Audit entry · seq {selected?.seq}</p>
            <SheetTitle className="font-mono text-[15px]"><span className={selected ? actionTone(selected.action) : ""}>{selected?.action}</span></SheetTitle>
            <SheetDescription>{selected ? stamp(selected.created_at) : ""}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {selected && (
              <div className="space-y-5">
                <KeyValue items={[
                  ["Actor", selected.actor_email ?? "—"],
                  ["Actor type", <span key="t" className="font-mono text-[12px]">{selected.actor_type}</span>],
                  ["IP address", <span key="ip" className="font-mono text-[12px]">{selected.ip_address ?? "—"}</span>],
                  ["Organization", selected.organization_id ? <Link key="o" href={`/admin/organizations/${selected.organization_id}`} className="text-primary hover:underline">{selected.organization_name ?? selected.organization_id.slice(0, 8)}</Link> : "—"],
                  ["Target type", <span key="tt" className="font-mono text-[12px]">{selected.target_type ?? "—"}</span>],
                  ["Target ID", selected.target_id ? <CopyId key="tid" value={selected.target_id} display={selected.target_id.slice(0, 18)} /> : "—"],
                ]} />
                <div><p className="micro-label mb-1.5">User agent</p><p className="break-all font-mono text-[11px] leading-relaxed text-foreground-soft">{selected.user_agent ?? "—"}</p></div>
                <div>
                  <p className="micro-label mb-1.5">Metadata</p>
                  <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background-subtle p-3 font-mono text-[11.5px] leading-relaxed text-foreground-soft scrollbar-thin">{JSON.stringify(selected.meta, null, 2)}</pre>
                </div>
                <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground"><Lock className="size-3" /> Entry id <CopyId value={selected.id} display={selected.id.slice(0, 13)} className="text-[10.5px]" /></p>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function AuditLogsPage() {
  return <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}><AuditInner /></React.Suspense>;
}
