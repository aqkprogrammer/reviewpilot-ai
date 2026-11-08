"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleX, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import type { Plan } from "@/components/billing/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/controls";
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
  if (plans.isLoading) return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  if (!plan) return <EmptyState icon={CircleX} title="Unknown plan" action={<Button asChild variant="outline"><Link href="/app/subscription">Back to plans</Link></Button>} />;
  const amount = interval === "yearly" ? plan.price_yearly_minor : plan.price_monthly_minor;
  const gst = Math.round((amount * 18) / 118);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/subscription" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to plans</Link>
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">Order summary</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight">ReviewPilot AI — {plan.name}</p>
          <p className="text-[13px] text-muted-foreground">{membership.organization.name} · billed {interval === "yearly" ? "annually" : "monthly"}</p>
          <Separator className="my-5" />
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatCurrency(amount - gst)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">GST (18%)</dt><dd className="tabular">{formatCurrency(gst)}</dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-[15px] font-semibold"><dt>Total today</dt><dd className="tabular">{formatCurrency(amount)}</dd></div>
          </dl>
          <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">{plan.features.slice(0, 4).map((f) => <li key={f}>· {f}</li>)}</ul>
        </Card>
        <Card className="relative overflow-hidden border-purple/30 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_14px,color-mix(in_oklab,var(--purple)_5%,transparent)_14px,color-mix(in_oklab,var(--purple)_5%,transparent)_28px)]" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg bg-purple-soft px-3 py-2 text-[13px] font-semibold text-purple"><FlaskConical className="size-4" />Simulated payment — no money moves</div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              Demo mode has no real payment provider. Choosing an outcome sends a signed test webhook through the same verification and subscription logic that real Razorpay and Stripe events use.
            </p>
            <div className="mt-6 space-y-2.5">
              <Button size="lg" className="w-full" loading={complete.isPending && complete.variables === "success"} disabled={complete.isPending} onClick={() => complete.mutate("success")}><Lock /> Pay {formatCurrency(amount)} (simulate success)</Button>
              <Button size="lg" variant="outline" className="w-full" loading={complete.isPending && complete.variables === "failure"} disabled={complete.isPending} onClick={() => complete.mutate("failure")}>Simulate failed payment</Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-subtle-foreground"><ShieldCheck className="size-3.5" />Session {session}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <React.Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl" />}><MockCheckout /></React.Suspense>;
}
