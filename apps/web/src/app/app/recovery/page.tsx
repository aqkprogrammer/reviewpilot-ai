"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings2, ShieldCheck } from "lucide-react";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import { Eyebrow, ReadoutStrip, type StripItem } from "@/components/console/kit";
import { CaseSheet } from "@/components/recovery/case-sheet";
import { NewCaseDialog } from "@/components/recovery/new-case-dialog";
import { CaseQueue, DEFAULT_FILTERS, type QueueFilters } from "@/components/recovery/queue";
import { RecoverySettingsDialog } from "@/components/recovery/settings-dialog";
import type { Summary } from "@/components/recovery/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";

function RecoveryInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { orgId, can, locationId, membership } = useOrg();
  const caseId = params.get("case");
  const [filters, setFilters] = React.useState<QueueFilters>(() => ({ ...DEFAULT_FILTERS, location: locationId ?? "all" }));
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  React.useEffect(() => setFilters((f) => ({ ...f, location: locationId ?? "all" })), [locationId]);

  const loc = filters.location === "all" ? undefined : filters.location;
  const summary = useQuery({
    queryKey: ["recovery", "summary", orgId, loc ?? null],
    queryFn: () => api.get<Summary>("/recovery/summary", { location_id: loc }),
    enabled: can("reviews.read"),
    refetchInterval: 60_000,
  });

  const setCase = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("case", id);
    else next.delete("case");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!can("reviews.read")) return <ReadOnlyNotice />;

  const s = summary.data;
  const v = (n: number | undefined) => (summary.isError ? "—" : n == null ? "···" : String(n).padStart(2, "0"));
  const strip: StripItem[] = [
    { label: "Open cases", value: v(s?.open), tone: s?.open ? "signal" : "default", hint: "Open, in progress or contacted" },
    { label: "SLA breached", value: v(s?.breached), tone: s?.breached ? "danger" : "muted", hint: "Overdue with no outreach yet" },
    { label: "Due today", value: v(s?.due_today), tone: s?.due_today ? "warn" : "muted", hint: "First response due before midnight" },
    { label: "Resolved · 7d", value: v(s?.resolved_7d), tone: s?.resolved_7d ? "ok" : "muted" },
    {
      label: "Median response",
      value: summary.isError ? "—" : !s ? "···" : s.median_first_response_hours == null ? "No data" : `${s.median_first_response_hours.toFixed(1)}h`,
      tone: s?.median_first_response_hours == null ? "muted" : "default",
      hint: "Opened → first logged outreach, for cases opened in the last 30 days",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Eyebrow live={!!s?.breached} parts={["Inbox", "Service recovery", membership.organization.is_demo ? "Demo workspace" : "Incident queue"]} />}
        title="Recovery"
        description="Follow up with unhappy customers before a bad experience becomes a lost one — every case has an owner and a response clock."
        className="mb-0 border-b-0 pb-1"
        actions={
          <>
            {can("settings.manage") && <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 /> Settings</Button>}
            {can("reviews.reply") && <Button size="sm" onClick={() => setNewOpen(true)}><Plus /> New case</Button>}
          </>
        }
      />
      {summary.isLoading ? <Skeleton className="h-[62px] rounded-xl" /> : <ReadoutStrip items={strip} />}
      <InlineAlert variant="primary" icon={ShieldCheck} title="Recover the experience, not the rating">
        Apologise, listen and fix what went wrong. Never ask a customer to change or remove a review, and never offer anything in exchange for one — ReviewPilot blocks notes that do.
      </InlineAlert>
      <CaseQueue filters={filters} setFilters={setFilters} summary={s} onOpen={setCase} selectedId={caseId} />
      <CaseSheet caseId={caseId} onClose={() => setCase(null)} />
      {can("settings.manage") && <RecoverySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
      {can("reviews.reply") && <NewCaseDialog open={newOpen} onOpenChange={setNewOpen} onCreated={setCase} />}
    </div>
  );
}

export default function RecoveryPage() {
  return (
    <React.Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-16" /><Skeleton className="h-96" /></div>}>
      <RecoveryInner />
    </React.Suspense>
  );
}
