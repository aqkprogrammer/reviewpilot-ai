"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { titleCase } from "@/lib/utils";
import { DataTable, FilterBar, FilterSelect, Pagination, Panel, Row, SearchInput, SectionHeader, StatusPill, Td, Th, opts, relTime, useAdmin, type AdminPage } from "@/components/admin/ui";

interface TicketRow { id: string; subject: string; category: string; status: string; priority: string; organization_name: string | null; requester_name: string | null; requester_email: string | null; assignee_name: string | null; data_access_active: boolean; created_at: string; updated_at: string }

export default function SupportPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState("open");
  const [priority, setPriority] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status, priority, assignee, q]);
  const query = useAdmin<AdminPage<TicketRow> & { counts: Record<string, number> }>("/support/tickets", { page, page_size: 25, status: status === "all" ? "" : status, priority, assignee, q });
  const d = query.data;
  return (
    <>
      <SectionHeader eyebrow="Engagement" title="Support tickets" description="Customer conversations, internal notes and time-boxed data-access grants." />
      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList>
          {["open", "pending", "resolved", "closed", "all"].map((s) => (
            <TabsTrigger key={s} value={s}>{titleCase(s)}{s !== "all" && d?.counts?.[s] ? <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[10px]">{d.counts[s]}</span> : null}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Subject or organization" />
          <FilterSelect value={priority} onChange={setPriority} placeholder="Any priority" options={opts(["urgent", "high", "normal", "low"])} />
          <FilterSelect value={assignee} onChange={setAssignee} placeholder="Anyone" options={[{ value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }]} />
        </FilterBar>
        <DataTable colSpan={7} loading={query.isLoading} empty={d && !d.items.length} head={<><Th>Ticket</Th><Th>Organization</Th><Th>Priority</Th><Th>Status</Th><Th>Assignee</Th><Th>Access</Th><Th>Updated</Th></>}>
          {d?.items.map((t) => (
            <Row key={t.id} onClick={() => router.push(`/admin/support/${t.id}`)}>
              <Td><p className="font-medium text-foreground">{t.subject}</p><p className="text-[11.5px] text-muted-foreground">{titleCase(t.category)} · {t.requester_name ?? t.requester_email ?? "Unknown"}</p></Td>
              <Td>{t.organization_name ?? "—"}</Td>
              <Td><StatusPill status={t.priority} /></Td>
              <Td><StatusPill status={t.status} /></Td>
              <Td>{t.assignee_name ?? <span className="text-subtle-foreground">Unassigned</span>}</Td>
              <Td>{t.data_access_active ? <span className="inline-flex items-center gap-1 text-[12px] text-success-foreground"><KeyRound className="size-3.5" /> Granted</span> : <span className="text-subtle-foreground">—</span>}</Td>
              <Td>{relTime(t.updated_at)}</Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="tickets" />}
      </Panel>
    </>
  );
}
