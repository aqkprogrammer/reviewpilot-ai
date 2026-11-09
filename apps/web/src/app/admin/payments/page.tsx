"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, IndianRupee, PanelRight, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import {
  ClearFilters, DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SearchInput, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort,
} from "@/components/admin/table";
import { CopyId, DemoTag, EmptyLine, KeyValue, Kpi, KpiGrid, Monogram, Notice, Panel, SectionHeader, StatusPill, money, moneyCompact, shortDate, stamp, useAdmin, type AdminPage } from "@/components/admin/ui";

interface PayRow { id: string; organization_id: string; organization_name: string; provider: string; provider_payment_id: string; amount_minor: number; currency: string; status: string; failure_reason: string | null; plan_code: string | null; paid_at: string | null; created_at: string; simulated: boolean }
type Resp = AdminPage<PayRow> & { summary: { collected_minor: number; failed: number; total: number } };

function exportCsv(rows: PayRow[]) {
  const head = ["created_at", "organization", "amount_inr", "currency", "status", "provider", "reference", "plan", "failure_reason", "simulated"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((p) => [p.created_at, p.organization_name, (p.amount_minor / 100).toFixed(2), p.currency, p.status, p.provider, p.provider_payment_id, p.plan_code, p.failure_reason, p.simulated].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `payments-page-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PaymentsInner() {
  const params = useSearchParams();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState(params.get("status") ?? "");
  const [provider, setProvider] = React.useState("");
  const [open, setOpen] = React.useState<PayRow | null>(null);
  React.useEffect(() => setPage(1), [q, status, provider, pageSize]);
  const query = useAdmin<Resp>("/payments", { page, page_size: pageSize, q, status, provider });
  const d = query.data;
  const s = d?.summary;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    organization: (p) => p.organization_name, amount: (p) => p.amount_minor, status: (p) => p.status, plan: (p) => p.plan_code, provider: (p) => p.provider, date: (p) => p.paid_at ?? p.created_at,
  });
  const simulatedOnPage = d?.items.some((p) => p.simulated);
  const menu = (p: PayRow) => [
    { label: "View details", icon: PanelRight, onSelect: () => setOpen(p) },
    { label: "Open organization", icon: ExternalLink, href: `/admin/organizations/${p.organization_id}` },
    { label: "Copy reference", icon: Copy, onSelect: () => { navigator.clipboard?.writeText(p.provider_payment_id); toast.success("Reference copied"); } },
  ];

  return (
    <>
      <SectionHeader
        title="Payments"
        description="Every payment event recorded from provider webhooks. The console can't create, refund or mark payments — state comes only from the provider."
        actions={<Button variant="outline" size="sm" disabled={!d?.items.length} onClick={() => d && exportCsv(sorted)}><Download /> Export page CSV</Button>}
      />
      <KpiGrid className="mb-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Collected · all time" value={s?.collected_minor} format={moneyCompact} icon={IndianRupee} tone="signal" sub="Succeeded charges" loading={!s} />
        <Kpi label="Events recorded" value={s?.total} icon={CheckCircle2} tone="ice" sub="All statuses" loading={!s} />
        <Kpi label="Failed" value={s?.failed} icon={AlertTriangle} tone={s?.failed ? "danger" : "success"} alert={!!s?.failed} sub="Org enters grace period" loading={!s} />
        <Kpi label="Failure rate" display={s ? (s.total ? `${((s.failed / s.total) * 100).toFixed(1)}%` : "—") : undefined} icon={Percent} tone="amber" sub="Failed ÷ recorded" loading={!s} />
      </KpiGrid>
      {simulatedOnPage && <Notice className="mb-4" icon={AlertTriangle}>Rows tagged <span className="font-mono text-amber">SIM</span> come from the mock provider used in demo mode — no money moved.</Notice>}
      <StatusTabs
        id="pay-status"
        className="mb-3 w-fit"
        value={status || "all"}
        onChange={(v) => setStatus(v === "all" ? "" : v)}
        items={[
          { value: "all", label: "All", count: s?.total },
          { value: "succeeded", label: "Succeeded" },
          { value: "failed", label: "Failed", count: s?.failed, tone: "danger" },
          { value: "pending", label: "Pending" },
          { value: "refunded", label: "Refunded" },
        ]}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} />}>
          <SearchInput value={q} onChange={setQ} placeholder="Organization or payment reference" />
          <FilterSelect value={provider} onChange={setProvider} placeholder="All providers" options={[{ value: "razorpay", label: "Razorpay" }, { value: "stripe", label: "Stripe" }, { value: "mock", label: "Mock (demo)" }]} />
          <ClearFilters active={!!(q || provider)} onClear={() => { setQ(""); setProvider(""); }} />
        </Toolbar>
        <Responsive
          table={
            <DataTable
              colSpan={8}
              minWidth={980}
              loading={query.isLoading}
              empty={!!d && !d.items.length}
              caption="Payments"
              head={
                <>
                  <Th sortKey="date" sort={sort} onSort={toggle}>Date</Th>
                  <Th sortKey="organization" sort={sort} onSort={toggle}>Organization</Th>
                  <Th align="right" sortKey="amount" sort={sort} onSort={toggle}>Amount</Th>
                  <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                  <Th sortKey="plan" sort={sort} onSort={toggle}>Plan</Th>
                  <Th sortKey="provider" sort={sort} onSort={toggle}>Provider</Th>
                  <Th>Reference</Th>
                  <Th srOnly>Actions</Th>
                </>
              }
            >
              {sorted.map((p) => (
                <Row key={p.id} onClick={() => setOpen(p)}>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{stamp(p.paid_at ?? p.created_at, false)}</Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Monogram name={p.organization_name} size={24} />
                      <span className="truncate font-medium text-foreground">{p.organization_name}</span>
                    </span>
                  </Td>
                  <Td align="right" className="font-mono text-[12.5px] text-foreground">{money(p.amount_minor)}</Td>
                  <Td>
                    <div className="flex flex-col items-start gap-0.5">
                      <StatusPill status={p.status} />
                      {p.failure_reason && <span className="max-w-[200px] truncate text-[11px] text-danger-foreground">{p.failure_reason}</span>}
                    </div>
                  </Td>
                  <Td className="font-mono text-[11px] uppercase">{p.plan_code ?? "—"}</Td>
                  <Td><span className="flex items-center gap-2 font-mono text-[11px] uppercase">{p.provider}<DemoTag show={p.simulated} label="Sim" /></span></Td>
                  <Td className="max-w-[200px]"><CopyId value={p.provider_payment_id} /></Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}><RowMenu items={menu(p)} label="Payment actions" /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            query.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : !sorted.length ? <EmptyLine>No payments match</EmptyLine>
            : sorted.map((p) => (
              <MobileCard key={p.id} onClick={() => setOpen(p)}>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{p.organization_name}</p>
                  <span className="font-mono text-[13px] tabular text-foreground">{money(p.amount_minor)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <MiniStat label="Status"><StatusPill status={p.status} /></MiniStat>
                  <MiniStat label="Provider"><span className="font-mono text-[11px] uppercase">{p.provider}</span></MiniStat>
                  <MiniStat label="Date">{shortDate(p.paid_at ?? p.created_at)}</MiniStat>
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="payments" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="sm:max-w-[460px]">
          <SheetHeader>
            <p className="micro-label mb-1">Payment event</p>
            <SheetTitle className="font-mono text-[20px] tabular">{open ? money(open.amount_minor) : ""}</SheetTitle>
            <SheetDescription>{open?.organization_name}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {open && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2"><StatusPill status={open.status} /><DemoTag show={open.simulated} label="Simulated" /></div>
                {open.failure_reason && <Notice tone="danger" icon={AlertTriangle}>{open.failure_reason}</Notice>}
                <KeyValue items={[
                  ["Provider", <span key="p" className="font-mono uppercase">{open.provider}</span>],
                  ["Currency", <span key="c" className="font-mono">{open.currency}</span>],
                  ["Plan", open.plan_code ?? "—"],
                  ["Created", stamp(open.created_at)],
                  ["Paid", stamp(open.paid_at)],
                  ["Event ID", <CopyId key="i" value={open.id} display={open.id.slice(0, 13)} />],
                ]} />
                <div>
                  <p className="micro-label mb-1.5">Provider reference</p>
                  <CopyId value={open.provider_payment_id} className="text-[12px]" />
                </div>
                <Button variant="outline" size="sm" asChild><Link href={`/admin/organizations/${open.organization_id}`}><ExternalLink /> Open organization</Link></Button>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">Card and bank details are never stored by ReviewPilot.</p>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PaymentsInner />
    </React.Suspense>
  );
}

