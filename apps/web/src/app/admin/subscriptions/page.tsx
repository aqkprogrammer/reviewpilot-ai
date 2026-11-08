"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { titleCase } from "@/lib/utils";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { DataTable, DemoTag, FilterBar, FilterSelect, Pagination, Panel, Row, SearchInput, SectionHeader, StatusPill, Td, Th, adminPost, money, opts, relTime, shortDate, useAdmin, type AdminPage } from "@/components/admin/ui";

interface SubRow {
  id: string; organization_id: string; organization_name: string; is_demo: boolean; plan_code: string; plan_name: string; status: string; interval: string; provider: string | null;
  trial_ends_at: string | null; current_period_end: string | null; grace_period_ends_at: string | null; cancel_at_period_end: boolean; mrr_minor: number; created_at: string;
}
type Action = "extend_trial" | "set_grace_period" | "clear_grace_period" | "change_plan";
const LABEL: Record<Action, string> = { extend_trial: "Extend trial", set_grace_period: "Set grace period", clear_grace_period: "End grace period now", change_plan: "Switch trial plan" };
const TABS = ["all", "trialing", "active", "past_due", "grace_period", "canceled", "expired"];

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const [target, setTarget] = React.useState<{ sub: SubRow; action: Action } | null>(null);
  const [days, setDays] = React.useState("7");
  const [planCode, setPlanCode] = React.useState("growth");
  React.useEffect(() => setPage(1), [tab, q, plan]);
  const query = useAdmin<AdminPage<SubRow> & { counts: Record<string, number> }>("/subscriptions", { page, page_size: 25, status: tab === "all" ? "" : tab, plan, q });
  const run = useMutation({
    mutationFn: (reason: string) => adminPost(`/subscriptions/${target!.sub.id}/action`, { action: target!.action, reason, days: target!.action.endsWith("trial") || target!.action === "set_grace_period" ? Number(days) : undefined, plan_code: target!.action === "change_plan" ? planCode : undefined }),
    onSuccess: () => { toast.success(`${LABEL[target!.action]} — saved and audited`); qc.invalidateQueries({ queryKey: ["admin"] }); setTarget(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = query.data;
  const needsDays = target && (target.action === "extend_trial" || target.action === "set_grace_period");
  return (
    <>
      <SectionHeader eyebrow="Billing" title="Subscriptions" description="Subscription state changes come from verified provider webhooks. Manual overrides here are limited, require a reason, and never mark payments as paid." />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "all" ? "All" : titleCase(t)}
              {t !== "all" && d?.counts?.[t] ? <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[10px]">{d.counts[t]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Panel flush bodyClassName="mt-0">
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search organization" />
          <FilterSelect value={plan} onChange={setPlan} placeholder="All plans" options={opts(["starter", "growth", "agency", "enterprise"])} />
        </FilterBar>
        <DataTable colSpan={8} loading={query.isLoading} empty={d && d.items.length === 0} head={<><Th>Organization</Th><Th>Plan</Th><Th>Status</Th><Th>Provider</Th><Th align="right">MRR</Th><Th>Renews / ends</Th><Th>Notes</Th><Th /></>}>
          {d?.items.map((s) => (
            <Row key={s.id}>
              <Td><Link href={`/admin/organizations/${s.organization_id}`} className="flex items-center gap-2 font-medium text-foreground hover:underline">{s.organization_name} <DemoTag show={s.is_demo} /></Link></Td>
              <Td>{s.plan_name} <span className="text-subtle-foreground">· {s.interval}</span></Td>
              <Td><StatusPill status={s.status} /></Td>
              <Td className="font-mono text-[12px]">{s.provider ?? "—"}</Td>
              <Td align="right" className="font-mono text-foreground">{s.mrr_minor ? money(s.mrr_minor) : "—"}</Td>
              <Td>{s.status === "trialing" ? `Trial ends ${relTime(s.trial_ends_at)}` : s.status === "grace_period" ? `Grace ends ${relTime(s.grace_period_ends_at)}` : shortDate(s.current_period_end)}</Td>
              <Td>{s.cancel_at_period_end ? <StatusPill status="pending" label="Cancels at period end" /> : null}</Td>
              <Td align="right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(["extend_trial", "change_plan", "set_grace_period", "clear_grace_period"] as Action[]).map((a) => (
                      <DropdownMenuItem key={a} onSelect={() => setTarget({ sub: s, action: a })}
                        disabled={(a === "extend_trial" && !["trialing", "expired"].includes(s.status)) || (a === "change_plan" && s.status !== "trialing") || (a === "clear_grace_period" && s.status !== "grace_period") || (a === "set_grace_period" && ["trialing", "canceled"].includes(s.status))}>
                        {LABEL[a]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </Td>
            </Row>
          ))}
        </DataTable>
        {d && <Pagination page={d.page} pages={d.pages} total={d.total} onPage={setPage} label="subscriptions" />}
      </Panel>
      {target && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={`${LABEL[target.action]} — ${target.sub.organization_name}`}
          description="This override is recorded in the audit log with your reason."
          confirmLabel={LABEL[target.action]}
          destructive={target.action === "clear_grace_period"}
          loading={run.isPending}
          onConfirm={(r) => run.mutate(r)}
        >
          {needsDays && (
            <FormField label="Days" htmlFor="days">
              <Input id="days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />
            </FormField>
          )}
          {target.action === "change_plan" && (
            <FormField label="Trial plan">
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["starter", "growth", "agency"].map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
        </ReasonDialog>
      )}
    </>
  );
}
