"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, IndianRupee } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { DataTable, DemoTag, FilterBar, FilterSelect, MetricCard, Pagination, Panel, Row, SearchInput, SectionHeader, StatusPill, Td, Th, money, opts, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";

interface PayRow { id: string; organization_id: string; organization_name: string; provider: string; provider_payment_id: string; amount_minor: number; currency: string; status: string; failure_reason: string | null; plan_code: string | null; paid_at: string | null; created_at: string; simulated: boolean }

export default function PaymentsPage() {
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [provider, setProvider] = React.useState("");
  React.useEffect(() => setPage(1), [q, status, provider]);
  const query = useAdmin<AdminPage<PayRow> & { summary: { collected_minor: number; failed: number; total: number } }>("/payments", { page, page_size: 25, q, status, provider });
  const d = query.data;
  return (
    <>
      <SectionHeader eyebrow="Billing" title="Payments" description="Every payment event recorded from provider webhooks. Simulated (mock) payments are tagged." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Collected (all time)" value={money(d?.summary.collected_minor, { compact: true })} icon={IndianRupee} accent="emerald" loading={!d} />
        <MetricCard label="Payments recorded" value={formatNumber(d?.summary.total)} icon={CheckCircle2} accent="blue" loading={!d} />
        <MetricCard label="Failed payments" value={formatNumber(d?.summary.failed)} icon={AlertTriangle} accent="rose" loading={!d} hint="Organisations enter a grace period" />
      </div>
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Organization or payment ID" />
          <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={opts(["succeeded", "failed", "pending", "refunded"])} />
          <FilterSelect value={provider} onChange={setProvider} placeholder="All providers" options={[{ value: "razorpay", label: "Razorpay" }, { value: "stripe", label: "Stripe" }, { value: "mock", label: "Mock (demo)" }]} />
        </FilterBar>
        <DataTable colSpan={7} loading={query.isLoading} empty={d && d.items.length === 0} head={<><Th>Organization</Th><Th align="right">Amount</Th><Th>Status</Th><Th>Plan</Th><Th>Provider</Th><Th>Reference</Th><Th>Date</Th></>}>
          {d?.items.map((p) => (
            <Row key={p.id}>
              <Td><Link href={`/admin/organizations/${p.organization_id}`} className="font-medium text-foreground hover:underline">{p.organization_name}</Link></Td>
              <Td align="right" className="font-mono text-foreground">{money(p.amount_minor)}</Td>
              <Td><div className="flex flex-col gap-1"><StatusPill status={p.status} />{p.failure_reason && <span className="text-[11px] text-danger-foreground">{p.failure_reason}</span>}</div></Td>
              <Td>{p.plan_code ?? "—"}</Td>
              <Td><span className="flex items-center gap-2 font-mono text-[12px]">{p.provider}<DemoTag show={p.simulated} /></span></Td>
              <Td className="max-w-[180px] truncate font-mono text-[11.5px] text-muted-foreground">{p.provider_payment_id}</Td>
              <Td>{shortDate(p.paid_at ?? p.created_at)}</Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="payments" />}
      </Panel>
    </>
  );
}
