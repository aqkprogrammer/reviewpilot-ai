import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForceDark } from "@/components/marketing/force-dark";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <ForceDark />
      <a
        href="#main"
        className="sr-only z-50 rounded-md border border-border-strong bg-card px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
