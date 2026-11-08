"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { CurrentSub, Plan } from "./types";

interface CheckoutOut { provider: string; checkout_url: string | null; reference: string; key_id?: string }

export function PlansGrid({ plans, current, canManage }: { plans: Plan[]; current: CurrentSub; canManage: boolean }) {
  const [interval, setInterval] = React.useState<"monthly" | "yearly">((current.subscription?.interval as "monthly") ?? "monthly");
  const active = current.subscription && ["active", "past_due", "grace_period"].includes(current.subscription.status);
  const checkout = useMutation({
    mutationFn: (code: string) => api.post<CheckoutOut>("/subscriptions/checkout", { plan_code: code, interval }),
    onSuccess: (r) => {
      if (r.checkout_url) window.location.href = r.checkout_url;
      else toast.info(`Checkout created with ${r.provider} (reference ${r.reference}). Complete payment from the provider's page.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const currentRank = plans.findIndex((p) => p.code === current.plan?.code);
  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-[17px] font-semibold tracking-tight">Plans</h2><p className="text-[13px] text-muted-foreground">Prices include 18% GST. Annual billing gives you two months free.</p></div>
        <div className="inline-flex h-9 items-center gap-0.5 self-start rounded-lg border border-border bg-card p-0.5 shadow-xs" role="group" aria-label="Billing interval">
          {(["monthly", "yearly"] as const).map((i) => (
            <button key={i} onClick={() => setInterval(i)} aria-pressed={interval === i} className={cn("flex h-full items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition", interval === i ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {i === "monthly" ? "Monthly" : "Annual"}{i === "yearly" && <span className={cn("rounded px-1 text-[10px] font-semibold", interval === i ? "bg-white/20" : "bg-success-soft text-success-foreground")}>−17%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, idx) => {
          const isCurrent = p.code === current.plan?.code && !!active && current.subscription?.interval === interval;
          const price = interval === "yearly" ? p.price_yearly_minor / 12 : p.price_monthly_minor;
          const label = p.is_custom_pricing ? "Contact sales" : isCurrent ? "Current plan" : currentRank >= 0 && idx < currentRank && active ? `Downgrade to ${p.name}` : `Choose ${p.name}`;
          return (
            <Card key={p.code} className={cn("relative flex flex-col p-5", p.is_popular && "border-primary/50 shadow-md ring-1 ring-primary/30")}>
              {p.is_popular && <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(100deg,var(--primary),var(--purple))] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-glow"><Sparkles className="size-3" />Most popular</span>}
              <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">{p.name}</h3>{isCurrent && <Badge size="sm" variant="success" dot>Current</Badge>}</div>
              <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                {p.is_custom_pricing ? <span className="text-[26px] font-semibold tracking-tight">Custom</span> : (
                  <>
                    <span className="text-[28px] font-semibold tracking-[-0.03em] tabular">{formatCurrency(Math.round(price))}</span>
                    <span className="text-xs text-muted-foreground">/month</span>
                  </>
                )}
              </div>
              <p className="h-4 text-[11.5px] text-subtle-foreground tabular">{!p.is_custom_pricing && interval === "yearly" ? `${formatCurrency(p.price_yearly_minor)} billed yearly` : ""}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-[12.5px] text-foreground-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{f}</li>)}
              </ul>
              <div className="mt-5">
                {p.is_custom_pricing ? (
                  <Button variant="outline" className="w-full" asChild><Link href="/contact?topic=enterprise">Contact sales</Link></Button>
                ) : (
                  <Button className="w-full" variant={p.is_popular && !isCurrent ? "primary" : "outline"} disabled={!canManage || isCurrent} loading={checkout.isPending && checkout.variables === p.code} onClick={() => checkout.mutate(p.code)}>
                    {label}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {!canManage && <p className="mt-3 text-xs text-muted-foreground">Only organization owners can change the plan.</p>}
    </div>
  );
}
