import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/features#whatsapp", label: "WhatsApp collection" },
      { href: "/features#ai", label: "AI review assistant" },
      { href: "/features#analytics", label: "Analytics" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/solutions/restaurants", label: "Restaurants" },
      { href: "/solutions/clinics", label: "Clinics" },
      { href: "/solutions/salons", label: "Salons & spas" },
      { href: "/solutions/hotels", label: "Hotels" },
      { href: "/solutions", label: "All industries" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-5 pb-10 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              ReviewPilot AI helps local businesses collect genuine reviews, respond with care, and turn customer feedback into growth.
            </p>
            <p className="mt-4 text-[12px] text-subtle-foreground">Made in India, for businesses everywhere.</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title}>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground">{c.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[13.5px] text-foreground-soft transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col-reverse items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[12.5px] text-subtle-foreground">© {new Date().getFullYear()} ReviewPilot AI. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-subtle-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" aria-hidden /> Google review policy compliant — no gating, no incentives</span>
            <span>DPDP Act 2023 &amp; GDPR ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
