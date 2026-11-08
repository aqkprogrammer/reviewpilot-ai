"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/controls";
import { formatNumber, titleCase } from "@/lib/utils";
import { DataTable, DemoTag, FilterBar, FilterSelect, Pagination, Panel, Row, SearchInput, SectionHeader, StatusPill, Td, Th, money, opts, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/states";

interface OrgRow {
  id: string; name: string; slug: string; industry: string; country: string; status: string; is_demo: boolean; created_at: string; plan_code: string | null; plan_name: string | null;
  subscription_status: string | null; members: number; locations: number; reviews: number; mrr_minor: number;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const [sub, setSub] = React.useState("");
  React.useEffect(() => setPage(1), [q, status, plan, sub]);
  const query = useAdmin<AdminPage<OrgRow>>("/organizations", { page, page_size: 20, q, status, plan, subscription_status: sub });
  const d = query.data;
  return (
    <>
      <SectionHeader eyebrow="Tenants" title="Organizations" description="Every business workspace on the platform. Metadata and usage only — customer content is not visible here." />
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search name, slug or email" />
          <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={opts(["active", "suspended"])} />
          <FilterSelect value={plan} onChange={setPlan} placeholder="All plans" options={opts(["starter", "growth", "agency", "enterprise"])} />
          <FilterSelect value={sub} onChange={setSub} placeholder="Any subscription" options={opts(["trialing", "active", "past_due", "grace_period", "canceled", "expired"])} />
        </FilterBar>
        {query.isError ? (
          <EmptyState icon={Building2} title="Couldn't load organizations" description="Retry in a moment." />
        ) : (
          <DataTable
            colSpan={8}
            loading={query.isLoading}
            empty={d && d.items.length === 0}
            head={<><Th>Organization</Th><Th>Status</Th><Th>Plan</Th><Th>Subscription</Th><Th align="right">Locations</Th><Th align="right">Members</Th><Th align="right">MRR</Th><Th>Created</Th></>}
          >
            {d?.items.map((o) => (
              <Row key={o.id} onClick={() => router.push(`/admin/organizations/${o.id}`)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={o.name} size={30} className="rounded-lg" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium text-foreground">{o.name} <DemoTag show={o.is_demo} /></p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{titleCase(o.industry)} · {o.country} · {formatNumber(o.reviews)} reviews</p>
                    </div>
                  </div>
                </Td>
                <Td><StatusPill status={o.status} /></Td>
                <Td>{o.plan_name ?? "—"}</Td>
                <Td><StatusPill status={o.subscription_status} /></Td>
                <Td align="right">{o.locations}</Td>
                <Td align="right">{o.members}</Td>
                <Td align="right" className="font-mono text-foreground">{o.mrr_minor ? money(o.mrr_minor) : "—"}</Td>
                <Td>{shortDate(o.created_at)}</Td>
              </Row>
            ))}
          </DataTable>
        )}
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="organizations" />}
      </Panel>
    </>
  );
}
