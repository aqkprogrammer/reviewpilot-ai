"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, Plug, Plus, Store, Workflow } from "lucide-react";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import { ActivityTab } from "@/components/automations/activity-tab";
import { ConnectTab } from "@/components/automations/connect-tab";
import { RecordVisitDialog } from "@/components/automations/record-visit-dialog";
import { RuleEditorDialog } from "@/components/automations/rule-editor";
import { RulesTab } from "@/components/automations/rules-tab";
import { type Summary, automationKeys, fmtRelative } from "@/components/automations/types";
import { ConsoleTabsList, Eyebrow, ReadoutStrip } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { InlineAlert } from "@/components/ui/states";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AnimatedNumber } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

const TABS = ["rules", "activity", "connect"] as const;
type Tab = (typeof TABS)[number];

const n = (v: number) => formatNumber(Math.round(v));

function AutomationsInner() {
  const { orgId, can } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const param = params.get("tab");
  const tab: Tab = TABS.includes(param as Tab) ? (param as Tab) : "rules";
  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "rules") next.delete("tab");
    else next.set("tab", t);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const [creating, setCreating] = React.useState(false);
  const [recording, setRecording] = React.useState(false);

  const summary = useQuery({ queryKey: automationKeys.summary(orgId), queryFn: () => api.get<Summary>("/automations/summary"), refetchInterval: 60_000 });
  const s = summary.data;
  const v = (x: number | undefined) => (s ? <AnimatedNumber value={x ?? 0} format={n} /> : "—");

  if (!can("campaigns.manage")) return <ReadOnlyNotice message="Automations are managed by owners, admins and managers." />;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow live={!!s?.rules_enabled} parts={["Outreach", "Automations", s ? (s.rules_enabled ? `${s.rules_enabled} rule${s.rules_enabled === 1 ? "" : "s"} live` : "Idle") : "…"]} />}
        title="Automatic review requests"
        description="Every real visit — from your POS, booking tool, Zapier, Shopify or the front desk — becomes one well-timed request, sent only with consent."
        actions={
          <>
            {can("customers.manage") && <Button variant="outline" onClick={() => setRecording(true)}><Store /> Record a visit</Button>}
            <Button onClick={() => setCreating(true)}><Plus /> New rule</Button>
          </>
        }
      />

      {summary.isError ? (
        <InlineAlert variant="danger" title="Couldn't load automation stats">{errorMessage(summary.error)}</InlineAlert>
      ) : (
        <ReadoutStrip
          items={[
            { label: `Visits · ${s?.window_days ?? 7}d`, value: v(s?.received), hint: s?.definitions.received },
            { label: "Scheduled", value: s ? <>{v(s.scheduled)}{s.next_send_at && <span className="ml-2 text-[11px] text-subtle-foreground">next {fmtRelative(s.next_send_at)}</span>}</> : "—", tone: "signal" },
            { label: `Sent · ${s?.window_days ?? 7}d`, value: v(s?.sent), tone: s?.sent ? "ok" : "default" },
            { label: `Skipped · ${s?.window_days ?? 7}d`, value: v(s?.skipped), tone: "muted", hint: "No consent, opted out, cooldown or no matching rule" },
            { label: `Failed · ${s?.window_days ?? 7}d`, value: v(s?.failed), tone: s?.failed ? "danger" : "muted" },
            { label: "Google clicks", value: v(s?.google_clicks), tone: s?.google_clicks ? "warn" : "default", hint: s?.definitions.google_clicks },
          ]}
        />
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <ConsoleTabsList
          id="automations"
          value={tab}
          items={[
            { value: "rules", label: "Rules", icon: Workflow, count: s?.rules_enabled },
            { value: "activity", label: "Activity", icon: Activity, count: s ? s.received : undefined },
            { value: "connect", label: "Connect", icon: Plug, count: s?.api_keys_active || undefined },
          ]}
        />
        <TabsContent value="rules" className="pt-5"><RulesTab onCreate={() => setCreating(true)} /></TabsContent>
        <TabsContent value="activity" className="pt-5"><ActivityTab summary={s} /></TabsContent>
        <TabsContent value="connect" className="pt-5"><ConnectTab /></TabsContent>
      </Tabs>

      <RuleEditorDialog open={creating} onOpenChange={setCreating} />
      <RecordVisitDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <React.Suspense fallback={null}>
      <AutomationsInner />
    </React.Suspense>
  );
}
