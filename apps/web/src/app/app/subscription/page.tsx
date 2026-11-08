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
import type { CurrentSub, PaymentRow, Plan } from "@/components/billing/types";
import { RazorpayIcon, StripeIcon } from "@/components/brand/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { meQueryKey, useOrg } from "@/lib/session";
import { cn, formatCurrency, formatNumber, titleCase } from "@/lib/utils";

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
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-3.5" />{label}</span>
        <span className="tabular"><span className="font-semibold">{formatNumber(used)}</span><span className="text-muted-foreground"> / {limit ? formatNumber(limit) : "—"}</span></span>
      </div>
      <Progress value={pct} indicatorClassName={pct >= 100 ? "bg-danger" : pct > 80 ? "bg-warning" : undefined} />
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

  if (current.isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-56" /><Skeleton className="h-96" /></div>;
  if (current.error) return <QueryErrorState error={current.error} onRetry={() => current.refetch()} />;
  const c = current.data!;
  const s = c.subscription;
  const p = c.plan;
  const trialDays = s?.trial_ends_at ? differenceInCalendarDays(new Date(s.trial_ends_at), new Date()) : null;
  const graceDays = s?.grace_period_ends_at ? differenceInCalendarDays(new Date(s.grace_period_ends_at), new Date()) : null;
  const canCancel = canManage && s && !s.cancel_at_period_end && ["trialing", "active"].includes(s.status);

  return (
    <div className="space-y-8">
      <React.Suspense fallback={null}><CheckoutResult /></React.Suspense>
      <PageHeader title="Subscription" description="Plan, usage and billing history. Plan changes take effect only after the payment provider confirms them." className="mb-0" />

      {s?.status === "grace_period" && <InlineAlert variant="danger" icon={AlertTriangle} title="Payment failed">Your last payment didn't go through. Update billing within {graceDays ?? 0} day(s) to avoid interruption.</InlineAlert>}
      {s && ["expired", "canceled"].includes(s.status) && <InlineAlert variant="warning" icon={AlertTriangle} title="Subscription inactive">Campaigns and AI features are paused. Choose a plan below to reactivate.</InlineAlert>}

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--purple))] text-white shadow-glow"><Sparkles className="size-5" /></span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">Current plan</p>
                <p className="text-[20px] font-semibold tracking-tight">{p?.name ?? "No plan"}</p>
              </div>
              {s && <StatusBadge status={s.status} size="md" />}
              {s?.provider === "mock" && <Badge variant="purple" size="sm"><FlaskConical />Simulated billing</Badge>}
            </div>
            <div className="mt-5 space-y-2 text-[13px]">
              {p && !p.is_custom_pricing && <p className="tabular"><span className="text-2xl font-semibold tracking-tight">{formatCurrency(s?.interval === "yearly" ? p.price_yearly_minor : p.price_monthly_minor)}</span><span className="text-muted-foreground"> / {s?.interval === "yearly" ? "year" : "month"}</span></p>}
              {s?.status === "trialing" && trialDays != null && <p className="flex items-center gap-2 text-foreground-soft"><CalendarClock className="size-4 text-primary" />Free trial — {Math.max(0, trialDays)} day(s) left (ends {format(new Date(s.trial_ends_at!), "d MMM yyyy")})</p>}
              {s?.status === "active" && s.current_period_end && <p className="flex items-center gap-2 text-foreground-soft"><CalendarClock className="size-4 text-muted-foreground" />{s.cancel_at_period_end ? "Ends" : "Renews"} on {format(new Date(s.current_period_end), "d MMM yyyy")}</p>}
              {s?.cancel_at_period_end && <p className="text-warning-foreground">Cancellation requested — access continues until the end of the current period.</p>}
              {s?.pending_checkout && !["active"].includes(s.status) && <p className="text-xs text-muted-foreground">Pending checkout for {titleCase(s.pending_checkout.plan_code)} ({s.pending_checkout.interval}) — waiting for payment confirmation.</p>}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canCancel && (
                <ConfirmDialog destructive title={s?.status === "trialing" ? "End your free trial?" : "Cancel subscription?"}
                  description={s?.status === "trialing" ? "Your trial ends immediately and paid features stop." : "Your subscription will be cancelled at the end of the current billing period. You keep access until then."}
                  confirmLabel={s?.status === "trialing" ? "End trial" : "Cancel subscription"} onConfirm={() => cancel.mutateAsync().then(() => undefined)}
                  trigger={<Button variant="ghost" size="sm" className="text-danger-foreground">{s?.status === "trialing" ? "End trial" : "Cancel subscription"}</Button>} />
              )}
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Payments by {c.providers.razorpay && <RazorpayIcon className="size-3.5" />}{c.providers.razorpay && "Razorpay"}{c.providers.razorpay && c.providers.stripe && " · "}{c.providers.stripe && <StripeIcon className="size-3.5" />}{c.providers.stripe && "Stripe"}
                {!c.providers.razorpay && !c.providers.stripe && (c.providers.mock ? "a simulated provider (demo mode — no real charges)" : "— no payment provider configured")}
              </span>
            </div>
          </div>
          <div className="space-y-5 rounded-xl border border-border bg-card/70 p-5">
            <p className="text-[13px] font-semibold">Usage this month</p>
            <Meter icon={MapPin} label="Locations" used={c.usage.locations} limit={p?.max_locations ?? 0} />
            <Meter icon={Users} label="Team members" used={c.usage.team_members} limit={p?.max_team_members ?? 0} />
            <Meter icon={Sparkles} label="AI requests" used={c.usage.ai_requests} limit={p?.ai_requests_per_month ?? 0} />
          </div>
        </div>
      </Card>

      {plans.isLoading ? <Skeleton className="h-96" /> : plans.data && <PlansGrid plans={plans.data} current={c} canManage={canManage} />}

      {canManage && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-4"><div><CardTitle className="flex items-center gap-2"><Receipt className="size-4 text-muted-foreground" />Payment history</CardTitle><CardDescription>Only payments confirmed by verified provider webhooks appear here</CardDescription></div></CardHeader>
          {payments.isLoading ? <div className="p-5"><Skeleton className="h-32" /></div> : !payments.data?.length ? (
            <EmptyState compact icon={CreditCard} title="No payments yet" description="Invoices appear here after your first successful payment." />
          ) : (
            <Table>
              <THead><TR className="hover:bg-transparent"><TH>Date</TH><TH>Plan</TH><TH className="text-right">Amount</TH><TH>Status</TH><TH className="hidden md:table-cell">Provider</TH><TH className="text-right">Invoice</TH></TR></THead>
              <TBody>
                {payments.data.map((pm) => (
                  <TR key={pm.id}>
                    <TD className="whitespace-nowrap">{format(new Date(pm.paid_at ?? pm.created_at), "d MMM yyyy")}</TD>
                    <TD>{pm.plan_code ? titleCase(pm.plan_code) : "—"}</TD>
                    <TD className="text-right font-medium tabular text-foreground">{formatCurrency(pm.amount_minor, pm.currency)}</TD>
                    <TD><div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={pm.status} />{pm.simulated && <Badge size="sm" variant="purple">Simulated</Badge>}</div>{pm.failure_reason && <p className="mt-0.5 text-xs text-danger-foreground">{pm.failure_reason}</p>}</TD>
                    <TD className="hidden md:table-cell text-xs">{pm.provider === "mock" ? "Demo provider" : titleCase(pm.provider)}</TD>
                    <TD className="text-right">
                      {pm.invoice_id ? (
                        <Button variant="ghost" size="xs" onClick={() => downloadFile(`/subscriptions/invoices/${pm.invoice_id}.pdf`, undefined, `${pm.invoice_number}.pdf`).catch((e) => toast.error(errorMessage(e)))}>
                          <Download /> <span className={cn("font-mono")}>{pm.invoice_number}</span>
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
