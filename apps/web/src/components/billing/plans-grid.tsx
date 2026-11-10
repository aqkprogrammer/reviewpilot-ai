"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SlideToggle } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
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
  const qc = useQueryClient();
  const schedule = useMutation({
    mutationFn: (code: string) => api.post<CurrentSub>("/subscriptions/schedule-change", { plan_code: code }),
    onSuccess: (r) => {
      toast.success(`Scheduled — switches to ${r.subscription?.scheduled_change?.plan.name} at the end of this billing period.`);
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const currentRank = plans.findIndex((p) => p.code === current.plan?.code);
  // Paid, active subscriptions downgrade at period end (provider-scheduled); everything else goes through checkout.
  const canSchedule = current.subscription?.status === "active" && !!current.subscription.provider && current.subscription.interval === interval;
  const scheduledCode = current.subscription?.scheduled_change?.plan.code;
  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground"><span className="text-primary/80">02</span><span className="h-px w-3 bg-border-strong" />Catalogue</p>
          <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Plans</h2>
          <p className="text-[13px] text-muted-foreground">Prices include 18% GST. Annual billing gives you two months free.</p>
        </div>
        <SlideToggle
          id="billing-interval"
          label="Billing interval"
          value={interval}
          onChange={setInterval}
          className="self-start sm:self-auto"
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: <>Annual <span className="rounded-[3px] bg-success-soft px-1 font-mono text-[9.5px] font-semibold text-success-foreground">−17%</span></> },
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, idx) => {
          const isCurrent = p.code === current.plan?.code && !!active && current.subscription?.interval === interval;
          const price = interval === "yearly" ? p.price_yearly_minor / 12 : p.price_monthly_minor;
          const isDowngrade = currentRank >= 0 && idx < currentRank && !!active;
          const scheduled = scheduledCode === p.code;
          const label = p.is_custom_pricing ? "Contact sales" : isCurrent ? "Current plan" : scheduled ? "Scheduled" : isDowngrade && canSchedule ? "Switch at period end" : isDowngrade ? `Downgrade to ${p.name}` : `Choose ${p.name}`;
          const onAction = () => (isDowngrade && canSchedule ? schedule.mutate(p.code) : checkout.mutate(p.code));
          return (
            <Reveal key={p.code} delay={idx * 0.04} className="h-full min-w-0">
              <Card className={cn("relative flex h-full flex-col overflow-hidden p-5 transition-colors", p.is_popular ? "border-[color-mix(in_oklab,var(--primary)_45%,var(--border-strong))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent),0_20px_50px_-30px_var(--primary)]" : "card-hover", isCurrent && "border-[color-mix(in_oklab,var(--success)_40%,var(--border-strong))]")}>
                {p.is_popular && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-primary shadow-[0_0_12px_var(--primary)]" />}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">{String(idx + 1).padStart(2, "0")} · {p.code}</span>
                  {isCurrent ? (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-success-foreground"><span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />Current</span>
                  ) : p.is_popular ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">Recommended</span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.02em]">{p.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  {p.is_custom_pricing ? <span className="text-[28px] font-semibold tracking-[-0.035em]">Custom</span> : (
                    <>
                      <span className="text-[30px] font-semibold leading-none tracking-[-0.04em] tabular">{formatCurrency(Math.round(price))}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">/mo</span>
                    </>
                  )}
                </div>
                <p className="mt-1 h-4 font-mono text-[10.5px] tabular text-subtle-foreground">{!p.is_custom_pricing && interval === "yearly" ? `${formatCurrency(p.price_yearly_minor)} billed yearly` : ""}</p>
                <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-center">
                  {[["Loc.", p.max_locations], ["Seats", p.max_team_members], ["AI/mo", p.ai_requests_per_month]].map(([l, v]) => (
                    <div key={l as string} className="bg-background-subtle px-1 py-2">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">{l}</dt>
                      <dd className="mt-0.5 font-mono text-[12px] tabular text-foreground">{(v as number) ? formatNumber(v as number, { compact: true }) : "—"}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4">
                  {p.features.map((f) => <li key={f} className="flex gap-2 text-[12.5px] leading-snug text-foreground-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{f}</li>)}
                </ul>
                <div className="mt-5">
                  {p.is_custom_pricing ? (
                    <Button variant="outline" className="w-full" asChild><Link href="/contact?topic=enterprise">Contact sales</Link></Button>
                  ) : (
                    <Button className="w-full" variant={p.is_popular && !isCurrent ? "primary" : "outline"} disabled={!canManage || isCurrent || scheduled} loading={(checkout.isPending && checkout.variables === p.code) || (schedule.isPending && schedule.variables === p.code)} onClick={onAction}>
                      {label}
                    </Button>
                  )}
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
      {!canManage && <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Read-only · only organization owners can change the plan</p>}
    </div>
  );
}
