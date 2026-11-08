"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight, LifeBuoy, Sparkles } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";

export function useSidebarState() {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("rp_sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("rp_sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  }, []);
  return { collapsed, toggle };
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, orgId, membership } = useOrg();
  const stats = useQuery({
    queryKey: ["reviews", "stats", orgId],
    queryFn: () => api.get<{ pending: number; negative_pending: number }>("/reviews/stats"),
    enabled: can("reviews.read"),
    refetchInterval: 120_000,
  });

  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={group.label}>
            {!collapsed && <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">{group.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badgeKey === "pending_reviews" ? stats.data?.pending : undefined;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-all duration-200",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[linear-gradient(100deg,var(--primary),color-mix(in_oklab,var(--primary)_70%,var(--purple)))] text-white shadow-glow"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("size-[17px] shrink-0", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && !!badge && (
                      <span className={cn("ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular", active ? "bg-white/20 text-white" : "bg-primary-soft text-primary-soft-foreground")}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                    {collapsed && !!badge && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />}
                  </Link>
                );
                return <li key={item.href}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        );
      })}
      {!collapsed && membership.organization.plan_code && membership.organization.subscription_status === "trialing" && (
        <Link href="/app/subscription" onClick={onNavigate} className="relative mx-1 overflow-hidden rounded-xl border border-primary/20 bg-primary-soft/60 p-3.5 transition hover:border-primary/40">
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/15 blur-2xl" aria-hidden />
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" /> Free trial active
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Choose a plan to keep WhatsApp campaigns and AI replies running.</p>
        </Link>
      )}
    </nav>
  );
}

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        <Link href="/app" aria-label="ReviewPilot home">{collapsed ? <LogoMark size={30} /> : <Logo size={28} />}</Link>
        {!collapsed && (
          <button onClick={onToggle} className="rounded-md p-1 text-subtle-foreground transition hover:bg-muted hover:text-foreground" aria-label="Collapse sidebar">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      <div className={cn("flex-1 overflow-y-auto pb-6 pt-2 scrollbar-thin", collapsed ? "px-3" : "px-3.5")}>
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex flex-col items-center gap-2")}>
        {collapsed ? (
          <button onClick={onToggle} className="rounded-md p-2 text-subtle-foreground hover:bg-muted hover:text-foreground" aria-label="Expand sidebar">
            <ChevronsRight className="size-4" />
          </button>
        ) : (
          <Link href="/app/settings?tab=support" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground transition hover:bg-muted hover:text-foreground">
            <LifeBuoy className="size-4 text-muted-foreground" /> Help & support
          </Link>
        )}
      </div>
    </aside>
  );
}
