"use client";
import * as React from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, CircleHelp, LogOut, MapPin, Menu, Plus, ShieldCheck, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { logout, useOrg } from "@/lib/session";
import { titleCase } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NotificationCenter } from "./notification-center";
import { SidebarNav } from "./app-sidebar";
import { Breadcrumbs } from "./breadcrumbs";

function OrgSwitcher() {
  const { me, membership, switchOrg } = useOrg();
  const org = membership.organization;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 min-w-0 max-w-[150px] items-center gap-2 sm:max-w-[220px] rounded-lg border border-border bg-background-subtle pl-1.5 pr-2 text-left transition hover:border-border-strong">
          <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft font-mono text-[11px] font-semibold text-primary">
            {org.logo_url ? <img src={org.logo_url} alt="" className="size-full object-cover" /> : org.name[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight">{org.name}</span>
            <span className="block truncate font-mono text-[9.5px] uppercase leading-tight tracking-[0.08em] text-subtle-foreground">{titleCase(membership.role)}{org.plan_code ? ` · ${titleCase(org.plan_code)}` : ""}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-subtle-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {me.memberships.map((m) => (
          <DropdownMenuItem key={m.organization.id} onSelect={() => m.organization.id !== org.id && switchOrg(m.organization.id)}>
            <Building2 />
            <span className="min-w-0 flex-1 truncate">{m.organization.name}</span>
            {m.organization.id === org.id && <Check className="!text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1"><Plus /> Create organization</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LocationFilter() {
  const { locations, locationId, setLocationId } = useOrg();
  if (locations.length < 2) return null;
  return (
    <Select value={locationId ?? "all"} onValueChange={(v) => setLocationId(v === "all" ? null : v)}>
      <SelectTrigger size="sm" className="hidden h-9 w-[200px] xl:flex" aria-label="Filter by location">
        <span className="flex min-w-0 items-center gap-2"><MapPin className="size-3.5 shrink-0 text-muted-foreground" /><SelectValue /></span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All locations</SelectItem>
        {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function UserMenu() {
  const { me } = useOrg();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar name={me.user.full_name} src={me.user.avatar_url} size={34} />
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={me.user.full_name} src={me.user.avatar_url} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{me.user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/app/settings?tab=profile"><UserRound /> Profile & security</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/app/settings?tab=support"><CircleHelp /> Help & support</Link></DropdownMenuItem>
        {me.user.platform_role === "platform_super_admin" && (
          <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck /> Super Admin console</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => logout()}><LogOut /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
        <OrgSwitcher />
        <LocationFilter />
        <span aria-hidden className="hidden h-5 w-px bg-border lg:block" />
        <Breadcrumbs />
        <div className="flex min-w-0 flex-1 justify-end px-1 sm:justify-center sm:px-2"><CommandPalette /></div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label="Help" className="hidden sm:inline-flex"><Link href="/app/settings?tab=support"><CircleHelp /></Link></Button>
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
          <NotificationCenter />
          <div className="ml-1 sm:ml-2"><UserMenu /></div>
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] sm:max-w-[280px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5"><Logo /></div>
          <div className="flex-1 overflow-y-auto px-3.5 pb-6"><SidebarNav onNavigate={() => setMobileOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
