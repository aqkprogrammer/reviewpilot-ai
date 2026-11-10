import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { FaqList } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { getPublicPlans } from "@/components/marketing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple INR pricing for ReviewPilot AI. Starter ₹999/month, Growth ₹1,999/month, Agency ₹4,999/month, and custom Enterprise plans. 14-day free trial.",
  alternates: { canonical: "/pricing" },
  openGraph: { title: "ReviewPilot AI pricing", url: "/pricing" },
};

type Cell = boolean | string;
const ROWS: { group: string; rows: [string, Cell, Cell, Cell, Cell][] }[] = [
  {
    group: "Collection",
    rows: [
      ["Business locations", "1", "Up to 3", "Up to 10", "Unlimited"],
      ["Branded QR codes & feedback pages", true, true, true, true],
      ["Email review requests", true, true, true, true],
      ["WhatsApp review campaigns", false, true, true, true],
      ["SMS (where a compliant provider is configured)", false, true, true, true],
      ["White-label feedback pages", false, false, true, true],
    ],
  },
  {
    group: "Reviews & AI",
    rows: [
      ["Review inbox & manual replies", true, true, true, true],
      ["Google Business Profile sync", true, true, true, true],
      ["AI review responses", false, true, true, true],
      ["Hindi & Hinglish AI", false, true, true, true],
      ["AI feedback insights", false, true, true, true],
    ],
  },
  {
    group: "Analytics & teams",
    rows: [
      ["Analytics", "Basic", "Advanced", "Advanced", "Custom"],
      ["Customer management & CSV import", false, true, true, true],
      ["PDF reports", false, false, true, true],
      ["Team members", "2", "10", "50", "Unlimited"],
      ["Multi-organization management", false, false, true, true],
      ["SSO & custom data retention", false, false, false, true],
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="mx-auto flex size-5 items-center justify-center rounded-[4px] border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft">
        <Check className="size-3 text-primary" strokeWidth={3} aria-label="Included" />
      </span>
    );
  if (v === false) return <Minus className="mx-auto size-4 text-border-strong" aria-label="Not included" />;
  return <span className="font-mono text-[12px] text-foreground">{v}</span>;
}

/** Live plan prices are refreshed from the API at most every five minutes (ISR). */
export const revalidate = 300;

export default async function PricingPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        path="pricing"
        meta="INR · excl. GST"
        title="Pricing that grows with you"
        description="Every plan includes a 14-day free trial. Prices are in INR and exclude GST. Upgrade, downgrade or cancel anytime."
      />
      <section className="relative px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <PricingCards plans={plans} />
        </div>
      </section>

      <Section id="compare">
        <SectionHeading index={[1, 2]} eyebrow="Compare" title="Compare plans in detail" description="Every capability, side by side. Plan limits are enforced in the product and shown in your subscription settings." />
        <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-card/70 hairline-top">
          <table className="w-full min-w-[760px] text-left">
            <caption className="sr-only">Plan feature comparison</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="micro-label w-[40%] px-6 py-4 font-normal">Feature</th>
                {["Starter", "Growth", "Agency", "Enterprise"].map((p) => (
                  <th key={p} scope="col" className={cn("px-4 py-4 text-center text-[14px] font-semibold text-foreground", p === "Growth" && "bg-primary-soft/60")}>
                    <span className="block">{p}</span>
                    {p === "Growth" && <span className="mt-1 block font-mono text-[9.5px] font-normal uppercase tracking-[0.12em] text-primary">Popular</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {ROWS.map((g, gi) => (
              <tbody key={g.group}>
                <tr className="border-t border-border bg-background-subtle/70">
                  <th colSpan={5} scope="colgroup" className="px-6 py-2.5 text-left font-normal">
                    <span className="micro-label">
                      <span className="text-primary/80">{String(gi + 1).padStart(2, "0")}</span> · {g.group}
                    </span>
                  </th>
                </tr>
                {g.rows.map(([label, ...vals]) => (
                  <tr key={label} className="border-t border-border transition-colors hover:bg-surface-hover/40">
                    <th scope="row" className="px-6 py-3.5 text-[13.5px] font-normal text-foreground-soft">{label}</th>
                    {vals.map((v, i) => (
                      <td key={i} className={cn("px-4 py-3.5 text-center", i === 1 && "bg-primary-soft/40")}>
                        <Value v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      <Section id="billing-faq">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading index={[2, 2]} eyebrow="Billing FAQ" title="Billing questions" className="lg:block" />
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">Payments are confirmed only by the payment provider — Razorpay in India, Stripe internationally.</p>
          </div>
          <div className="lg:col-span-8">
            <FaqList
              items={[
                { q: "How does the free trial work?", a: "You get 14 days of full access to your chosen plan. We'll remind you before it ends, and you can pick a plan or cancel from your subscription settings." },
                { q: "Which payment methods do you accept?", a: "In India we use Razorpay for UPI, cards and netbanking. International customers can pay by card through Stripe. Subscription changes take effect only after the payment provider confirms them." },
                { q: "What happens if a payment fails?", a: "We'll notify you and retry. Your account enters a short grace period so collection keeps running while you update your payment method." },
                { q: "Can I switch plans later?", a: "Yes. Upgrades apply immediately; downgrades take effect at the end of your current billing period. Plan limits such as locations are enforced when you switch." },
                { q: "Do prices include GST?", a: "No. Prices are shown excluding GST, which is added on your invoice where applicable." },
              ]}
            />
          </div>
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
