"use client";
import { AppSidebar, useSidebarState } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { ShellBanners } from "@/components/shell/banners";
import { LogoMark } from "@/components/brand/logo";
import { RouteTransition } from "@/components/shell/route-transition";
import { OrgProvider } from "@/lib/session";

function ShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <div className="tech-corners relative flex size-16 items-center justify-center rounded-xl border border-border">
          <LogoMark size={36} />
          <span className="absolute inset-x-2 top-1/2 h-px overflow-hidden"><span className="block h-px w-full bg-[linear-gradient(90deg,transparent,var(--primary),transparent)] motion-safe:animate-[shimmer_1.4s_linear_infinite] [background-size:200%_100%]" /></span>
        </div>
        <p className="micro-label">Initialising workspace</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebarState();
  return (
    <OrgProvider fallback={<ShellLoading />}>
      <div className="flex min-h-dvh bg-background">
        <AppSidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ShellBanners />
          <AppTopbar />
          <main className="relative mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><RouteTransition>{children}</RouteTransition></main>
        </div>
      </div>
    </OrgProvider>
  );
}
