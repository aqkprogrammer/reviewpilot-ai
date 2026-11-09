"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, KeyRound, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { useMe } from "@/lib/session";
import { cn, titleCase } from "@/lib/utils";
import { BulkActionDialog } from "@/components/admin/bulk";
import {
  BulkBar, ClearFilters, DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SearchInput, SelectCell, SelectHead, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort, useSelection,
} from "@/components/admin/table";
import { EmptyLine, Monogram, Panel, SectionHeader, StatusPill, adminPatch, opts, relTime, shortId, useAdmin, type AdminPage } from "@/components/admin/ui";

interface TicketRow { id: string; subject: string; category: string; status: string; priority: string; organization_name: string | null; requester_name: string | null; requester_email: string | null; assignee_id?: string | null; assignee_name: string | null; data_access_active: boolean; created_at: string; updated_at: string }
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function PriorityMark({ p }: { p: string }) {
  const bars = { urgent: 4, high: 3, normal: 2, low: 1 }[p] ?? 1;
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${p} priority`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-[1px]", i <= bars ? (p === "urgent" ? "bg-danger" : p === "high" ? "bg-amber" : "bg-foreground-soft") : "bg-border-strong")} style={{ height: 3 + i * 2.5 }} />
        ))}
      </span>
      <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.1em]", p === "urgent" ? "text-danger-foreground" : p === "high" ? "text-amber" : "text-muted-foreground")}>{p}</span>
    </span>
  );
}

function SupportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const me = useMe();
  const [status, setStatus] = React.useState(params.get("status") ?? "open");
  const [priority, setPriority] = React.useState(params.get("priority") ?? "");
  const [assignee, setAssignee] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [bulk, setBulk] = React.useState<null | "assign" | "resolve">(null);
  React.useEffect(() => setPage(1), [status, priority, assignee, q, pageSize]);
  const query = useAdmin<AdminPage<TicketRow> & { counts: Record<string, number> }>("/support/tickets", { page, page_size: pageSize, status: status === "all" ? "" : status, priority, assignee, q });
  const d = query.data;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    subject: (t) => t.subject, org: (t) => t.organization_name, priority: (t) => PRIORITY_RANK[t.priority] ?? 9, status: (t) => t.status, assignee: (t) => t.assignee_name, updated: (t) => t.updated_at,
  });
  const ran = React.useRef(false);
  const sel = useSelection(sorted.map((t) => t.id));
  const selectedRows = sorted.filter((t) => sel.selected.has(t.id));
  const total = d ? Object.values(d.counts).reduce((a, b) => a + b, 0) : undefined;
  const myId = me.data?.user.id;
  const open = (id: string) => router.push(`/admin/support/${id}`);

  return (
    <>
      <SectionHeader title="Support desk" description="Customer conversations, internal notes and time-boxed data-access grants. Customer content is only visible while a grant is active." meta={total != null ? `${total} tickets` : undefined} />
      <StatusTabs
        id="ticket-status"
        className="mb-3 w-fit"
        value={status}
        onChange={setStatus}
        items={["open", "pending", "resolved", "closed", "all"].map((s) => ({ value: s, label: titleCase(s), count: s === "all" ? total : d?.counts?.[s] ?? 0, tone: s === "open" ? "warning" : undefined }))}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} base="Recently updated" />}>
          <SearchInput value={q} onChange={setQ} placeholder="Subject or organization" />
          <FilterSelect value={priority} onChange={setPriority} placeholder="Any priority" options={opts(["urgent", "high", "normal", "low"])} />
          <FilterSelect value={assignee} onChange={setAssignee} placeholder="Anyone" options={[{ value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }]} />
          <ClearFilters active={!!(q || priority || assignee)} onClear={() => { setQ(""); setPriority(""); setAssignee(""); }} />
        </Toolbar>
        <BulkBar count={sel.count} noun="tickets selected" onClear={sel.clear}>
          <Button size="xs" variant="outline" onClick={() => setBulk("assign")}><UserCheck /> Assign to me</Button>
          <Button size="xs" variant="soft" onClick={() => setBulk("resolve")}><CheckCircle2 /> Mark resolved</Button>
        </BulkBar>
        <Responsive
          table={
            <DataTable colSpan={9} minWidth={1040} loading={query.isLoading} empty={!!d && !d.items.length} caption="Support tickets"
              head={<>
                <SelectHead all={sel.all} some={sel.some} onToggle={sel.toggleAll} />
                <Th sortKey="subject" sort={sort} onSort={toggle}>Ticket</Th>
                <Th sortKey="org" sort={sort} onSort={toggle}>Organization</Th>
                <Th sortKey="priority" sort={sort} onSort={toggle}>Priority</Th>
                <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                <Th sortKey="assignee" sort={sort} onSort={toggle}>Assignee</Th>
                <Th>Access</Th>
                <Th sortKey="updated" sort={sort} onSort={toggle}>Updated</Th>
                <Th srOnly>Actions</Th>
              </>}>
              {sorted.map((t) => (
                <Row key={t.id} selected={sel.selected.has(t.id)} onClick={() => open(t.id)}>
                  <SelectCell checked={sel.selected.has(t.id)} onToggle={() => sel.toggle(t.id)} label={`Select ${t.subject}`} />
                  <Td className="max-w-[340px]">
                    <p className="truncate font-medium text-foreground">{t.subject}</p>
                    <p className="truncate font-mono text-[10.5px] text-subtle-foreground">#{shortId(t.id, 6)} · {titleCase(t.category)} · {t.requester_name ?? t.requester_email ?? "Unknown"}</p>
                  </Td>
                  <Td>{t.organization_name ? <span className="flex items-center gap-2"><Monogram name={t.organization_name} size={22} /><span className="truncate">{t.organization_name}</span></span> : <span className="text-subtle-foreground">—</span>}</Td>
                  <Td><PriorityMark p={t.priority} /></Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td>{t.assignee_name ? <span className="flex items-center gap-2"><Monogram name={t.assignee_name} size={20} round /><span className="truncate text-[12.5px]">{t.assignee_name}</span></span> : <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-amber">Unassigned</span>}</Td>
                  <Td>{t.data_access_active ? <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-success"><KeyRound className="size-3.5" /> Granted</span> : <span className="text-subtle-foreground">—</span>}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{relTime(t.updated_at)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}><RowMenu items={[{ label: "Open conversation", icon: ExternalLink, href: `/admin/support/${t.id}` }]} label={`Actions for ${t.subject}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            query.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : !sorted.length ? <EmptyLine>No tickets in this view</EmptyLine>
            : sorted.map((t) => (
              <MobileCard key={t.id} selected={sel.selected.has(t.id)} onClick={() => open(t.id)}>
                <div className="flex items-start gap-3">
                  <span onClick={(e) => e.stopPropagation()} className="pt-0.5"><Checkbox checked={sel.selected.has(t.id)} onCheckedChange={() => sel.toggle(t.id)} aria-label={`Select ${t.subject}`} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{t.subject}</p><StatusPill status={t.status} /></div>
                    <p className="truncate font-mono text-[10.5px] text-subtle-foreground">{t.organization_name ?? "—"} · {relTime(t.updated_at)}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2"><MiniStat label="Priority"><PriorityMark p={t.priority} /></MiniStat><MiniStat label="Assignee">{t.assignee_name ?? "Unassigned"}</MiniStat></div>
                  </div>
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="tickets" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>
      <BulkActionDialog
        open={bulk !== null}
        onOpenChange={(o) => { if (!o) { setBulk(null); if (ran.current) { sel.clear(); ran.current = false; } } }}
        title={bulk === "assign" ? `Assign ${selectedRows.length} tickets to me` : `Resolve ${selectedRows.length} tickets`}
        description={bulk === "assign" ? "Each ticket is reassigned to you. Every update is audited." : "Each ticket is marked resolved and timestamped. Customers can reopen by replying. Every update is audited."}
        confirmLabel={bulk === "assign" ? "Assign" : "Resolve"}
        verb="Updating"
        requireReason={false}
        targets={selectedRows.map((t) => ({
          id: t.id, label: t.subject, sub: t.organization_name ?? undefined,
          skip: bulk === "assign" ? (t.assignee_id && t.assignee_id === myId ? "Already yours" : null) : (["resolved", "closed"].includes(t.status) ? `Already ${t.status}` : null),
        }))}
        run={(id) => adminPatch(`/support/tickets/${id}`, bulk === "assign" ? { assignee_id: myId } : { status: "resolved" })}
        onFinished={() => { qc.invalidateQueries({ queryKey: ["admin"] }); ran.current = true; }}
      />
    </>
  );
}

export default function SupportPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <SupportInner />
    </React.Suspense>
  );
}
