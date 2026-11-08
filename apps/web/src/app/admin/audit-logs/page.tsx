"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { useMe } from "@/lib/session";
import { DataTable, FilterBar, FilterSelect, KeyValue, Pagination, Panel, Row, SearchInput, SectionHeader, Td, Th, useAdmin, type AdminPage } from "@/components/admin/ui";

interface LogRow { id: string; seq: number; created_at: string; actor_email: string | null; actor_type: string; organization_id: string | null; organization_name: string | null; action: string; target_type: string | null; target_id: string | null; ip_address: string | null; user_agent: string | null; meta: Record<string, unknown> }

const ts = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function AuditInner() {
  const params = useSearchParams();
  const me = useMe();
  const [action, setAction] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [actorType, setActorType] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<LogRow | null>(null);
  React.useEffect(() => { if (params.get("mine") && me.data) setActor(me.data.user.email); }, [params, me.data]);
  React.useEffect(() => setPage(1), [action, actor, actorType, from, to]);
  const q = useAdmin<AdminPage<LogRow>>("/audit-logs", { page, page_size: 50, action, actor, actor_type: actorType, date_from: from, date_to: to });
  const d = q.data;
  return (
    <>
      <SectionHeader eyebrow="Governance" title="Audit logs" description="Append-only record of security-relevant and administrative actions. Rows can't be edited or deleted — enforced by a database trigger." />
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={action} onChange={setAction} placeholder="Action prefix, e.g. admin." className="sm:w-52" />
          <SearchInput value={actor} onChange={setActor} placeholder="Actor email" className="sm:w-52" />
          <FilterSelect value={actorType} onChange={setActorType} placeholder="All actors" options={[{ value: "user", label: "Users" }, { value: "super_admin", label: "Super Admins" }, { value: "system", label: "System" }]} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 sm:w-40" aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 sm:w-40" aria-label="To date" />
        </FilterBar>
        <DataTable colSpan={6} loading={q.isLoading} empty={d && !d.items.length} minWidth={860} head={<><Th>#</Th><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Organization</Th></>}>
          {d?.items.map((l) => (
            <Row key={l.id} onClick={() => setSelected(l)}>
              <Td className="font-mono text-[11.5px] text-subtle-foreground">{l.seq}</Td>
              <Td className="whitespace-nowrap font-mono text-[12px]">{ts(l.created_at)}</Td>
              <Td><span className="block truncate text-foreground">{l.actor_email ?? "—"}</span><span className="text-[11px] text-subtle-foreground">{l.actor_type}{l.ip_address ? ` · ${l.ip_address}` : ""}</span></Td>
              <Td><code className="rounded-md border border-border bg-background-subtle px-1.5 py-0.5 font-mono text-[11.5px] text-[#7eaaff]">{l.action}</code></Td>
              <Td className="font-mono text-[11.5px]">{l.target_type ? `${l.target_type}:${(l.target_id ?? "").slice(0, 8)}` : "—"}</Td>
              <Td>{l.organization_name ?? "—"}</Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="entries" />}
      </Panel>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle className="flex items-center gap-2"><ScrollText className="size-4" /> Audit entry #{selected?.seq}</SheetTitle><SheetDescription>{selected?.action}</SheetDescription></SheetHeader>
          <SheetBody>
            {selected && (
              <div className="space-y-5">
                <KeyValue items={[["Time", ts(selected.created_at)], ["Actor", selected.actor_email ?? "—"], ["Actor type", selected.actor_type], ["IP", selected.ip_address ?? "—"], ["Target", selected.target_type ? `${selected.target_type} ${selected.target_id}` : "—"], ["Organization", selected.organization_name ?? "—"]]} />
                <div><p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-subtle-foreground">User agent</p><p className="break-all text-[12px] text-foreground-soft">{selected.user_agent ?? "—"}</p></div>
                <div><p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-subtle-foreground">Metadata</p><pre className="max-h-80 overflow-auto rounded-xl border border-border bg-background-subtle p-3 font-mono text-[11.5px] text-foreground-soft scrollbar-thin">{JSON.stringify(selected.meta, null, 2)}</pre></div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function AuditLogsPage() {
  return <React.Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}><AuditInner /></React.Suspense>;
}
