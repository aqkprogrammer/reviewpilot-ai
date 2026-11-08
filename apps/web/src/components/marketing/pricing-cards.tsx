"use client";
import * as React from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatINR, TRIAL_DAYS, type PublicPlan } from "./plans";

export function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1 shadow-xs" role="radiogroup" aria-label="Billing period">
      {[
        { v: false, l: "Monthly" },
        { v: true, l: "Annual" },
      ].map((o) => (
        <button
          key={o.l}
          role="radio"
          aria-checked={annual === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition",
            annual === o.v ? "bg-[#1d0b3a] text-white dark:bg-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.l}
          {o.v && <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", annual ? "bg-white/15 text-white" : "bg-success-soft text-success-foreground")}>2 months free</span>}
        </button>
      ))}
    </div>
  );
}

export function PricingCards({ plans, compact = false }: { plans: PublicPlan[]; compact?: boolean }) {
  const [annual, setAnnual] = React.useState(false);
  return (
    <div>
      <BillingToggle annual={annual} onChange={setAnnual} />
      <div className={cn("mt-10 grid gap-4", plans.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        {plans.map((p) => {
          const monthly = p.price_monthly_minor ?? 0;
          const yearly = p.price_yearly_minor ?? monthly * 10;
          const display = annual ? Math.round(yearly / 12) : monthly;
          return (
            <div
              key={p.code}
              className={cn(
                "relative flex flex-col rounded-[22px] border bg-card p-6 shadow-sm",
                p.is_popular ? "border-transparent shadow-lg ring-2 ring-primary/60" : "border-border",
              )}
            >
              {p.is_popular && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 rounded-b-[22px] bg-[radial-gradient(ellipse_at_bottom,rgba(214,58,240,0.16),transparent_70%)]" aria-hidden />
              )}
              <div className="relative flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-foreground">{p.name}</h3>
                {p.is_popular && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-soft-foreground">Most popular</span>}
              </div>
              <p className="relative mt-2 min-h-[40px] text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
              <div className="relative mt-5">
                {p.is_custom_pricing ? (
                  <p className="text-[34px] font-semibold tracking-[-0.03em] text-foreground">Custom</p>
                ) : (
                  <p className="flex items-baseline gap-1">
                    <span className="text-[34px] font-semibold tracking-[-0.03em] text-foreground tabular">{formatINR(display)}</span>
                    <span className="text-[13px] text-muted-foreground">/month</span>
                  </p>
                )}
                <p className="mt-1 h-4 text-[12px] text-subtle-foreground">
                  {p.is_custom_pricing ? "Volume pricing for chains & franchises" : annual ? `${formatINR(yearly)} billed yearly + GST` : "Billed monthly + GST"}
                </p>
              </div>
              <Button
                asChild
                variant={p.is_popular ? "gradient" : "outline"}
                size="lg"
                className={cn("relative mt-6 w-full", !p.is_popular && "rounded-full")}
              >
                <Link href={p.is_custom_pricing ? "/contact?topic=enterprise" : `/signup?plan=${p.code}&billing=${annual ? "yearly" : "monthly"}`}>
                  {p.is_custom_pricing ? "Talk to sales" : `Start ${TRIAL_DAYS}-day free trial`}
                  <ArrowRight />
                </Link>
              </Button>
              {!compact && <div className="relative my-6 h-px bg-border" />}
              <ul className={cn("relative space-y-2.5", compact && "mt-6")}>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13px] text-foreground-soft">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
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
