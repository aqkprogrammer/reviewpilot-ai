"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import { GoogleCard } from "@/components/integrations/google-card";
import { EmailCard, OpenAICard, SmsCard } from "@/components/integrations/other-cards";
import { WhatsAppCard } from "@/components/integrations/whatsapp-card";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";

const GOOGLE_RESULTS: Record<string, [kind: "success" | "error" | "info", message: string]> = {
  connected: ["success", "Google Business Profile connected. Link your locations below."],
  pending_access: ["info", "Google authorized the connection, but Business Profile API access for this project is still pending Google's approval."],
  cancelled: ["info", "Google connection was cancelled."],
  state_invalid: ["error", "The Google connection link expired. Please try again."],
  session_mismatch: ["error", "Please connect Google while signed in as the same user who started the connection."],
  exchange_failed: ["error", "Google rejected the authorization. Please try again."],
  discovery_failed: ["error", "Connected, but we couldn't list your Business Profile accounts. Try “Refresh accounts”."],
};

function GoogleResultToast() {
  const params = useSearchParams();
  const router = useRouter();
  React.useEffect(() => {
    const r = params.get("google");
    if (!r) return;
    const [kind, msg] = GOOGLE_RESULTS[r] ?? ["info", `Google: ${r}`];
    toast[kind](msg);
    router.replace("/app/integrations");
  }, [params, router]);
  return null;
}

export default function IntegrationsPage() {
  const { orgId, can } = useOrg();
  const overview = useQuery({ queryKey: ["integrations", "overview", orgId], queryFn: () => api.get<{ sms: { status: string; delivery: { mode: string } }; openai: { status: string; model: string | null } }>("/integrations") });
  if (!can("reviews.read") && !can("integrations.manage")) return <ReadOnlyNotice />;
  return (
    <div>
      <React.Suspense fallback={null}><GoogleResultToast /></React.Suspense>
      <PageHeader title="Integrations" description="Connection status is always real — nothing shows as connected unless the provider confirmed it." />
      {!can("integrations.manage") && <p className="mb-4 text-[13px] text-muted-foreground">You can view integration status. Owners and admins can change connections.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <GoogleCard />
        <WhatsAppCard />
        <EmailCard />
        <SmsCard data={overview.data?.sms} />
        <OpenAICard data={overview.data?.openai} />
      </div>
    </div>
  );
}
