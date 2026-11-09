"use client";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { CampaignWizard } from "@/components/campaigns/wizard";
import { useOrg } from "@/lib/session";

export default function NewCampaignPage() {
  const { can } = useOrg();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-3">
            <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-primary"><ArrowLeft className="size-3.5" /> Campaigns</Link>
            <span className="micro-label">/ Mission setup</span>
          </span>
        }
        title="New campaign"
        description="Ask recent customers for honest feedback in seven quick steps."
      />
      {can("campaigns.manage") ? <CampaignWizard /> : (
        <Card><EmptyState icon={Lock} title="You can't create campaigns" description="Ask an owner, admin or manager to create campaigns or change your role." /></Card>
      )}
    </div>
  );
}
