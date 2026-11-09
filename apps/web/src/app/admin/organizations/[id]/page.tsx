"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Bot, CreditCard, Lock, MapPin, MessageSquareText, QrCode, RotateCcw, ScrollText, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/tech";
import { errorMessage } from "@/lib/api";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { DataTable, Row, Td, Th } from "@/components/admin/table";
import { CopyId, DemoTag, EmptyLine, KeyValue, Kpi, KpiGrid, Monogram, Notice, Panel, QueryState, StatusPill, adminPost, money, relTime, shortDate, stamp, useAdmin } from "@/components/admin/ui";

interface Detail {
  organization: { id: string; name: string; slug: string; industry: string; country: string; timezone: string; website: string | null; status: string; suspended_reason: string | null; is_demo: boolean; created_at: string; onboarding_completed_at: string | null };
  members: { member_id: string; user_id: string; full_name: string; email: string; role: string; status: string; last_login_at: string | null }[];
  locations: { id: string; name: string; city: string | null; is_active: boolean; google_linked: boolean }[];
  subscription: null | { id: string; status: string; interval: string; provider: string | null; plan_code: string; plan_name: string; trial_ends_at: string | null; current_period_end: string | null; grace_period_ends_at: string | null; cancel_at_period_end: boolean; mrr_minor: number };
  integrations: { google: string; google_last_synced_at: string | null };
  usage: { reviews: number; customers: number; campaigns: number; requests_sent: number; qr_codes: number; feedback: number; ai_requests_this_month: number };
  payments: { id: string; amount_minor: number; status: string; provider: string; created_at: string }[];
  audit: { id: string; action: string; actor_email: string | null; actor_type: string; created_at: string }[];
}

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useAdmin<Detail>(`/organizations/${id}`);
  const [dialog, setDialog] = React.useState<null | "suspend" | "reactivate">(null);
  const act = useMutation({
    mutationFn: (reason: string) => adminPost(`/organizations/${id}/${dialog}`, { reason }),
    onSuccess: () => {
      toast.success(dialog === "suspend" ? "Organization suspended" : "Organization reactivated");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setDialog(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = q.data;
  const o = d?.organization;
  return (
    <>
      <Link href="/admin/organizations" className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-3.5" /> Organizations</Link>
      <QueryState query={q}>
        {d && o && (
          <div className="space-y-4">
            <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <Monogram name={o.name} size={48} className="rounded-lg" />
                <div className="min-w-0">
                  <p className="micro-label mb-1.5 flex items-center gap-2"><span className="text-primary">Tenant</span> · <CopyId value={o.id} display={o.id.slice(0, 8).toUpperCase()} className="text-[10.5px]" /></p>
                  <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-semibold tracking-[-0.025em] sm:text-[24px]">{o.name} <StatusPill status={o.status} /> <DemoTag show={o.is_demo} /></h1>
                  <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">{o.slug} · {titleCase(o.industry)} · {o.country} · {o.timezone} · joined {shortDate(o.created_at)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild><Link href={`/admin/audit-logs?organization_id=${o.id}`}><ScrollText /> Audit trail</Link></Button>
                {o.status === "suspended" ? (
                  <Button size="sm" onClick={() => setDialog("reactivate")}><RotateCcw /> Reactivate</Button>
                ) : (
                  <Button variant="danger-soft" size="sm" onClick={() => setDialog("suspend")}><Ban /> Suspend</Button>
                )}
              </div>
            </header>

            {o.suspended_reason && (
              <Notice tone="danger" icon={Ban}><span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-danger-foreground">Suspended</span> — {o.suspended_reason}</Notice>
            )}

            <KpiGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Reviews" value={d.usage.reviews} icon={MessageSquareText} tone="cyan" sub={`${d.usage.feedback} private feedback`} />
              <Kpi label="Requests sent" value={d.usage.requests_sent} icon={Send} tone="ice" sub={`${d.usage.campaigns} campaigns`} />
              <Kpi label="Customers" value={d.usage.customers} icon={Users} tone="mint" sub="Contact data hidden" />
              <Kpi label="AI · this month" value={d.usage.ai_requests_this_month} icon={Bot} tone="mint" sub="Metered requests" />
              <Kpi label="Locations" value={d.locations.length} icon={MapPin} tone="ice" sub={`${d.locations.filter((l) => l.google_linked).length} linked to Google`} />
              <Kpi label="QR codes" value={d.usage.qr_codes} icon={QrCode} tone="neutral" sub={`${d.members.length} seats in use`} />
            </KpiGrid>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Subscription" description={d.subscription ? `${d.subscription.plan_name} · ${titleCase(d.subscription.interval)}` : "No subscription"} actions={d.subscription && <StatusPill status={d.subscription.status} />}>
                {d.subscription ? (
                  <>
                    <div className="mb-4 flex items-baseline justify-between rounded-lg border border-border bg-background-subtle px-3 py-2.5">
                      <span className="micro-label">MRR</span>
                      <span className="font-mono text-[18px] font-medium tabular text-primary">{money(d.subscription.mrr_minor)}</span>
                    </div>
                    <KeyValue items={[
                      ["Provider", <span key="p" className="font-mono text-[12px]">{d.subscription.provider ?? "—"}</span>],
                      ["Period ends", shortDate(d.subscription.current_period_end)],
                      ["Trial ends", shortDate(d.subscription.trial_ends_at)],
                      ["Grace ends", shortDate(d.subscription.grace_period_ends_at)],
                      ["Auto-renew", d.subscription.cancel_at_period_end ? <span key="c" className="text-warning">Cancels at period end</span> : "On"],
                      ["Manage", <Link key="m" href={`/admin/subscriptions?q=${encodeURIComponent(o.name)}`} className="text-primary hover:underline">Overrides →</Link>],
                    ]} />
                  </>
                ) : <EmptyLine>No subscription on file</EmptyLine>}
              </Panel>
              <Panel title="Integrations & profile" description="Connection health and workspace metadata">
                <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
                  <li className="flex items-center gap-3 px-3 py-2.5">
                    <StatusDot tone={d.integrations.google === "connected" ? "ok" : d.integrations.google === "not_connected" ? "idle" : "warn"} />
                    <span className="flex-1 text-[12.5px] text-foreground">Google Business Profile</span>
                    <StatusPill status={d.integrations.google} dot={false} />
                  </li>
                  <li className="flex items-center justify-between px-3 py-2.5 text-[12px]">
                    <span className="micro-label">Last sync</span>
                    <span className="font-mono text-muted-foreground">{relTime(d.integrations.google_last_synced_at)}</span>
                  </li>
                </ul>
                <KeyValue items={[
                  ["Website", o.website ? <a key="w" href={o.website} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">{o.website.replace(/^https?:\/\//, "")}</a> : "—"],
                  ["Timezone", <span key="tz" className="font-mono text-[12px]">{o.timezone}</span>],
                  ["Onboarding", o.onboarding_completed_at ? shortDate(o.onboarding_completed_at) : <span key="ob" className="text-warning">Incomplete</span>],
                  ["Country", o.country],
                ]} />
              </Panel>
              <Panel title="Locations" description={`${d.locations.length} active sites`} flush>
                <ul className="max-h-[280px] divide-y divide-border overflow-y-auto scrollbar-thin">
                  {d.locations.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
                      <MapPin className="size-3.5 shrink-0 text-subtle-foreground" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-foreground">{l.name}</span>{l.city && <span className="block font-mono text-[10.5px] text-subtle-foreground">{l.city}</span>}</span>
                      {l.google_linked && <StatusPill status="connected" label="Google" dot={false} />}
                      <StatusPill status={l.is_active ? "active" : "disabled"} dot={false} />
                    </li>
                  ))}
                  {!d.locations.length && <li><EmptyLine>No locations</EmptyLine></li>}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              <Panel title="Members" description="Seats and roles" meta={`${d.members.length} people`} flush>
                <DataTable colSpan={4} minWidth={560} maxHeight={360} empty={d.members.length === 0} caption="Members" head={<><Th>Member</Th><Th>Role</Th><Th>Account</Th><Th>Last login</Th></>}>
                  {d.members.map((m) => (
                    <Row key={m.member_id}>
                      <Td>
                        <Link href={`/admin/users?user=${m.user_id}`} className="group flex items-center gap-2.5">
                          <Monogram name={m.full_name} size={26} round />
                          <span className="min-w-0"><span className="block truncate font-medium text-foreground group-hover:text-primary">{m.full_name}</span><span className="block truncate font-mono text-[10.5px] text-muted-foreground">{m.email}</span></span>
                        </Link>
                      </Td>
                      <Td><span className="font-mono text-[11px] uppercase tracking-[0.08em]">{m.role}</span></Td>
                      <Td><StatusPill status={m.status} /></Td>
                      <Td className="font-mono text-[11.5px]">{relTime(m.last_login_at)}</Td>
                    </Row>
                  ))}
                </DataTable>
              </Panel>
              <Panel title="Payments" description="Latest 10 provider events" flush>
                <ul className="max-h-[360px] divide-y divide-border overflow-y-auto scrollbar-thin">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <CreditCard className={cn("size-3.5 shrink-0", p.status === "failed" ? "text-danger" : "text-subtle-foreground")} />
                      <span className="min-w-0 flex-1"><span className="block font-mono text-[12.5px] tabular text-foreground">{money(p.amount_minor)}</span><span className="block font-mono text-[10.5px] uppercase text-subtle-foreground">{p.provider} · {shortDate(p.created_at)}</span></span>
                      <StatusPill status={p.status} />
                    </li>
                  ))}
                  {!d.payments.length && <li><EmptyLine>No payments yet</EmptyLine></li>}
                </ul>
              </Panel>
            </div>

            <Panel title="Audit history" description="Most recent 25 entries scoped to this organization" flush actions={<Button variant="ghost" size="xs" asChild><Link href={`/admin/audit-logs?organization_id=${o.id}`}>Full log →</Link></Button>}>
              <ol className="max-h-[320px] divide-y divide-border overflow-y-auto scrollbar-thin">
                {d.audit.map((a) => (
                  <li key={a.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
                    <span className="font-mono text-[10.5px] tabular text-subtle-foreground">{stamp(a.created_at)}</span>
                    <span className="min-w-0 truncate"><code className={cn("font-mono text-[11.5px]", a.action.startsWith("admin.") ? "text-amber" : "text-primary")}>{a.action}</code></span>
                    <span className="truncate text-right font-mono text-[11px] text-muted-foreground">{a.actor_email ?? a.actor_type}</span>
                  </li>
                ))}
                {!d.audit.length && <li><EmptyLine>No audit entries</EmptyLine></li>}
              </ol>
            </Panel>

            <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground"><Lock className="size-3.5" /> Review text and customer contact data are hidden · access requires a support-ticket grant</p>

            <ReasonDialog
              open={dialog !== null}
              onOpenChange={(open) => !open && setDialog(null)}
              title={dialog === "suspend" ? `Suspend ${o.name}?` : `Reactivate ${o.name}?`}
              description={dialog === "suspend" ? "Members lose access immediately and campaigns stop sending." : "Members regain access immediately."}
              confirmLabel={dialog === "suspend" ? "Suspend organization" : "Reactivate"}
              destructive={dialog === "suspend"}
              confirmText={dialog === "suspend" ? o.slug : undefined}
              loading={act.isPending}
              onConfirm={(reason) => act.mutate(reason)}
            />
          </div>
        )}
      </QueryState>
    </>
  );
}
