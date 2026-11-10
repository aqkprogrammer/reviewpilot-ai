"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, CalendarClock, CreditCard, Download, FlaskConical, MapPin, Receipt, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { PlansGrid } from "@/components/billing/plans-grid";
import { BillingDetailsPanel } from "@/components/billing/billing-details";
import type { CurrentSub, PaymentRow, Plan } from "@/components/billing/types";
import { RazorpayIcon, StripeIcon } from "@/components/brand/brand-icons";
import { Eyebrow, Panel } from "@/components/console/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { AnimatedNumber, GridBackdrop, Reveal, SegmentMeter, StatusDot } from "@/components/ui/tech";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { meQueryKey, useOrg } from "@/lib/session";
import { formatCurrency, formatNumber, titleCase } from "@/lib/utils";

function CheckoutResult() {
  const params = useSearchParams();
  const router = useRouter();
  React.useEffect(() => {
    const r = params.get("checkout");
    if (!r) return;
    if (r === "success") toast.success("Payment submitted. Your plan updates as soon as the payment provider confirms it.");
    else if (r === "failed") toast.error("Payment failed. Your plan was not changed.");
    else toast.info("Checkout cancelled — no changes made.");
    router.replace("/app/subscription");
  }, [params, router]);
  return null;
}

function Meter({ icon: Icon, label, used, limit }: { icon: React.ComponentType<{ className?: string }>; label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-foreground-soft"><Icon className="size-3.5 text-subtle-foreground" />{label}</span>
        <span className="font-mono text-[12px] tabular"><span className="text-foreground"><AnimatedNumber value={used} /></span><span className="text-subtle-foreground"> / {limit ? formatNumber(limit) : "—"}</span></span>
      </div>
      <SegmentMeter value={pct} segments={28} tone={pct > 100 ? "danger" : pct >= 80 ? "warning" : "primary"} className="w-full justify-between" />
    </div>
  );
}

export default function SubscriptionPage() {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const canManage = can("billing.manage");
  const current = useQuery({ queryKey: ["subscription", orgId], queryFn: () => api.get<CurrentSub>("/subscriptions/current") });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get<Plan[]>("/subscriptions/plans", undefined, { orgId: null }) });
  const payments = useQuery({ queryKey: ["subscription", orgId, "payments"], queryFn: () => api.get<PaymentRow[]>("/subscriptions/payments"), enabled: canManage });
  const cancel = useMutation({
    mutationFn: () => api.post("/subscriptions/cancel"),
    onSuccess: () => { toast.success("Cancellation requested"); qc.invalidateQueries({ queryKey: ["subscription"] }); qc.invalidateQueries({ queryKey: meQueryKey }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const undoSchedule = useMutation({
    mutationFn: () => api.delete("/subscriptions/schedule-change"),
    onSuccess: () => { toast.success("Scheduled change cancelled"); qc.invalidateQueries({ queryKey: ["subscription"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (current.isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  if (current.error) return <QueryErrorState error={current.error} onRetry={() => current.refetch()} />;
  const c = current.data!;
  const s = c.subscription;
  const p = c.plan;
  const trialDays = s?.trial_ends_at ? differenceInCalendarDays(new Date(s.trial_ends_at), new Date()) : null;
  const graceDays = s?.grace_period_ends_at ? differenceInCalendarDays(new Date(s.grace_period_ends_at), new Date()) : null;
  const canCancel = canManage && s && !s.cancel_at_period_end && ["trialing", "active"].includes(s.status);
  const provider = c.providers.razorpay && c.providers.stripe ? "Razorpay · Stripe" : c.providers.razorpay ? "Razorpay" : c.providers.stripe ? "Stripe" : c.providers.mock ? "Simulated" : "None";

  return (
    <div className="space-y-8">
      <React.Suspense fallback={null}><CheckoutResult /></React.Suspense>
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow parts={["Manage", "Billing"]} />}
        title="Subscription"
        description="Plan, usage and billing history. Plan changes take effect only after the payment provider confirms them."
      />

      {s?.status === "grace_period" && <InlineAlert variant="danger" icon={AlertTriangle} title="Payment failed">Your last payment didn&apos;t go through. Update billing within {graceDays ?? 0} day(s) to avoid interruption.</InlineAlert>}
      {s && ["expired", "canceled"].includes(s.status) && <InlineAlert variant="warning" icon={AlertTriangle} title="Subscription inactive">Campaigns and AI features are paused. Choose a plan below to reactivate.</InlineAlert>}

      <Card className="relative overflow-hidden">
        <GridBackdrop />
        <div className="relative grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="p-5 sm:p-6">
            <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground"><span className="text-primary/80">01</span><span className="h-px w-3 bg-border-strong" />Current plan</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.035em]">{p?.name ?? "No plan"}</h2>
              {s && <StatusBadge status={s.status} size="md" />}
              {s?.provider === "mock" && <Badge variant="mint" size="sm" mono><FlaskConical />Simulated billing</Badge>}
            </div>
            {p && !p.is_custom_pricing && (
              <p className="mt-3 flex items-baseline gap-1.5 tabular">
                <span className="text-[22px] font-semibold tracking-[-0.03em]">{formatCurrency(s?.interval === "yearly" ? p.price_yearly_minor : p.price_monthly_minor)}</span>
                <span className="font-mono text-[12px] text-muted-foreground">/ {s?.interval === "yearly" ? "year" : "month"}</span>
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
              <div className="bg-card/90 px-3 py-2.5"><dt className="micro-label">Interval</dt><dd className="mt-1 font-mono text-[12.5px]">{s ? titleCase(s.interval) : "—"}</dd></div>
              <div className="bg-card/90 px-3 py-2.5">
                <dt className="micro-label">{s?.status === "trialing" ? "Trial ends" : s?.cancel_at_period_end ? "Ends" : "Renews"}</dt>
                <dd className="mt-1 font-mono text-[12.5px]">{s?.status === "trialing" && s.trial_ends_at ? format(new Date(s.trial_ends_at), "d MMM yyyy") : s?.current_period_end ? format(new Date(s.current_period_end), "d MMM yyyy") : "—"}</dd>
              </div>
              <div className="col-span-2 bg-card/90 px-3 py-2.5 sm:col-span-1">
                <dt className="micro-label">Provider</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-mono text-[12.5px]">{c.providers.razorpay && <RazorpayIcon className="size-3.5" />}{c.providers.stripe && <StripeIcon className="size-3.5" />}{provider}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-1.5 text-[13px]">
              {s?.status === "trialing" && trialDays != null && <p className="flex items-center gap-2 text-foreground-soft"><CalendarClock className="size-4 text-primary" />Free trial — {Math.max(0, trialDays)} day(s) left</p>}
              {s?.cancel_at_period_end && <p className="flex items-center gap-2 text-warning-foreground"><StatusDot tone="warn" />Cancellation requested — access continues until the end of the current period.</p>}
              {s?.scheduled_change && (
                <div className="flex flex-wrap items-center gap-2 text-foreground-soft">
                  <CalendarClock className="size-4 text-amber" />
                  <span>Switching to <span className="font-medium text-foreground">{s.scheduled_change.plan.name}</span>{s.scheduled_change.effective_at ? ` on ${format(new Date(s.scheduled_change.effective_at), "d MMM yyyy")}` : " at the end of this period"}.</span>
                  {canManage && <Button variant="link" size="xs" className="h-auto" disabled={undoSchedule.isPending} onClick={() => undoSchedule.mutate()}>Keep {p?.name}</Button>}
                </div>
              )}
              {s?.pending_checkout && !["active"].includes(s.status) && <p className="font-mono text-[11px] text-muted-foreground">Pending checkout · {titleCase(s.pending_checkout.plan_code)} ({s.pending_checkout.interval}) — waiting for payment confirmation</p>}
              {!c.providers.razorpay && !c.providers.stripe && <p className="text-xs text-muted-foreground">{c.providers.mock ? "Demo mode — a simulated provider is used and no real charges are made." : "No payment provider is configured on this server."}</p>}
            </div>
            {canCancel && (
              <div className="mt-4">
                <ConfirmDialog destructive title={s?.status === "trialing" ? "End your free trial?" : "Cancel subscription?"}
                  description={s?.status === "trialing" ? "Your trial ends immediately and paid features stop." : "Your subscription will be cancelled at the end of the current billing period. You keep access until then."}
                  confirmLabel={s?.status === "trialing" ? "End trial" : "Cancel subscription"} onConfirm={() => cancel.mutateAsync().then(() => undefined)}
                  trigger={<Button variant="ghost" size="sm" className="-ml-2 text-danger-foreground">{s?.status === "trialing" ? "End trial" : "Cancel subscription"}</Button>} />
              </div>
            )}
          </div>
          <div className="space-y-5 border-t border-border bg-background-subtle/50 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between"><p className="micro-label">Usage this month</p><span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">{format(new Date(), "MMM yyyy")}</span></div>
            <Meter icon={MapPin} label="Locations" used={c.usage.locations} limit={p?.max_locations ?? 0} />
            <Meter icon={Users} label="Team members" used={c.usage.team_members} limit={p?.max_team_members ?? 0} />
            <Meter icon={Sparkles} label="AI requests" used={c.usage.ai_requests} limit={p?.ai_requests_per_month ?? 0} />
          </div>
        </div>
      </Card>

      {plans.isLoading ? <Skeleton className="h-96 rounded-xl" /> : plans.data && <PlansGrid plans={plans.data} current={c} canManage={canManage} />}

      {canManage && <BillingDetailsPanel />}

      {canManage && (
        <Reveal>
          <Panel index="04" label="Ledger" title={<><Receipt className="size-4 text-primary" />Payment history</>} description="Only payments confirmed by verified provider webhooks appear here" flush>
            {payments.isLoading ? <div className="p-5"><Skeleton className="h-32" /></div> : !payments.data?.length ? (
              <EmptyState compact icon={CreditCard} title="No payments yet" description="Invoices appear here after your first successful payment." />
            ) : (
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Date</TH><TH>Plan</TH><TH className="text-right">Amount</TH><TH>Status</TH><TH className="hidden md:table-cell">Provider</TH><TH className="text-right">Invoice</TH></TR></THead>
                <TBody>
                  {payments.data.map((pm) => (
                    <TR key={pm.id}>
                      <TD className="whitespace-nowrap font-mono text-[12px]">{format(new Date(pm.paid_at ?? pm.created_at), "d MMM yyyy")}</TD>
                      <TD>{pm.plan_code ? titleCase(pm.plan_code) : "—"}</TD>
                      <TD className="text-right font-mono font-medium tabular text-foreground">{formatCurrency(pm.amount_minor, pm.currency)}</TD>
                      <TD><div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={pm.status} />{pm.simulated && <Badge size="sm" variant="mint" mono>Simulated</Badge>}</div>{pm.failure_reason && <p className="mt-0.5 text-xs text-danger-foreground">{pm.failure_reason}</p>}</TD>
                      <TD className="hidden md:table-cell font-mono text-[11px] text-muted-foreground">{pm.provider === "mock" ? "demo provider" : pm.provider}</TD>
                      <TD className="text-right">
                        {pm.invoice_id ? (
                          <Button variant="ghost" size="xs" onClick={() => downloadFile(`/subscriptions/invoices/${pm.invoice_id}.pdf`, undefined, `${pm.invoice_number}.pdf`).catch((e) => toast.error(errorMessage(e)))}>
                            <Download /> <span className="font-mono">{pm.invoice_number}</span>
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
