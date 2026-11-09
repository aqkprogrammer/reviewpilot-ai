"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { Bell, Building2, LifeBuoy, UserRound } from "lucide-react";
import { ConsoleTabsList, Eyebrow } from "@/components/console/kit";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { OrganizationTab } from "@/components/settings/organization-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SupportTab } from "@/components/settings/support-tab";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";

const TABS = [
  { value: "organization", label: "Organization", icon: Building2 },
  { value: "profile", label: "Profile & security", icon: UserRound },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "support", label: "Support", icon: LifeBuoy },
];
const content = "outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]";

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab = TABS.some((t) => t.value === raw) ? (raw as string) : "organization";
  return (
    <Tabs.Root value={tab} onValueChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}>
      <ConsoleTabsList id="settings" value={tab} items={TABS} className="mb-6" />
      <div className="max-w-4xl">
        <Tabs.Content value="organization" className={content}><OrganizationTab /></Tabs.Content>
        <Tabs.Content value="profile" className={content}><ProfileTab /></Tabs.Content>
        <Tabs.Content value="notifications" className={content}><NotificationsTab /></Tabs.Content>
        <Tabs.Content value="support" className={content}><SupportTab /></Tabs.Content>
      </div>
    </Tabs.Root>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow={<Eyebrow parts={["Manage", "Configuration"]} />} title="Settings" description="Organization details, your account, notifications and support." />
      <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}><SettingsInner /></React.Suspense>
    </div>
  );
}
