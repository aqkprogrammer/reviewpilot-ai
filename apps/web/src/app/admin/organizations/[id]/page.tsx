"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Bot, Lock, MapPin, MessageSquareText, QrCode, RotateCcw, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/controls";
import { InlineAlert } from "@/components/ui/states";
import { errorMessage } from "@/lib/api";
import { formatNumber, titleCase } from "@/lib/utils";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { DataTable, DemoTag, KeyValue, MetricCard, Panel, QueryState, Row, StatusPill, Td, Th, adminPost, money, relTime, shortDate, useAdmin } from "@/components/admin/ui";

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
  return (
    <>
      <Link href="/admin/organizations" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Organizations</Link>
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={d.organization.name} size={52} className="rounded-2xl" />
                <div>
                  <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-semibold tracking-[-0.02em]">{d.organization.name} <StatusPill status={d.organization.status} /> <DemoTag show={d.organization.is_demo} /></h1>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{titleCase(d.organization.industry)} · {d.organization.slug} · joined {shortDate(d.organization.created_at)}</p>
                </div>
              </div>
              {d.organization.status === "suspended" ? (
                <Button variant="outline" onClick={() => setDialog("reactivate")}><RotateCcw /> Reactivate</Button>
              ) : (
                <Button variant="danger-soft" onClick={() => setDialog("suspend")}><Ban /> Suspend organization</Button>
              )}
            </div>
            {d.organization.suspended_reason && <InlineAlert variant="danger" icon={Ban} title="Suspended">{d.organization.suspended_reason}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Reviews" value={formatNumber(d.usage.reviews)} icon={MessageSquareText} accent="blue" hint={`${d.usage.feedback} private feedback`} />
              <MetricCard label="Requests sent" value={formatNumber(d.usage.requests_sent)} icon={Send} accent="violet" hint={`${d.usage.campaigns} campaigns`} />
              <MetricCard label="Customers" value={formatNumber(d.usage.customers)} icon={Users} accent="emerald" hint={`${d.usage.qr_codes} QR codes`} />
              <MetricCard label="AI requests (month)" value={formatNumber(d.usage.ai_requests_this_month)} icon={Bot} accent="amber" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Subscription" className="xl:col-span-1">
                {d.subscription ? (
                  <KeyValue className="sm:grid-cols-2" items={[
                    ["Plan", d.subscription.plan_name], ["Status", <StatusPill key="s" status={d.subscription.status} />], ["Billing", titleCase(d.subscription.interval)],
                    ["Provider", d.subscription.provider ?? "—"], ["MRR", money(d.subscription.mrr_minor)], ["Period ends", shortDate(d.subscription.current_period_end)],
                    ["Trial ends", shortDate(d.subscription.trial_ends_at)], ["Grace ends", shortDate(d.subscription.grace_period_ends_at)],
                  ]} />
                ) : <p className="text-[13px] text-muted-foreground">No subscription.</p>}
                <div className="mt-4 border-t border-border pt-4">
                  <KeyValue items={[["Google Business Profile", <StatusPill key="g" status={d.integrations.google} />], ["Last sync", relTime(d.integrations.google_last_synced_at)], ["Website", d.organization.website ?? "—"], ["Timezone", d.organization.timezone]]} />
                </div>
              </Panel>
              <Panel title="Members" description={`${d.members.length} people`} flush className="xl:col-span-2">
                <DataTable colSpan={4} minWidth={520} empty={d.members.length === 0} head={<><Th>Member</Th><Th>Role</Th><Th>Status</Th><Th>Last login</Th></>}>
                  {d.members.map((m) => (
                    <Row key={m.member_id}>
                      <Td><Link href={`/admin/users?user=${m.user_id}`} className="flex items-center gap-2.5"><Avatar name={m.full_name} size={26} /><span><span className="block font-medium text-foreground">{m.full_name}</span><span className="block text-[11.5px] text-muted-foreground">{m.email}</span></span></Link></Td>
                      <Td>{titleCase(m.role)}</Td>
                      <Td><StatusPill status={m.status} /></Td>
                      <Td>{relTime(m.last_login_at)}</Td>
                    </Row>
                  ))}
                </DataTable>
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Locations" flush>
                <ul className="divide-y divide-border">
                  {d.locations.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                      <span className="flex items-center gap-2.5"><MapPin className="size-4 text-subtle-foreground" />{l.name}</span>
                      <span className="flex gap-1.5">{l.google_linked && <StatusPill status="connected" label="Google" />}<StatusPill status={l.is_active ? "active" : "disabled"} /></span>
                    </li>
                  ))}
                  {!d.locations.length && <li className="px-5 py-6 text-[13px] text-muted-foreground">No locations.</li>}
                </ul>
              </Panel>
              <Panel title="Payments" flush>
                <ul className="divide-y divide-border">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
                      <span><span className="font-mono text-foreground">{money(p.amount_minor)}</span><span className="ml-2 text-[11.5px] text-muted-foreground">{shortDate(p.created_at)} · {p.provider}</span></span>
                      <StatusPill status={p.status} />
                    </li>
                  ))}
                  {!d.payments.length && <li className="px-5 py-6 text-[13px] text-muted-foreground">No payments yet.</li>}
                </ul>
              </Panel>
              <Panel title="Recent audit history" flush>
                <ul className="max-h-80 divide-y divide-border overflow-y-auto scrollbar-thin">
                  {d.audit.map((a) => (
                    <li key={a.id} className="px-5 py-2.5">
                      <p className="font-mono text-[12px] text-foreground">{a.action}</p>
                      <p className="text-[11.5px] text-muted-foreground">{a.actor_email ?? a.actor_type} · {relTime(a.created_at)}</p>
                    </li>
                  ))}
                  {!d.audit.length && <li className="px-5 py-6 text-[13px] text-muted-foreground">No audit entries.</li>}
                </ul>
              </Panel>
            </div>
            <p className="flex items-center gap-2 text-[12px] text-subtle-foreground"><Lock className="size-3.5" /> Review text and customer contact data are hidden. Request access through a support ticket grant.</p>
            <ReasonDialog
              open={dialog !== null}
              onOpenChange={(o) => !o && setDialog(null)}
              title={dialog === "suspend" ? `Suspend ${d.organization.name}?` : `Reactivate ${d.organization.name}?`}
              description={dialog === "suspend" ? "Members lose access immediately and campaigns stop sending. This is audited." : "Members regain access immediately. This is audited."}
              confirmLabel={dialog === "suspend" ? "Suspend" : "Reactivate"}
              destructive={dialog === "suspend"}
              confirmText={dialog === "suspend" ? d.organization.slug : undefined}
              loading={act.isPending}
              onConfirm={(reason) => act.mutate(reason)}
            />
          </div>
        )}
      </QueryState>
    </>
  );
}
