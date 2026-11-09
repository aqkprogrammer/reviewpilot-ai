"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CircleX, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import type { Plan } from "@/components/billing/types";
import { Eyebrow } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useOrg } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

function MockCheckout() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { membership, can } = useOrg();
  const session = params.get("session") ?? "";
  const planCode = params.get("plan") ?? "";
  const interval = params.get("interval") === "yearly" ? "yearly" : "monthly";
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.get<Plan[]>("/subscriptions/plans", undefined, { orgId: null }) });
  const plan = plans.data?.find((p) => p.code === planCode);
  const complete = useMutation({
    mutationFn: (outcome: "success" | "failure") => api.post<{ result: string }>("/subscriptions/mock-checkout/complete", { session, outcome }),
    onSuccess: async (_r, outcome) => {
      await Promise.all([qc.invalidateQueries({ queryKey: meQueryKey }), qc.invalidateQueries({ queryKey: ["subscription"] })]);
      router.push(`/app/subscription?checkout=${outcome === "success" ? "success" : "failed"}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!can("billing.manage")) return <ReadOnlyNotice message="Only organization owners can complete checkout." />;
  if (!session) return <EmptyState icon={CircleX} title="No checkout session" description="Start checkout from the subscription page." action={<Button asChild variant="outline"><Link href="/app/subscription">Back to plans</Link></Button>} />;
  if (plans.isLoading) return <Skeleton className="mx-auto h-96 max-w-4xl rounded-xl" />;
  if (!plan) return <EmptyState icon={CircleX} title="Unknown plan" action={<Button asChild variant="outline"><Link href="/app/subscription">Back to plans</Link></Button>} />;
  const amount = interval === "yearly" ? plan.price_yearly_minor : plan.price_monthly_minor;
  const gst = Math.round((amount * 18) / 118);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/app/subscription" className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" /> Back to plans</Link>
      <div>
        <Eyebrow parts={["Billing", "Checkout", "Simulation"]} />
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.025em]">Confirm your plan</h1>
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Receipt */}
        <Card className="overflow-hidden">
          <div className="border-b border-dashed border-border-strong p-5 sm:p-6">
            <p className="micro-label">Order summary</p>
            <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em]">ReviewPilot AI — {plan.name}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{membership.organization.name} · billed {interval === "yearly" ? "annually" : "monthly"}</p>
          </div>
          <dl className="space-y-2.5 p-5 font-mono text-[12.5px] sm:p-6">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatCurrency(amount - gst)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">GST · 18%</dt><dd className="tabular">{formatCurrency(gst)}</dd></div>
            <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-border-strong pt-3"><dt className="font-sans text-[14px] font-semibold">Total today</dt><dd className="font-sans text-[20px] font-semibold tracking-[-0.03em] tabular text-foreground">{formatCurrency(amount)}</dd></div>
          </dl>
          <ul className="space-y-1.5 border-t border-border bg-background-subtle/60 p-5 text-xs text-muted-foreground sm:px-6">
            {plan.features.slice(0, 4).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{f}</li>)}
          </ul>
        </Card>

        {/* Simulated payment terminal */}
        <Card className="relative overflow-hidden border-[color-mix(in_oklab,var(--amber)_32%,var(--border))]">
          <div aria-hidden className="h-2 bg-[repeating-linear-gradient(135deg,var(--amber)_0_10px,transparent_10px_20px)] opacity-60" />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--amber)_30%,transparent)] bg-amber-soft px-3 py-2">
              <FlaskConical className="size-4 shrink-0 text-amber" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-amber">Test mode · no money moves</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              Demo mode has no real payment provider. Choosing an outcome sends a signed test webhook through the same verification and subscription logic that real Razorpay and Stripe events use.
            </p>
            <div className="mt-6 space-y-2.5">
              <Button size="lg" className="w-full" loading={complete.isPending && complete.variables === "success"} disabled={complete.isPending} onClick={() => complete.mutate("success")}><Lock /> Pay {formatCurrency(amount)} · simulate success</Button>
              <Button size="lg" variant="outline" className="w-full" loading={complete.isPending && complete.variables === "failure"} disabled={complete.isPending} onClick={() => complete.mutate("failure")}>Simulate failed payment</Button>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 font-mono text-[10.5px] text-subtle-foreground">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="shrink-0 uppercase tracking-[0.1em]">Session</span>
              <span className="min-w-0 truncate" title={session}>{session}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-4xl rounded-xl" />}><MockCheckout /></React.Suspense>;
}
