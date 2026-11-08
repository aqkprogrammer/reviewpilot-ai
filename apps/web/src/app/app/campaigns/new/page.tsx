"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CampaignWizard } from "@/components/campaigns/wizard";
import { useOrg } from "@/lib/session";
import { Lock } from "lucide-react";

export default function NewCampaignPage() {
  const { can } = useOrg();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/app/campaigns" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Campaigns</Link>}
        title="New campaign"
        description="Ask recent customers for honest feedback in seven quick steps."
      />
      {can("campaigns.manage") ? <CampaignWizard /> : (
        <Card><EmptyState icon={Lock} title="You can't create campaigns" description="Ask an owner, admin or manager to create campaigns or change your role." /></Card>
      )}
    </div>
  );
}
