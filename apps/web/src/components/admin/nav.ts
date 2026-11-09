import {
  Activity, BadgeIndianRupee, Bot, Building2, ChartNoAxesCombined, CreditCard, Flag, LayoutDashboard, LifeBuoy, Megaphone, Plug, Receipt, ScrollText, Send, Settings2, Users,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; short: string; icon: React.ComponentType<{ className?: string }> };
export type AdminNavGroup = { group: string; code: string; items: AdminNavItem[] };

/** Console information architecture. `short` is the breadcrumb / mono readout label. */
export const ADMIN_NAV: AdminNavGroup[] = [
  { group: "Platform", code: "PLT", items: [
    { href: "/admin", label: "Command center", short: "Overview", icon: LayoutDashboard },
    { href: "/admin/organizations", label: "Organizations", short: "Organizations", icon: Building2 },
    { href: "/admin/users", label: "Users", short: "Users", icon: Users },
  ] },
  { group: "Revenue", code: "REV", items: [
    { href: "/admin/subscriptions", label: "Subscriptions", short: "Subscriptions", icon: Receipt },
    { href: "/admin/payments", label: "Payments", short: "Payments", icon: CreditCard },
    { href: "/admin/plans", label: "Plans & pricing", short: "Plans", icon: BadgeIndianRupee },
    { href: "/admin/revenue", label: "Revenue analytics", short: "Revenue", icon: ChartNoAxesCombined },
  ] },
  { group: "Operations", code: "OPS", items: [
    { href: "/admin/system-health", label: "System health", short: "System health", icon: Activity },
    { href: "/admin/integrations", label: "Integrations", short: "Integrations", icon: Plug },
    { href: "/admin/ai-usage", label: "AI usage", short: "AI usage", icon: Bot },
    { href: "/admin/campaigns", label: "Campaign monitoring", short: "Campaigns", icon: Send },
  ] },
  { group: "Engagement", code: "ENG", items: [
    { href: "/admin/support", label: "Support desk", short: "Support", icon: LifeBuoy },
    { href: "/admin/announcements", label: "Announcements", short: "Announcements", icon: Megaphone },
  ] },
  { group: "Governance", code: "GOV", items: [
    { href: "/admin/audit-logs", label: "Audit logs", short: "Audit logs", icon: ScrollText },
    { href: "/admin/feature-flags", label: "Feature flags", short: "Feature flags", icon: Flag },
    { href: "/admin/settings", label: "Settings", short: "Settings", icon: Settings2 },
  ] },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((g) => g.items);

export function activeAdminItem(path: string) {
  return [...ADMIN_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => (i.href === "/admin" ? path === "/admin" : path === i.href || path.startsWith(`${i.href}/`)));
}

/** "04 / 16" style index + owning group for a path. */
export function sectionMeta(path: string) {
  const item = activeAdminItem(path);
  if (!item) return null;
  const index = ADMIN_NAV_ITEMS.indexOf(item) + 1;
  const group = ADMIN_NAV.find((g) => g.items.includes(item))!;
  return { item, group, index, total: ADMIN_NAV_ITEMS.length };
}
