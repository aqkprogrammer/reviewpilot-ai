"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ExternalLink, Fingerprint, Receipt, RotateCcw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNumber, titleCase } from "@/lib/utils";
import { BulkActionDialog } from "@/components/admin/bulk";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import {
  BulkBar, ClearFilters, DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SearchInput, SelectCell, SelectHead, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort, useSelection,
} from "@/components/admin/table";
import { DemoTag, EmptyLine, Monogram, Panel, SectionHeader, StatusPill, adminPost, money, opts, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";
import { Checkbox } from "@/components/ui/controls";

interface OrgRow {
  id: string; name: string; slug: string; industry: string; country: string; status: string; is_demo: boolean; created_at: string; plan_code: string | null; plan_name: string | null;
  subscription_status: string | null; members: number; locations: number; reviews: number; mrr_minor: number;
}

function OrganizationsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [status, setStatus] = React.useState(params.get("status") ?? "");
  const [plan, setPlan] = React.useState(params.get("plan") ?? "");
  const [sub, setSub] = React.useState(params.get("subscription_status") ?? "");
  React.useEffect(() => setPage(1), [q, status, plan, sub, pageSize]);
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false });
  }, [status, pathname, router]);

  const query = useAdmin<AdminPage<OrgRow>>("/organizations", { page, page_size: pageSize, q, status, plan, subscription_status: sub });
  const all = useAdmin<AdminPage<OrgRow>>("/organizations", { page_size: 1 });
  const active = useAdmin<AdminPage<OrgRow>>("/organizations", { page_size: 1, status: "active" });
  const suspended = useAdmin<AdminPage<OrgRow>>("/organizations", { page_size: 1, status: "suspended" });
  const d = query.data;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    name: (o) => o.name, status: (o) => o.status, plan: (o) => o.plan_name, subscription: (o) => o.subscription_status, locations: (o) => o.locations, members: (o) => o.members, reviews: (o) => o.reviews, mrr: (o) => o.mrr_minor, created: (o) => o.created_at,
  });
  const ran = React.useRef(false);
  const sel = useSelection(sorted.map((o) => o.id));
  const selectedRows = sorted.filter((o) => sel.selected.has(o.id));

  const [bulk, setBulk] = React.useState<null | "suspend" | "reactivate">(null);
  const [single, setSingle] = React.useState<{ org: OrgRow; action: "suspend" | "reactivate" } | null>(null);
  const act = useMutation({
    mutationFn: (reason: string) => adminPost(`/organizations/${single!.org.id}/${single!.action}`, { reason }),
    onSuccess: () => { toast.success(single!.action === "suspend" ? "Organization suspended" : "Organization reactivated"); qc.invalidateQueries({ queryKey: ["admin"] }); setSingle(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const filtersActive = !!(q || plan || sub);
  const menu = (o: OrgRow) => [
    { label: "Open organization", icon: ExternalLink, href: `/admin/organizations/${o.id}` },
    { label: "Subscription", icon: Receipt, href: `/admin/subscriptions?q=${encodeURIComponent(o.name)}` },
    { label: "Audit trail", icon: ScrollText, href: `/admin/audit-logs?organization_id=${o.id}` },
    { label: "Copy organization ID", icon: Fingerprint, onSelect: () => { navigator.clipboard?.writeText(o.id); toast.success("Organization ID copied"); } },
    "separator" as const,
    o.status === "suspended"
      ? { label: "Reactivate…", icon: RotateCcw, onSelect: () => setSingle({ org: o, action: "reactivate" }) }
      : { label: "Suspend…", icon: Ban, destructive: true, onSelect: () => setSingle({ org: o, action: "suspend" }) },
  ];

  return (
    <>
      <SectionHeader
        title="Organizations"
        description="Every business workspace on the platform. Metadata and usage only — review text and customer contact data are not visible here."
        meta={all.data ? `${formatNumber(all.data.total)} tenants` : undefined}
      />
      <StatusTabs
        id="org-status"
        className="mb-3 w-fit"
        value={status || "all"}
        onChange={(v) => setStatus(v === "all" ? "" : v)}
        items={[
          { value: "all", label: "All", count: all.data?.total },
          { value: "active", label: "Active", count: active.data?.total },
          { value: "suspended", label: "Suspended", count: suspended.data?.total, tone: "danger" },
        ]}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} />}>
          <SearchInput value={q} onChange={setQ} placeholder="Search name, slug or email" />
          <FilterSelect value={plan} onChange={setPlan} placeholder="All plans" options={opts(["starter", "growth", "agency", "enterprise"])} />
          <FilterSelect value={sub} onChange={setSub} placeholder="Any subscription" options={[...opts(["trialing", "active", "past_due", "canceled", "expired"]), { value: "grace_period", label: "Grace period" }]} />
          <ClearFilters active={filtersActive} onClear={() => { setQ(""); setPlan(""); setSub(""); }} />
        </Toolbar>
        <BulkBar count={sel.count} noun="organizations selected" onClear={sel.clear}>
          <Button size="xs" variant="danger-soft" onClick={() => setBulk("suspend")}><Ban /> Suspend</Button>
          <Button size="xs" variant="outline" onClick={() => setBulk("reactivate")}><RotateCcw /> Reactivate</Button>
        </BulkBar>
        <Responsive
          table={
            <DataTable
              colSpan={11}
              minWidth={1040}
              loading={query.isLoading}
              empty={!!d && d.items.length === 0}
              caption="Organizations"
              head={
                <>
                  <SelectHead all={sel.all} some={sel.some} onToggle={sel.toggleAll} />
                  <Th sortKey="name" sort={sort} onSort={toggle}>Organization</Th>
                  <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                  <Th sortKey="plan" sort={sort} onSort={toggle}>Plan</Th>
                  <Th sortKey="subscription" sort={sort} onSort={toggle}>Subscription</Th>
                  <Th align="right" sortKey="locations" sort={sort} onSort={toggle}>Locs</Th>
                  <Th align="right" sortKey="members" sort={sort} onSort={toggle}>Seats</Th>
                  <Th align="right" sortKey="reviews" sort={sort} onSort={toggle}>Reviews</Th>
                  <Th align="right" sortKey="mrr" sort={sort} onSort={toggle}>MRR</Th>
                  <Th sortKey="created" sort={sort} onSort={toggle}>Created</Th>
                  <Th srOnly>Actions</Th>
                </>
              }
            >
              {sorted.map((o) => (
                <Row key={o.id} selected={sel.selected.has(o.id)} onClick={() => router.push(`/admin/organizations/${o.id}`)}>
                  <SelectCell checked={sel.selected.has(o.id)} onToggle={() => sel.toggle(o.id)} label={`Select ${o.name}`} />
                  <Td>
                    <div className="flex items-center gap-3">
                      <Monogram name={o.name} size={28} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium text-foreground">{o.name} <DemoTag show={o.is_demo} /></p>
                        <p className="truncate font-mono text-[10.5px] text-subtle-foreground">{o.slug} · {titleCase(o.industry)} · {o.country}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><StatusPill status={o.status} /></Td>
                  <Td>{o.plan_name ?? <span className="text-subtle-foreground">—</span>}</Td>
                  <Td><StatusPill status={o.subscription_status} dot={false} /></Td>
                  <Td align="right" className="font-mono text-[12px]">{o.locations}</Td>
                  <Td align="right" className="font-mono text-[12px]">{o.members}</Td>
                  <Td align="right" className="font-mono text-[12px]">{formatNumber(o.reviews)}</Td>
                  <Td align="right" className="font-mono text-[12px] text-foreground">{o.mrr_minor ? money(o.mrr_minor) : <span className="text-subtle-foreground">—</span>}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px]">{shortDate(o.created_at)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}><RowMenu items={menu(o)} label={`Actions for ${o.name}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            query.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
            : !sorted.length ? <EmptyLine>No organizations match</EmptyLine>
            : sorted.map((o) => (
              <MobileCard key={o.id} selected={sel.selected.has(o.id)} onClick={() => router.push(`/admin/organizations/${o.id}`)}>
                <div className="flex items-start gap-3">
                  <span onClick={(e) => e.stopPropagation()} className="pt-1"><Checkbox checked={sel.selected.has(o.id)} onCheckedChange={() => sel.toggle(o.id)} aria-label={`Select ${o.name}`} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium text-foreground">{o.name}</p>
                      <DemoTag show={o.is_demo} />
                      <span className="ml-auto"><StatusPill status={o.status} /></span>
                    </div>
                    <p className="truncate font-mono text-[10.5px] text-subtle-foreground">{o.slug}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <MiniStat label="Plan">{o.plan_name ?? "—"}</MiniStat>
                      <MiniStat label="Sub">{o.subscription_status ? titleCase(o.subscription_status) : "—"}</MiniStat>
                      <MiniStat label="MRR">{o.mrr_minor ? money(o.mrr_minor) : "—"}</MiniStat>
                    </div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}><RowMenu items={menu(o)} label={`Actions for ${o.name}`} /></span>
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="organizations" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>

      <BulkActionDialog
        open={bulk !== null}
        onOpenChange={(o) => { if (!o) { setBulk(null); if (ran.current) { sel.clear(); ran.current = false; } } }}
        title={bulk === "suspend" ? `Suspend ${selectedRows.length} organizations` : `Reactivate ${selectedRows.length} organizations`}
        description={bulk === "suspend" ? "Members lose access immediately and campaigns stop sending. Each organization is suspended individually and audited." : "Members regain access immediately. Each reactivation is audited."}
        destructive={bulk === "suspend"}
        phrase={bulk === "suspend" ? `SUSPEND ${selectedRows.filter((o) => o.status !== "suspended").length}` : undefined}
        confirmLabel={bulk === "suspend" ? "Suspend" : "Reactivate"}
        verb={bulk === "suspend" ? "Suspending" : "Reactivating"}
        targets={selectedRows.map((o) => ({ id: o.id, label: o.name, sub: o.slug, skip: bulk === "suspend" ? (o.status === "suspended" ? "Already suspended" : null) : (o.status !== "suspended" ? "Already active" : null) }))}
        run={(id, reason) => adminPost(`/organizations/${id}/${bulk}`, { reason })}
        onFinished={() => { qc.invalidateQueries({ queryKey: ["admin"] }); ran.current = true; }}
      />
      {single && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setSingle(null)}
          title={single.action === "suspend" ? `Suspend ${single.org.name}?` : `Reactivate ${single.org.name}?`}
          description={single.action === "suspend" ? "Members lose access immediately and campaigns stop sending." : "Members regain access immediately."}
          confirmLabel={single.action === "suspend" ? "Suspend organization" : "Reactivate"}
          destructive={single.action === "suspend"}
          confirmText={single.action === "suspend" ? single.org.slug : undefined}
          loading={act.isPending}
          onConfirm={(r) => act.mutate(r)}
        />
      )}
    </>
  );
}

export default function OrganizationsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <OrganizationsInner />
    </React.Suspense>
  );
}
