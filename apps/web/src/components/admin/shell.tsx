"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Activity, BadgeIndianRupee, Bell, Bot, Building2, ChartNoAxesCombined, ChevronRight, CreditCard, Flag, LayoutDashboard, LifeBuoy, LogOut,
  Megaphone, Menu, Plug, Plus, Receipt, ScrollText, Search, Send, Settings2, ShieldAlert, ShieldCheck, Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { logout, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { LogoMark } from "@/components/brand/logo";
import { AnnouncementDialog } from "./announcement-dialog";
import { adminGet } from "./ui";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Platform", items: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/organizations", label: "Organizations", icon: Building2 },
    { href: "/admin/users", label: "Users", icon: Users },
  ] },
  { group: "Revenue", items: [
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Receipt },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/plans", label: "Plans", icon: BadgeIndianRupee },
    { href: "/admin/revenue", label: "Revenue Analytics", icon: ChartNoAxesCombined },
  ] },
  { group: "Operations", items: [
    { href: "/admin/integrations", label: "Integrations", icon: Plug },
    { href: "/admin/ai-usage", label: "AI Usage", icon: Bot },
    { href: "/admin/campaigns", label: "Campaign Monitoring", icon: Send },
    { href: "/admin/system-health", label: "System Health", icon: Activity },
  ] },
  { group: "Engagement", items: [
    { href: "/admin/support", label: "Support Tickets", icon: LifeBuoy },
    { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  ] },
  { group: "Governance", items: [
    { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
    { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
    { href: "/admin/settings", label: "Settings", icon: Settings2 },
  ] },
];
const ALL = NAV.flatMap((g) => g.items);

function activeItem(path: string) {
  return [...ALL].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/admin" ? path === "/admin" : path === i.href || path.startsWith(`${i.href}/`)));
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const current = activeItem(path);
  const tickets = useQuery({ queryKey: ["admin", "nav-ticket-count"], queryFn: () => adminGet<{ counts: Record<string, number> }>("/support/tickets", { page_size: 1 }), staleTime: 60_000 });
  const openTickets = tickets.data?.counts?.open ?? 0;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LogoMark size={28} />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
            Review<span className="text-primary-soft-foreground">Pilot</span>
          </p>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-subtle-foreground">Control plane</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2 scrollbar-thin" aria-label="Admin">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = current?.href === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-lg border border-transparent px-3 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.03] hover:text-foreground",
                        active && "border-[#2f7bff]/40 bg-[linear-gradient(90deg,rgb(47_123_255/0.18),rgb(47_123_255/0.04))] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_24px_-10px_rgb(47_123_255/0.8)]",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-foreground-soft", active && "text-[#7eaaff]")} />
                      <span className="truncate">{item.label}</span>
                      {item.href === "/admin/support" && openTickets > 0 && (
                        <span className="ml-auto rounded-full bg-[#2f7bff] px-1.5 py-px font-mono text-[10px] font-semibold text-white">{openTickets}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl border border-border bg-card-elevated/60 p-3">
        <p className="flex items-center gap-2 text-[12px] font-medium text-foreground">
          <ShieldCheck className="size-3.5 text-success-foreground" /> Least-privilege mode
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Customer content requires a ticket-scoped grant. Every action is audited.</p>
      </div>
    </div>
  );
}

function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);
  React.useEffect(() => { if (!open) setQ(""); }, [open]);
  const results = useQuery({
    queryKey: ["admin", "search", debounced],
    queryFn: () => adminGet<{ organizations: { id: string; name: string; status: string }[]; users: { id: string; name: string; email: string }[]; tickets: { id: string; subject: string; status: string }[] }>("/search", { q: debounced }),
    enabled: open && debounced.length >= 2,
  });
  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const itemCls = "flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground-soft data-[selected=true]:bg-[rgb(47_123_255/0.12)] data-[selected=true]:text-foreground";
  const heading = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-subtle-foreground";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Search the console</DialogTitle>
        <Command shouldFilter={false} className="flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 text-subtle-foreground" />
            <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Search organizations, users, tickets, or jump to a section…" className="h-12 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle-foreground" />
            <kbd className="rounded border border-border-strong px-1.5 font-mono text-[10px] text-subtle-foreground">ESC</kbd>
          </div>
          <Command.List className={cn("max-h-[380px] overflow-y-auto p-2 scrollbar-thin", heading)}>
            <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted-foreground">{results.isFetching ? "Searching…" : "No matches."}</Command.Empty>
            {(results.data?.organizations.length ?? 0) > 0 && (
              <Command.Group heading="Organizations">
                {results.data!.organizations.map((o) => (
                  <Command.Item key={o.id} value={`org-${o.id}`} onSelect={() => go(`/admin/organizations/${o.id}`)} className={itemCls}>
                    <Building2 className="size-4 text-subtle-foreground" /> {o.name}
                    <span className="ml-auto text-[11px] text-subtle-foreground">{o.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {(results.data?.users.length ?? 0) > 0 && (
              <Command.Group heading="Users">
                {results.data!.users.map((u) => (
                  <Command.Item key={u.id} value={`user-${u.id}`} onSelect={() => go(`/admin/users?user=${u.id}`)} className={itemCls}>
                    <Users className="size-4 text-subtle-foreground" /> {u.name}
                    <span className="ml-auto truncate text-[11px] text-subtle-foreground">{u.email}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {(results.data?.tickets.length ?? 0) > 0 && (
              <Command.Group heading="Tickets">
                {results.data!.tickets.map((t) => (
                  <Command.Item key={t.id} value={`ticket-${t.id}`} onSelect={() => go(`/admin/support/${t.id}`)} className={itemCls}>
                    <LifeBuoy className="size-4 text-subtle-foreground" /> <span className="truncate">{t.subject}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="Jump to">
              {ALL.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase())).map((i) => (
                <Command.Item key={i.href} value={`nav-${i.href}`} onSelect={() => go(i.href)} className={itemCls}>
                  <i.icon className="size-4 text-subtle-foreground" /> {i.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Forbidden403() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-[#f43f5e]/30 bg-danger-soft text-danger-foreground">
          <ShieldAlert className="size-6" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle-foreground">Error 403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">This area is restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">The ReviewPilot control plane is only available to platform Super Admins. If you manage a business, head to your dashboard.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link href="/app">Go to dashboard</Link></Button>
          <Button variant="outline" onClick={() => logout()}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const me = useMe();
  const [mobileNav, setMobileNav] = React.useState(false);
  const [search, setSearch] = React.useState(false);
  const [announce, setAnnounce] = React.useState(false);

  // Portals (dialogs, menus) render into <body>, so the console theme is applied there too.
  React.useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  React.useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [me.error, router, path]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (me.isLoading || (me.error instanceof ApiError && me.error.status === 401)) return <div className="admin-theme min-h-dvh bg-background"><ShellSkeleton /></div>;
  if (!me.data || me.data.user.platform_role !== "platform_super_admin") return <div className="admin-theme min-h-dvh bg-background"><Forbidden403 /></div>;

  const user = me.data.user;
  const current = activeItem(path);
  const isDetail = current && path !== current.href;

  return (
    <div className="admin-theme min-h-dvh bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_70%_0%,rgb(47_123_255/0.10),transparent_70%)]" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block">
        <Sidebar />
      </aside>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[272px] bg-sidebar p-0 sm:max-w-[272px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <div className="relative lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-[12.5px]">
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">Admin</Link>
              <ChevronRight className="size-3.5 text-subtle-foreground" />
              {isDetail ? (
                <>
                  <Link href={current!.href} className="truncate text-muted-foreground hover:text-foreground">{current!.label}</Link>
                  <ChevronRight className="size-3.5 text-subtle-foreground" />
                  <span className="truncate font-medium text-foreground">Details</span>
                </>
              ) : (
                <span className="truncate font-medium text-foreground">{current?.label ?? "Overview"}</span>
              )}
            </nav>
            <button
              type="button"
              onClick={() => setSearch(true)}
              className="ml-auto hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 text-[13px] text-subtle-foreground transition hover:border-border-strong md:flex"
            >
              <Search className="size-4" />
              Search the console
              <span className="ml-auto flex gap-1">
                <kbd className="rounded border border-border-strong px-1.5 font-mono text-[10px]">⌘</kbd>
                <kbd className="rounded border border-border-strong px-1.5 font-mono text-[10px]">K</kbd>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearch(true)} aria-label="Search">
                <Search />
              </Button>
              <Button variant="outline" size="icon-sm" asChild aria-label="Support tickets">
                <Link href="/admin/support"><Bell /></Link>
              </Button>
              <Button size="sm" onClick={() => setAnnounce(true)} className="shadow-glow">
                <Plus /> <span className="hidden sm:inline">New announcement</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                    <Avatar name={user.full_name} src={user.avatar_url} size={34} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60">
                  <DropdownMenuLabel className="normal-case tracking-normal">
                    <span className="block text-[13px] font-semibold text-foreground">{user.full_name}</span>
                    <span className="block truncate text-[12px] font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/admin/audit-logs?mine=1"><ScrollText /> My audit trail</Link></DropdownMenuItem>
                  {me.data.memberships.length > 0 && <DropdownMenuItem asChild><Link href="/app"><Building2 /> Business app</Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => logout()}><LogOut /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="relative mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <CommandSearch open={search} onOpenChange={setSearch} />
      <AnnouncementDialog open={announce} onOpenChange={setAnnounce} />
    </div>
  );
}
