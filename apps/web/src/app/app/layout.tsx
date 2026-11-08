"use client";
import { AppSidebar, useSidebarState } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { ShellBanners } from "@/components/shell/banners";
import { LogoMark } from "@/components/brand/logo";
import { OrgProvider } from "@/lib/session";

function ShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={40} className="animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
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
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </OrgProvider>
  );
}
