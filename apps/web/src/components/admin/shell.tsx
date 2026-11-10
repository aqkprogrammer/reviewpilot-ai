"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight, Building2, ChevronDown, ChevronsLeft, ChevronsRight, CornerDownLeft, LayoutGrid, LifeBuoy, LogOut, Megaphone, Menu, Plus, ScrollText, Search, ShieldAlert, ShieldCheck, Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { logout, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { Kbd, PageTransition, StatusDot } from "@/components/ui/tech";
import { LogoMark } from "@/components/brand/logo";
import { AnnouncementDialog } from "./announcement-dialog";
import { ADMIN_NAV, ADMIN_NAV_ITEMS, activeAdminItem } from "./nav";
import { Monogram, adminGet, systemStatus } from "./ui";

/* ------------------------------------------------------------------ shared live signals */

interface HealthLite {
  api: { status: string; environment: string; demo_mode: boolean };
  database: { status: string };
  redis: { status: string };
  worker: { status: string };
  queue_backlog: number;
  jobs?: { failed_24h: number };
}
/** Same query key as the System Health page, so the probe is shared (no duplicate requests). */
function useHealthLite() {
  return useQuery({ queryKey: ["admin", "/system-health", {}], queryFn: () => adminGet<HealthLite>("/system-health"), staleTime: 15_000, refetchInterval: 60_000 });
}
function useTicketCounts() {
  return useQuery({ queryKey: ["admin", "nav-ticket-count"], queryFn: () => adminGet<{ counts: Record<string, number> }>("/support/tickets", { page_size: 1 }), staleTime: 60_000 });
}
function healthTone(h?: HealthLite) {
  if (!h) return "idle" as const;
  const core = [h.api.status, h.database.status].every((s) => s === "ok");
  if (!core) return "error" as const;
  const aux = [h.redis.status, h.worker.status].every((s) => s === "ok");
  return aux && !(h.jobs?.failed_24h ?? 0) ? ("ok" as const) : ("warn" as const);
}

/* ------------------------------------------------------------------ sidebar */

function useCollapsed() {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => { try { setCollapsed(localStorage.getItem("rp_admin_sidebar") === "collapsed"); } catch {} }, []);
  const toggle = React.useCallback(() => setCollapsed((c) => { try { localStorage.setItem("rp_admin_sidebar", c ? "open" : "collapsed"); } catch {} return !c; }), []);
  return { collapsed, toggle };
}

function SidebarNav({ collapsed, onNavigate, layoutId }: { collapsed?: boolean; onNavigate?: () => void; layoutId: string }) {
  const path = usePathname();
  const current = activeAdminItem(path);
  const reduce = useReducedMotion();
  const tickets = useTicketCounts();
  const health = useHealthLite();
  const open = tickets.data?.counts?.open ?? 0;
  const tone = healthTone(health.data);
  return (
    <nav className="flex flex-col gap-5" aria-label="Console sections">
      {ADMIN_NAV.map((g, gi) => {
        const first = ADMIN_NAV.slice(0, gi).reduce((sum, prev) => sum + prev.items.length, 0) + 1;
        const n = first + g.items.length - 1;
        return (
          <div key={g.group}>
            {collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-border" />
            ) : (
              <p className="mb-1.5 flex items-center gap-2 px-2.5">
                <span className="micro-label text-[10px]">{g.group}</span>
                <span aria-hidden className="h-px flex-1 bg-sidebar-border" />
                <span className="font-mono text-[9.5px] tabular tracking-[0.08em] text-subtle-foreground/70">{String(first).padStart(2, "0")}–{String(n).padStart(2, "0")}</span>
              </p>
            )}
            <ul className="flex flex-col gap-px">
              {g.items.map((item) => {
                const active = current?.href === item.href;
                const Icon = item.icon;
                const badge = item.href === "/admin/support" && open > 0 ? open : null;
                const alert = item.href === "/admin/system-health" && (tone === "warn" || tone === "error") ? tone : null;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-[1.5px] focus-visible:ring-ring",
                      collapsed && "mx-auto w-9 justify-center px-0",
                      active ? "text-foreground" : "text-sidebar-foreground hover:bg-surface-hover/70 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={layoutId}
                        className="absolute inset-0 rounded-md border border-[color-mix(in_oklab,var(--primary)_24%,transparent)] bg-sidebar-active"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                      >
                        <span className="absolute inset-y-1.5 -left-px w-[2px] rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                      </motion.span>
                    )}
                    <Icon className={cn("relative size-4 shrink-0 transition-colors", active ? "text-primary" : "text-subtle-foreground group-hover:text-foreground-soft")} />
                    {!collapsed && <span className="relative truncate">{item.label}</span>}
                    {!collapsed && badge != null && (
                      <span className="relative ml-auto rounded-[4px] border border-[color-mix(in_oklab,var(--amber)_32%,transparent)] bg-amber-soft px-1.5 py-px font-mono text-[10px] font-medium tabular text-amber" aria-label={`${badge} open tickets`}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                    {!collapsed && alert && <StatusDot tone={alert} className="relative ml-auto" label="Attention needed" />}
                    {collapsed && (badge != null || alert) && <span className={cn("absolute right-1 top-1 size-1.5 rounded-full", alert === "error" ? "bg-danger" : "bg-amber")} />}
                  </Link>
                );
                return <li key={item.href}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring" aria-label="Command center">
      <LogoMark size={26} />
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[14px] font-semibold tracking-[-0.02em] text-foreground">ReviewPilot</span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Control plane</span>
        </span>
      )}
    </Link>
  );
}

function OperatorCard({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <Tooltip content="Least privilege · every action audited" side="right">
        <span className="mx-auto flex size-8 items-center justify-center rounded-md text-success"><ShieldCheck className="size-4" /></span>
      </Tooltip>
    );
  }
  return (
    <div className="rounded-lg border border-sidebar-border bg-background-subtle/70 px-3 py-2.5">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-success-foreground">
        <ShieldCheck className="size-3.5" /> Least privilege
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Customer content needs a ticket-scoped grant. Every mutation is written to the audit log.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ ⌘K */

interface SearchResp { organizations: { id: string; name: string; status: string }[]; users: { id: string; name: string; email: string }[]; tickets: { id: string; subject: string; status: string }[] }

function CommandSearch({ open, onOpenChange, onAnnounce }: { open: boolean; onOpenChange: (o: boolean) => void; onAnnounce: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  React.useEffect(() => { if (!open) setQ(""); }, [open]);
  const results = useQuery({ queryKey: ["admin", "search", debounced], queryFn: () => adminGet<SearchResp>("/search", { q: debounced }), enabled: open && debounced.length >= 2 });
  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const item = "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-foreground-soft data-[selected=true]:bg-primary-soft data-[selected=true]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle-foreground data-[selected=true]:[&_svg]:text-primary";
  const heading = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-subtle-foreground";
  const d = results.data;
  const ql = q.toLowerCase();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" hideClose className="top-[12vh] max-w-xl translate-y-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search the console</DialogTitle>
        <Command shouldFilter={false} className="flex flex-col" label="Console search">
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 text-primary" />
            <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Search organizations, users, tickets — or jump to a section" className="h-12 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle-foreground" />
            {results.isFetching && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">Querying</span>}
            <Kbd>ESC</Kbd>
          </div>
          <Command.List className={cn("max-h-[400px] overflow-y-auto p-2 scrollbar-thin", heading)}>
            <Command.Empty className="px-3 py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">{results.isFetching ? "Searching…" : debounced.length < 2 ? "Type at least 2 characters" : "No matches"}</Command.Empty>
            {!!d?.organizations.length && (
              <Command.Group heading="Organizations">
                {d.organizations.map((o) => (
                  <Command.Item key={o.id} value={`org-${o.id}`} onSelect={() => go(`/admin/organizations/${o.id}`)} className={item}>
                    <Building2 /> <span className="truncate">{o.name}</span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{o.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {!!d?.users.length && (
              <Command.Group heading="Users">
                {d.users.map((u) => (
                  <Command.Item key={u.id} value={`user-${u.id}`} onSelect={() => go(`/admin/users?user=${u.id}`)} className={item}>
                    <Users /> <span className="truncate">{u.name}</span>
                    <span className="ml-auto truncate font-mono text-[11px] text-subtle-foreground">{u.email}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {!!d?.tickets.length && (
              <Command.Group heading="Tickets">
                {d.tickets.map((t) => (
                  <Command.Item key={t.id} value={`ticket-${t.id}`} onSelect={() => go(`/admin/support/${t.id}`)} className={item}>
                    <LifeBuoy /> <span className="truncate">{t.subject}</span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{t.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="Actions">
              {(!q || "new announcement".includes(ql)) && (
                <Command.Item value="act-announce" onSelect={() => { onOpenChange(false); onAnnounce(); }} className={item}><Megaphone /> New announcement</Command.Item>
              )}
              {(!q || "my audit trail".includes(ql)) && (
                <Command.Item value="act-audit" onSelect={() => go("/admin/audit-logs?mine=1")} className={item}><ScrollText /> My audit trail</Command.Item>
              )}
            </Command.Group>
            <Command.Group heading="Jump to">
              {ADMIN_NAV_ITEMS.filter((i) => !q || i.label.toLowerCase().includes(ql)).map((i) => (
                <Command.Item key={i.href} value={`nav-${i.href}`} onSelect={() => go(i.href)} className={item}>
                  <i.icon /> {i.label}
                  <ArrowRight className="ml-auto !size-3.5 opacity-0 [[data-selected=true]_&]:opacity-100" />
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="flex items-center gap-4 border-t border-border bg-background-subtle/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate</span>
            <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-3" /></Kbd> Open</span>
            <span className="ml-auto">Searches metadata only</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ guards */

function Forbidden403({ role }: { role?: string }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-80" />
      <div className="tech-corners relative w-full max-w-md rounded-xl border border-border bg-card p-8 hairline-top shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <span className="flex size-11 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger-foreground">
            <ShieldAlert className="size-5" />
          </span>
          <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger-foreground"><StatusDot tone="error" /> ERR 403 · Access denied</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">This console is restricted</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">The ReviewPilot control plane is available to platform Super Admins only. If you manage a business, your workspace lives in the dashboard.</p>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className="bg-background-subtle px-3 py-2.5"><dt className="micro-label">Required role</dt><dd className="mt-1 font-mono text-[12px] text-foreground">platform_super_admin</dd></div>
          <div className="bg-background-subtle px-3 py-2.5"><dt className="micro-label">Your role</dt><dd className="mt-1 font-mono text-[12px] text-amber">{role ?? "user"}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild><Link href="/app">Go to dashboard <ArrowRight /></Link></Button>
          <Button variant="outline" onClick={() => logout()}><LogOut /> Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy aria-label="Loading console">
      <div className="hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-border" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ topbar pieces */

function EnvReadout() {
  const h = useHealthLite();
  if (!h.data) return <Skeleton className="hidden h-8 w-48 rounded-md xl:block" />;
  const demo = h.data.api.demo_mode;
  const status = systemStatus(h.data);
  return (
    <Link
      href="/admin/system-health"
      className="hidden h-8 items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-background-subtle/70 font-mono text-[10.5px] uppercase tracking-[0.1em] transition hover:border-border-strong xl:flex"
      aria-label={`Environment ${h.data.api.environment}, ${demo ? "demo data" : "live data"}, ${status.label}`}
    >
      <span className="flex items-center gap-1.5 px-2.5 text-subtle-foreground">Env <span className="text-foreground">{h.data.api.environment}</span></span>
      <span className={cn("flex items-center gap-1.5 px-2.5", demo ? "text-amber" : "text-mint")}><StatusDot tone={demo ? "warn" : "live"} pulse={!demo} />{demo ? "Demo data" : "Live"}</span>
      <span className={cn("flex items-center gap-1.5 px-2.5", status.tone === "live" ? "text-mint" : status.tone === "error" ? "text-danger-foreground" : "text-amber")} title={status.detail}><StatusDot tone={status.tone} pulse={status.tone !== "warn"} />{status.label}</span>
    </Link>
  );
}

function Breadcrumb() {
  const path = usePathname();
  const current = activeAdminItem(path);
  const isDetail = current && path !== current.href;
  const seg = "font-mono text-[11px] uppercase tracking-[0.12em]";
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
      <Link href="/admin" className={cn(seg, "text-subtle-foreground transition hover:text-foreground")}>Admin</Link>
      <span aria-hidden className="text-border-strong">/</span>
      {isDetail ? (
        <>
          <Link href={current!.href} className={cn(seg, "hidden truncate text-muted-foreground transition hover:text-foreground sm:inline")}>{current!.short}</Link>
          <span aria-hidden className="hidden text-border-strong sm:inline">/</span>
          <span className={cn(seg, "truncate text-foreground")} aria-current="page">Detail</span>
        </>
      ) : (
        <span className={cn(seg, "truncate text-foreground")} aria-current="page">{current?.short ?? "Overview"}</span>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ shell */

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const me = useMe();
  const { collapsed, toggle } = useCollapsed();
  const [mobileNav, setMobileNav] = React.useState(false);
  const [search, setSearch] = React.useState(false);
  const [announce, setAnnounce] = React.useState(false);

  // Portals (dialogs, menus, toasts) render into <body>, so the console theme is applied there too.
  React.useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  React.useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [me.error, router, path]);

  const isAdmin = me.data?.user.platform_role === "platform_super_admin";
  React.useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  if (me.isLoading || (me.error instanceof ApiError && me.error.status === 401)) return <div className="admin-theme min-h-dvh bg-background"><ShellSkeleton /></div>;
  // Non-admins: render nothing that queries /admin — the API enforces this too.
  if (!me.data || !isAdmin) return <div className="admin-theme min-h-dvh bg-background text-foreground"><Forbidden403 role={me.data?.user.platform_role} /></div>;

  const user = me.data.user;
  const width = collapsed ? 64 : 248;

  return (
    <div className="admin-theme min-h-dvh bg-background text-foreground" style={{ ["--admin-sidebar" as string]: `${width}px` }}>
      <a href="#admin-main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out lg:flex"
        style={{ width }}
        aria-label="Console navigation"
      >
        <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "justify-between px-4")}>
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button onClick={toggle} className="rounded-md p-1 text-subtle-foreground transition hover:bg-surface-hover hover:text-foreground" aria-label="Collapse sidebar" aria-expanded>
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>
        <div className={cn("flex-1 overflow-y-auto py-4 scrollbar-thin", collapsed ? "px-2" : "px-3")}>
          <SidebarNav collapsed={collapsed} layoutId="admin-nav-active" />
        </div>
        <div className={cn("shrink-0 space-y-2 border-t border-sidebar-border p-3", collapsed && "flex flex-col items-center")}>
          <OperatorCard collapsed={collapsed} />
          {collapsed && (
            <button onClick={toggle} className="rounded-md p-2 text-subtle-foreground transition hover:bg-surface-hover hover:text-foreground" aria-label="Expand sidebar" aria-expanded={false}>
              <ChevronsRight className="size-4" />
            </button>
          )}
        </div>
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[280px] bg-sidebar p-0 sm:max-w-[280px]">
          <SheetTitle className="sr-only">Console navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4"><Brand /></div>
          <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
            <SidebarNav onNavigate={() => setMobileNav(false)} layoutId="admin-nav-active-mobile" />
          </div>
          <div className="border-t border-sidebar-border p-3"><OperatorCard /></div>
        </SheetContent>
      </Sheet>

      <div className="relative transition-[padding] duration-300 ease-out lg:pl-[var(--admin-sidebar)]">
        <header className="sticky top-0 z-20 border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Button variant="ghost" size="icon-sm" className="-ml-1 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></Button>
            <Breadcrumb />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearch(true)}
                className="hidden h-8 w-64 items-center gap-2 rounded-md border border-border bg-background-subtle/70 px-2.5 text-[12.5px] text-subtle-foreground transition hover:border-border-strong hover:text-muted-foreground md:flex"
                aria-label="Search the console"
              >
                <Search className="size-3.5" /> Search console
                <span className="ml-auto flex gap-0.5"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
              </button>
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearch(true)} aria-label="Search the console"><Search /></Button>
              <EnvReadout />
              <Button size="sm" onClick={() => setAnnounce(true)} aria-label="New announcement">
                <Plus /> <span className="hidden sm:inline">Announcement</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md p-0.5 pr-1 outline-none transition hover:bg-surface-hover focus-visible:ring-[1.5px] focus-visible:ring-ring" aria-label="Operator menu">
                    <Monogram name={user.full_name} size={28} round />
                    <ChevronDown className="hidden size-3.5 text-subtle-foreground sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <div className="flex items-center gap-3 px-2.5 py-2.5">
                    <Monogram name={user.full_name} size={34} round />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{user.full_name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="px-2.5 pb-2"><span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-primary"><ShieldCheck className="size-3" /> Super admin</span></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Operator</DropdownMenuLabel>
                  <DropdownMenuItem asChild><Link href="/admin/audit-logs?mine=1"><ScrollText /> My audit trail</Link></DropdownMenuItem>
                  {me.data.memberships.length > 0 && <DropdownMenuItem asChild><Link href="/app"><LayoutGrid /> Business app</Link></DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => setSearch(true)}><Search /> Search <span className="ml-auto font-mono text-[10px] text-subtle-foreground">⌘K</span></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => logout()}><LogOut /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main id="admin-main" className="relative mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[260px] bg-tech-grid opacity-50 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
          <PageTransition routeKey={path} className="relative">{children}</PageTransition>
        </main>
      </div>
      <CommandSearch open={search} onOpenChange={setSearch} onAnnounce={() => setAnnounce(true)} />
      <AnnouncementDialog open={announce} onOpenChange={setAnnounce} />
    </div>
  );
}
