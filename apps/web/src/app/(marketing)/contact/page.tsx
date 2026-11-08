import type { Metadata } from "next";
import { Mail, MessagesSquare, Building2, Clock } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/primitives";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the ReviewPilot AI team about plans, enterprise needs, agency partnerships or support.",
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact ReviewPilot AI", url: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const defaultMessage =
    topic === "enterprise" ? "Hi, we're interested in an Enterprise plan. We have about __ locations and would like to discuss..." : "";
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's talk" description="Questions about plans, an enterprise rollout or running ReviewPilot for your agency clients? We'd love to hear from you." />
      <Section className="pt-0">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-3">
            {[
              { icon: MessagesSquare, t: "Sales", d: "Plans, demos and pricing for multi-location businesses." },
              { icon: Building2, t: "Enterprise & agencies", d: "Volume pricing, white-label and security reviews." },
              { icon: Mail, t: "Support", d: "Existing customers can also raise a ticket from Help inside the app." },
              { icon: Clock, t: "Response time", d: "We reply within one business day, Monday to Saturday (IST)." },
            ].map((c) => (
              <div key={c.t} className="flex gap-4 rounded-[20px] border border-border bg-card p-5 shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft"><c.icon className="size-4 text-primary-soft-foreground" /></span>
                <div>
                  <p className="text-[14.5px] font-semibold text-foreground">{c.t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{c.d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[24px] border border-border bg-card p-6 shadow-md sm:p-8">
            <ContactForm defaultMessage={defaultMessage} />
          </div>
        </div>
      </Section>
    </>
  );
}
