"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, LifeBuoy, UserRound } from "lucide-react";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { OrganizationTab } from "@/components/settings/organization-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SupportTab } from "@/components/settings/support-tab";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["organization", "profile", "notifications", "support"] as const;

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as string) : "organization";
  return (
    <Tabs value={tab} onValueChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="underline" className="min-w-max">
          <TabsTrigger value="organization"><Building2 /> Organization</TabsTrigger>
          <TabsTrigger value="profile"><UserRound /> Profile & security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell /> Notifications</TabsTrigger>
          <TabsTrigger value="support"><LifeBuoy /> Support</TabsTrigger>
        </TabsList>
      </div>
      <div className="max-w-4xl">
        <TabsContent value="organization"><OrganizationTab /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="support"><SupportTab /></TabsContent>
      </div>
    </Tabs>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Organization details, your account, notifications and support." />
      <React.Suspense fallback={<Skeleton className="h-96" />}><SettingsInner /></React.Suspense>
    </div>
  );
}
