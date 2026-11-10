import {
  BarChart3, Bot, Building2, CreditCard, HeartHandshake, LayoutDashboard, Newspaper, Zap, MapPin, Megaphone, MessageSquareText, Plug, QrCode, Send, Settings, Users, UsersRound,
} from "lucide-react";
import type { Permission } from "@reviewpilot/shared-types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  badgeKey?: "pending_reviews" | "open_recovery";
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard },
      { label: "Reviews", href: "/app/reviews", icon: MessageSquareText, permission: "reviews.read", badgeKey: "pending_reviews" },
      { label: "Review Requests", href: "/app/review-requests", icon: Send, permission: "customers.read" },
      { label: "Automations", href: "/app/automations", icon: Zap, permission: "campaigns.manage" },
      { label: "Recovery", href: "/app/recovery", icon: HeartHandshake, permission: "reviews.read", badgeKey: "open_recovery" },
      { label: "Campaigns", href: "/app/campaigns", icon: Megaphone, permission: "reviews.read" },
      { label: "QR Codes", href: "/app/qr-codes", icon: QrCode },
      { label: "Customers", href: "/app/customers", icon: UsersRound, permission: "customers.read" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Assistant", href: "/app/ai-assistant", icon: Bot, permission: "ai.use" },
      { label: "Analytics", href: "/app/analytics", icon: BarChart3, permission: "analytics.read" },
      { label: "Weekly digest", href: "/app/digest", icon: Newspaper, permission: "analytics.read" },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Locations", href: "/app/locations", icon: MapPin },
      { label: "Team Members", href: "/app/team", icon: Users },
      { label: "Integrations", href: "/app/integrations", icon: Plug },
      { label: "Subscription", href: "/app/subscription", icon: CreditCard },
      { label: "Settings", href: "/app/settings", icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);
export { Building2 };
