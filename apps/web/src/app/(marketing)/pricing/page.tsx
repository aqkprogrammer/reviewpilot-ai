import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Section, SectionHeading } from "@/components/marketing/primitives";
import { FaqList } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { getPublicPlans } from "@/components/marketing/plans";

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
  if (v === true) return <Check className="mx-auto size-4 text-primary" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto size-4 text-subtle-foreground" aria-label="Not included" />;
  return <span className="text-[13px] font-medium text-foreground">{v}</span>;
}

export default async function PricingPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <PageHero eyebrow="Pricing" title="Pricing that grows with you" description="Every plan includes a 14-day free trial. Prices are in INR and exclude GST. Upgrade, downgrade or cancel anytime." />
      <Section className="pt-0">
        <PricingCards plans={plans} />
      </Section>

      <Section className="bg-background-subtle/40">
        <SectionHeading eyebrow="Compare" title="Compare plans in detail" />
        <div className="mt-10 overflow-x-auto rounded-[22px] border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">Plan feature comparison</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-6 py-4 text-[13px] font-semibold text-muted-foreground">Feature</th>
                {["Starter", "Growth", "Agency", "Enterprise"].map((p) => (
                  <th key={p} scope="col" className="px-4 py-4 text-center text-[14px] font-semibold text-foreground">
                    {p}
                    {p === "Growth" && <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary-soft-foreground">Popular</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {ROWS.map((g) => (
              <tbody key={g.group}>
                <tr className="bg-background-subtle/60">
                  <th colSpan={5} scope="colgroup" className="px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">{g.group}</th>
                </tr>
                {g.rows.map(([label, ...vals]) => (
                  <tr key={label} className="border-t border-border">
                    <th scope="row" className="px-6 py-3.5 text-[13.5px] font-normal text-foreground-soft">{label}</th>
                    {vals.map((v, i) => (
                      <td key={i} className="px-4 py-3.5 text-center"><Value v={v} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Billing FAQ" title="Billing questions" />
        <div className="mx-auto mt-10 max-w-3xl">
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
      </Section>
      <FinalCta />
    </>
  );
}
