import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#e9e3f7_0%,#efeaf8_40%,#ebe6f6_100%)] lg:p-3 dark:bg-none dark:bg-background">
      <a href="#main" className="sr-only z-50 rounded-lg bg-card px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="relative mx-auto max-w-[1440px] overflow-clip bg-[#fcfbff] shadow-[0_0_0_1px_rgba(120,90,200,0.08),0_30px_80px_-40px_rgba(70,30,160,0.25)] lg:rounded-[28px] dark:bg-background dark:shadow-none">
        <SiteNav />
        <main id="main">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
