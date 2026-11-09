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
    <footer className="relative overflow-hidden border-t border-border px-5 pt-16 sm:px-8 lg:px-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid opacity-40 [mask-image:linear-gradient(to_bottom,transparent,#000_40%,#000)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo size={26} />
            <p className="mt-5 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
              ReviewPilot AI helps local businesses collect genuine reviews, respond with care, and turn customer feedback into growth.
            </p>
            <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle-foreground">Made in India · for businesses everywhere</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            {columns.map((c, ci) => (
              <div key={c.title}>
                <h3 className="micro-label flex items-center gap-2">
                  <span className="text-primary/70">{String(ci + 1).padStart(2, "0")}</span>
                  {c.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[13.5px] text-foreground-soft transition-colors hover:text-primary">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-border py-6 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] tracking-[0.06em] text-subtle-foreground">© {new Date().getFullYear()} ReviewPilot AI. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-mint shadow-[0_0_8px_var(--mint)]" aria-hidden /> Google review policy compliant — no gating, no incentives
            </span>
            <span>DPDP Act 2023 &amp; GDPR ready</span>
          </div>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none relative mx-auto -mb-[0.22em] max-w-6xl select-none overflow-hidden">
        <p className="bg-[linear-gradient(180deg,color-mix(in_oklab,var(--foreground)_9%,transparent),transparent_85%)] bg-clip-text text-center text-[clamp(64px,17vw,232px)] font-semibold leading-[0.8] tracking-[-0.06em] text-transparent">
          ReviewPilot
        </p>
      </div>
    </footer>
  );
}
