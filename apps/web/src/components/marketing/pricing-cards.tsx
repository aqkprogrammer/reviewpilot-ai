"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINR, TRIAL_DAYS, type PublicPlan } from "./plans";

export function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5" role="radiogroup" aria-label="Billing period">
      {[
        { v: false, l: "Monthly" },
        { v: true, l: "Annual" },
      ].map((o) => {
        const on = annual === o.v;
        return (
          <button
            key={o.l}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={cn(
              "relative inline-flex h-8 items-center gap-2 rounded-md px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 rounded-md border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className="relative">{o.l}</span>
            {o.v && <span className="relative rounded-[4px] bg-mint-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-mint">2 months free</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PricingCards({ plans, compact = false }: { plans: PublicPlan[]; compact?: boolean }) {
  const [annual, setAnnual] = React.useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BillingToggle annual={annual} onChange={setAnnual} />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">INR · excl. GST · {TRIAL_DAYS}-day free trial</p>
      </div>
      <div className={cn("mt-8 grid gap-3", plans.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {plans.map((p, idx) => {
          const monthly = p.price_monthly_minor ?? 0;
          const yearly = p.price_yearly_minor ?? monthly * 10;
          const display = annual ? Math.round(yearly / 12) : monthly;
          return (
            <div
              key={p.code}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card/80 p-6 hairline-top transition-colors",
                p.is_popular
                  ? "tech-corners border-[color-mix(in_oklab,var(--primary)_45%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--card)),var(--card)_55%)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_12%,transparent),0_30px_70px_-30px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                  : "border-border hover:border-border-strong",
              )}
            >
              {p.is_popular && <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-primary shadow-[0_0_12px_var(--primary)]" />}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">P.{String(idx + 1).padStart(2, "0")}</span>
                {p.is_popular && (
                  <span className="rounded-[4px] border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-primary">Most popular</span>
                )}
              </div>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{p.name}</h3>
              <p className="mt-2 min-h-[40px] text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
              <div className="mt-6 border-t border-border pt-5">
                {p.is_custom_pricing ? (
                  <p className="text-[36px] font-semibold leading-none tracking-[-0.04em] text-foreground">Custom</p>
                ) : (
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[36px] font-semibold leading-none tracking-[-0.04em] text-foreground tabular">{formatINR(display)}</span>
                    <span className="font-mono text-[11px] text-subtle-foreground">/month</span>
                  </p>
                )}
                <p className="mt-2 h-4 font-mono text-[10.5px] text-subtle-foreground">
                  {p.is_custom_pricing ? "Volume pricing for chains & franchises" : annual ? `${formatINR(yearly)} billed yearly + GST` : "Billed monthly + GST"}
                </p>
              </div>
              <Button asChild variant={p.is_popular ? "gradient" : "outline"} size="lg" className="mt-6 w-full">
                <Link href={p.is_custom_pricing ? "/contact?topic=enterprise" : `/signup?plan=${p.code}&billing=${annual ? "yearly" : "monthly"}`}>
                  {p.is_custom_pricing ? "Talk to sales" : `Start ${TRIAL_DAYS}-day free trial`}
                  <ArrowRight />
                </Link>
              </Button>
              <ul className={cn("space-y-2.5", compact ? "mt-6" : "mt-6 border-t border-border pt-6")}>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13px] leading-snug text-foreground-soft">
                    <Check className={cn("mt-0.5 size-3.5 shrink-0", p.is_popular ? "text-primary" : "text-subtle-foreground")} strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
