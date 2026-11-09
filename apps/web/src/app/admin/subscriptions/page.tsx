"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, ExternalLink, Hourglass, Layers, ShieldOff, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { BulkActionDialog } from "@/components/admin/bulk";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import {
  BulkBar, ClearFilters, DataTable, FilterSelect, MiniStat, MobileCard, Pagination, Responsive, Row, RowMenu, SearchInput, SelectCell, SelectHead, SortNote, StatusTabs, Td, Th, Toolbar, useClientSort, useSelection,
} from "@/components/admin/table";
import { DemoTag, EmptyLine, Monogram, Notice, Panel, SectionHeader, StatusPill, adminPost, money, opts, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";

interface SubRow {
  id: string; organization_id: string; organization_name: string; is_demo: boolean; plan_code: string; plan_name: string; status: string; interval: string; provider: string | null;
  trial_ends_at: string | null; current_period_end: string | null; grace_period_ends_at: string | null; cancel_at_period_end: boolean; mrr_minor: number; created_at: string;
}
type Action = "extend_trial" | "set_grace_period" | "clear_grace_period" | "change_plan";
const LABEL: Record<Action, string> = { extend_trial: "Extend trial", set_grace_period: "Set grace period", clear_grace_period: "End grace period now", change_plan: "Switch trial plan" };
const ICON: Record<Action, React.ComponentType<{ className?: string }>> = { extend_trial: CalendarPlus, set_grace_period: Hourglass, clear_grace_period: ShieldOff, change_plan: Layers };
const TABS = ["all", "trialing", "active", "past_due", "grace_period", "canceled", "expired"];

const disabledFor = (a: Action, s: SubRow) =>
  (a === "extend_trial" && !["trialing", "expired"].includes(s.status)) ||
  (a === "change_plan" && s.status !== "trialing") ||
  (a === "clear_grace_period" && s.status !== "grace_period") ||
  (a === "set_grace_period" && !["past_due", "grace_period", "expired", "active"].includes(s.status));

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Horizon({ s }: { s: SubRow }) {
  const target = s.status === "trialing" ? s.trial_ends_at : s.status === "grace_period" ? s.grace_period_ends_at : s.current_period_end;
  const label = s.status === "trialing" ? "Trial ends" : s.status === "grace_period" ? "Grace ends" : ["canceled", "expired"].includes(s.status) ? "Ended" : "Renews";
  const days = daysUntil(target);
  const urgent = days != null && days >= 0 && days <= 3 && ["trialing", "grace_period"].includes(s.status);
  return (
    <div className="min-w-0">
      <p className="micro-label text-[9.5px]">{label}</p>
      <p className={cn("font-mono text-[11.5px] tabular", urgent ? "text-amber" : "text-foreground-soft")}>
        {shortDate(target)}
        {days != null && days >= 0 && !["canceled", "expired"].includes(s.status) && <span className="ml-1.5 text-subtle-foreground">· {days}d</span>}
      </p>
    </div>
  );
}

function SubscriptionsInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = React.useState(params.get("status") || "all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [plan, setPlan] = React.useState("");
  const [target, setTarget] = React.useState<{ sub: SubRow; action: Action } | null>(null);
  const [days, setDays] = React.useState("7");
  const [planCode, setPlanCode] = React.useState("growth");
  const [bulk, setBulk] = React.useState(false);
  React.useEffect(() => setPage(1), [tab, q, plan, pageSize]);
  React.useEffect(() => { router.replace(tab === "all" ? "/admin/subscriptions" : `/admin/subscriptions?status=${tab}`, { scroll: false }); }, [tab, router]);

  const query = useAdmin<AdminPage<SubRow> & { counts: Record<string, number> }>("/subscriptions", { page, page_size: pageSize, status: tab === "all" ? "" : tab, plan, q });
  const d = query.data;
  const { sorted, sort, toggle } = useClientSort(d?.items, {
    organization: (s) => s.organization_name, plan: (s) => s.plan_name, status: (s) => s.status, provider: (s) => s.provider, mrr: (s) => s.mrr_minor,
    horizon: (s) => (s.status === "trialing" ? s.trial_ends_at : s.status === "grace_period" ? s.grace_period_ends_at : s.current_period_end),
  });
  const ran = React.useRef(false);
  const sel = useSelection(sorted.map((s) => s.id));
  const selectedRows = sorted.filter((s) => sel.selected.has(s.id));
  const totalAll = d ? Object.values(d.counts).reduce((a, b) => a + b, 0) : undefined;

  const run = useMutation({
    mutationFn: (reason: string) => adminPost(`/subscriptions/${target!.sub.id}/action`, {
      action: target!.action, reason,
      days: target!.action === "extend_trial" || target!.action === "set_grace_period" ? Number(days) : undefined,
      plan_code: target!.action === "change_plan" ? planCode : undefined,
    }),
    onSuccess: () => { toast.success(`${LABEL[target!.action]} — saved and audited`); qc.invalidateQueries({ queryKey: ["admin"] }); setTarget(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const needsDays = target && (target.action === "extend_trial" || target.action === "set_grace_period");
  const daysValid = Number(days) >= 1 && Number(days) <= 90;
  const menu = (s: SubRow) => [
    { label: "Open organization", icon: ExternalLink, href: `/admin/organizations/${s.organization_id}` },
    "separator" as const,
    { heading: "Audited overrides" },
    ...(["extend_trial", "change_plan", "set_grace_period", "clear_grace_period"] as Action[]).map((a) => ({
      label: `${LABEL[a]}…`, icon: ICON[a], disabled: disabledFor(a, s), destructive: a === "clear_grace_period", onSelect: () => { setDays("7"); setTarget({ sub: s, action: a }); },
    })),
  ];

  return (
    <>
      <SectionHeader title="Subscriptions" description="State changes come from verified provider webhooks. Overrides here are limited, require a reason and never mark a payment as paid." meta={totalAll != null ? `${formatNumber(totalAll)} subscriptions` : undefined} />
      <StatusTabs
        id="sub-status"
        className="mb-3"
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ value: t, label: t === "all" ? "All" : t === "grace_period" ? "Grace" : titleCase(t), count: t === "all" ? totalAll : d?.counts?.[t] ?? 0, tone: t === "grace_period" || t === "past_due" ? "warning" : undefined }))}
      />
      <Panel flush>
        <Toolbar right={<SortNote sort={sort} base="Recently updated" />}>
          <SearchInput value={q} onChange={setQ} placeholder="Search organization" />
          <FilterSelect value={plan} onChange={setPlan} placeholder="All plans" options={opts(["starter", "growth", "agency", "enterprise"])} />
          <ClearFilters active={!!(q || plan)} onClear={() => { setQ(""); setPlan(""); }} />
        </Toolbar>
        <BulkBar count={sel.count} noun="subscriptions selected" onClear={sel.clear}>
          <Button size="xs" variant="outline" onClick={() => { setDays("7"); setBulk(true); }}><TimerReset /> Extend trials</Button>
        </BulkBar>
        <Responsive
          table={
            <DataTable
              colSpan={9}
              minWidth={1000}
              loading={query.isLoading}
              empty={!!d && !d.items.length}
              caption="Subscriptions"
              head={
                <>
                  <SelectHead all={sel.all} some={sel.some} onToggle={sel.toggleAll} />
                  <Th sortKey="organization" sort={sort} onSort={toggle}>Organization</Th>
                  <Th sortKey="plan" sort={sort} onSort={toggle}>Plan</Th>
                  <Th sortKey="status" sort={sort} onSort={toggle}>Status</Th>
                  <Th sortKey="provider" sort={sort} onSort={toggle}>Provider</Th>
                  <Th align="right" sortKey="mrr" sort={sort} onSort={toggle}>MRR</Th>
                  <Th sortKey="horizon" sort={sort} onSort={toggle}>Horizon</Th>
                  <Th>Flags</Th>
                  <Th srOnly>Actions</Th>
                </>
              }
            >
              {sorted.map((s) => (
                <Row key={s.id} selected={sel.selected.has(s.id)}>
                  <SelectCell checked={sel.selected.has(s.id)} onToggle={() => sel.toggle(s.id)} label={`Select ${s.organization_name}`} />
                  <Td>
                    <Link href={`/admin/organizations/${s.organization_id}`} className="group flex items-center gap-2.5">
                      <Monogram name={s.organization_name} size={26} />
                      <span className="truncate font-medium text-foreground group-hover:text-primary">{s.organization_name}</span>
                      <DemoTag show={s.is_demo} />
                    </Link>
                  </Td>
                  <Td><span className="text-foreground">{s.plan_name}</span> <span className="font-mono text-[10.5px] uppercase text-subtle-foreground">· {s.interval}</span></Td>
                  <Td><StatusPill status={s.status} /></Td>
                  <Td className="font-mono text-[11.5px] uppercase">{s.provider ?? "—"}</Td>
                  <Td align="right" className="font-mono text-[12px] text-foreground">{s.mrr_minor ? money(s.mrr_minor) : <span className="text-subtle-foreground">—</span>}</Td>
                  <Td><Horizon s={s} /></Td>
                  <Td>{s.cancel_at_period_end ? <StatusPill status="pending" label="Cancels at end" dot={false} /> : <span className="text-subtle-foreground">—</span>}</Td>
                  <Td align="right"><RowMenu items={menu(s)} label={`Actions for ${s.organization_name}`} /></Td>
                </Row>
              ))}
            </DataTable>
          }
          cards={
            query.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
            : !sorted.length ? <EmptyLine>No subscriptions match</EmptyLine>
            : sorted.map((s) => (
              <MobileCard key={s.id} selected={sel.selected.has(s.id)}>
                <div className="flex items-start gap-3">
                  <span className="pt-1"><Checkbox checked={sel.selected.has(s.id)} onCheckedChange={() => sel.toggle(s.id)} aria-label={`Select ${s.organization_name}`} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/organizations/${s.organization_id}`} className="truncate text-[13.5px] font-medium text-foreground">{s.organization_name}</Link>
                      <span className="ml-auto"><StatusPill status={s.status} /></span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <MiniStat label="Plan">{s.plan_name}</MiniStat>
                      <MiniStat label="MRR">{s.mrr_minor ? money(s.mrr_minor) : "—"}</MiniStat>
                      <Horizon s={s} />
                    </div>
                  </div>
                  <RowMenu items={menu(s)} label={`Actions for ${s.organization_name}`} />
                </div>
              </MobileCard>
            ))
          }
        />
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="subscriptions" pageSize={pageSize} onPageSize={setPageSize} />}
      </Panel>

      {target && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={`${LABEL[target.action]} — ${target.sub.organization_name}`}
          description="This override is recorded in the audit log with your reason and the before/after state."
          confirmLabel={LABEL[target.action]}
          destructive={target.action === "clear_grace_period"}
          loading={run.isPending}
          onConfirm={(r) => { if (!needsDays || daysValid) run.mutate(r); }}
        >
          {needsDays && (
            <FormField label="Days (1–90)" htmlFor="days" error={daysValid ? undefined : "Enter between 1 and 90 days"}>
              <Input id="days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="font-mono" />
            </FormField>
          )}
          {target.action === "change_plan" && (
            <FormField label="Trial plan">
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger aria-label="Trial plan"><SelectValue /></SelectTrigger>
                <SelectContent>{["starter", "growth", "agency"].map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          {target.action === "clear_grace_period" && <Notice tone="danger">Paid features stop at the next entitlement check.</Notice>}
        </ReasonDialog>
      )}
      <BulkActionDialog
        open={bulk}
        onOpenChange={(o) => { setBulk(o); if (!o && ran.current) { sel.clear(); ran.current = false; } }}
        title={`Extend ${selectedRows.length} trials`}
        description="Each eligible trial (trialing or expired trial) is extended by the same number of days. Paid subscriptions are skipped."
        confirmLabel="Extend trials"
        verb="Extending"
        extraValid={daysValid}
        targets={selectedRows.map((s) => ({ id: s.id, label: s.organization_name, sub: `${s.plan_name} · ${s.status}`, skip: disabledFor("extend_trial", s) ? `Not a trial (${s.status.replace(/_/g, " ")})` : null }))}
        run={(id, reason) => adminPost(`/subscriptions/${id}/action`, { action: "extend_trial", reason, days: Number(days) })}
        onFinished={() => { qc.invalidateQueries({ queryKey: ["admin"] }); ran.current = true; }}
      >
        <FormField label="Days to add (1–90)" htmlFor="bulk-days" error={daysValid ? undefined : "Enter between 1 and 90 days"}>
          <Input id="bulk-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="font-mono" />
        </FormField>
      </BulkActionDialog>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <SubscriptionsInner />
    </React.Suspense>
  );
}
