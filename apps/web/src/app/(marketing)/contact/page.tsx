import type { Metadata } from "next";
import { Mail, MessagesSquare, Building2, Clock } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
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
      <PageHero eyebrow="Contact" path="contact" meta="Reply within 1 business day" title="Let's talk" description="Questions about plans, an enterprise rollout or running ReviewPilot for your agency clients? We'd love to hear from you." />
      <section className="relative px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <ul className="border-t border-border">
              {[
                { icon: MessagesSquare, t: "Sales", d: "Plans, demos and pricing for multi-location businesses." },
                { icon: Building2, t: "Enterprise & agencies", d: "Volume pricing, white-label and security reviews." },
                { icon: Mail, t: "Support", d: "Existing customers can also raise a ticket from Help inside the app." },
                { icon: Clock, t: "Response time", d: "We reply within one business day, Monday to Saturday (IST)." },
              ].map((c, i) => (
                <li key={c.t} className="grid grid-cols-[auto_auto_1fr] items-start gap-4 border-b border-border py-5">
                  <span className="pt-2.5 font-mono text-[10.5px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex size-9 items-center justify-center rounded-md border border-border bg-card"><c.icon className="size-4 text-primary" /></span>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">{c.t}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{c.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="tech-corners rounded-xl border border-border-strong bg-card/80 shadow-lg hairline-top">
              <div className="flex items-center justify-between border-b border-border px-6 py-3">
                <span className="micro-label">New message</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">* Required</span>
              </div>
              <div className="p-6 sm:p-8">
                <ContactForm defaultMessage={defaultMessage} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
