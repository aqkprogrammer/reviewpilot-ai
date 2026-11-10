"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarRange, FileText, FlaskConical, Inbox, Mail, Newspaper, Send } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { QueryErrorState, ReadOnlyNotice } from "@/components/billing/plan-gate";
import { ConsoleTabsList, Eyebrow } from "@/components/console/kit";
import { DeliveryPanel, EmailPreview, useSendTest } from "@/components/digest/delivery";
import { ActionsPanel, DigestSkeleton, KpiRow, LocationsTable, Masthead, Operations, RatingMix, Themes, Voices } from "@/components/digest/sections";
import type { Digest } from "@/components/digest/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Reveal, StatusDot } from "@/components/ui/tech";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

const LATEST = "latest";

function DigestInner() {
  const { can, orgId, locationId, locations } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [week, setWeek] = React.useState<string>(search.get("week_end") ?? LATEST);
  const [loc, setLoc] = React.useState(locationId ?? "all");
  const [tab, setTab] = React.useState("briefing");
  React.useEffect(() => setLoc(locationId ?? "all"), [locationId]);

  const params = { week_end: week === LATEST ? undefined : week, location_id: loc === "all" ? undefined : loc };
  const allowed = can("analytics.read");
  const query = useQuery({
    queryKey: ["digest", "preview", orgId, params],
    queryFn: () => api.get<Digest>("/digest/preview", params),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const sendTest = useSendTest(params);

  if (!allowed) return <ReadOnlyNotice message="The weekly digest is available to owners, admins, managers and analysts." />;

  const d = query.data;
  const weeks = d?.available_weeks ?? [];
  const selectWeek = (v: string) => {
    setWeek(v);
    const qs = new URLSearchParams(search.toString());
    if (v === LATEST) qs.delete("week_end");
    else qs.set("week_end", v);
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const quiet = d && d.reviews.new === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly digest"
        className="mb-0"
        eyebrow={<Eyebrow parts={["Intelligence", "Weekly briefing", d?.week.key ?? "—"]} />}
        description="A Monday-morning briefing on reviews, replies, recovery and requests — computed from your stored records, compared with the week before."
        actions={<Button variant="outline" loading={sendTest.isPending} onClick={() => sendTest.mutate()} disabled={!d}><Send /> Send me a test</Button>}
      />

      {/* Control strip */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={week} onValueChange={selectWeek}>
            <SelectTrigger size="sm" className="sm:w-72" aria-label="Week"><CalendarRange className="size-3.5 text-subtle-foreground" /><SelectValue placeholder="Last 7 days" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={LATEST}>Last 7 days{weeks[0] ? ` · ${weeks[0].range}` : ""}</SelectItem>
              {weeks.slice(1).map((w) => <SelectItem key={w.week_end} value={w.week_end}>{w.label} · {w.range}</SelectItem>)}
              {week !== LATEST && !weeks.some((w) => w.week_end === week) && <SelectItem value={week}>Week ending {week}</SelectItem>}
            </SelectContent>
          </Select>
          {locations.length > 1 && (
            <Select value={loc} onValueChange={setLoc}>
              <SelectTrigger size="sm" className="sm:w-56" aria-label="Location"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button asChild variant="ghost" size="sm" className="sm:ml-auto"><Link href="#settings"><Mail /> Email settings</Link></Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">
          <span className="flex items-center gap-2"><StatusDot tone={query.isFetching ? "signal" : query.error ? "error" : "ok"} pulse={query.isFetching} />{query.isFetching ? "Compiling" : query.error ? "Unavailable" : "Up to date"}</span>
          {d && <span>Window <span className="text-foreground-soft">{d.week.label}</span></span>}
          {d && <span>Compared with <span className="text-foreground-soft">{d.week.previous_label}</span></span>}
          {d && <span className="hidden sm:inline">TZ <span className="text-foreground-soft">{d.week.timezone}</span></span>}
          {d?.is_demo && <Badge variant="amber" mono size="sm" className="ml-auto"><FlaskConical />Demo data</Badge>}
        </div>
      </Card>

      {d?.is_demo && (
        <p className="-mt-2 flex items-start gap-2 text-[12.5px] text-muted-foreground"><FlaskConical className="mt-0.5 size-3.5 shrink-0 text-amber" />This organization contains sample reviews and simulated activity. The digest is for demonstration only.</p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <ConsoleTabsList id="digest" value={tab} items={[{ value: "briefing", label: "Briefing", icon: Newspaper }, { value: "email", label: "Email preview", icon: FileText }]} />

        <TabsContent value="briefing" className="mt-6">
          {query.error ? (
            <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : !d ? (
            <DigestSkeleton />
          ) : (
            <div className={cn("space-y-6 transition-opacity", query.isFetching && "opacity-70")}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <Masthead d={d} />
                <ActionsPanel actions={d.actions} />
              </div>

              {quiet && (
                <Card>
                  <EmptyState
                    compact icon={Inbox} title="No reviews this week"
                    description={d.reviews.previous ? `There were ${d.reviews.previous} the week before. Requests, recovery and QR activity are still summarised below.` : "Once reviews sync from Google or arrive through your feedback page they will be summarised here."}
                    action={<Button asChild size="sm" variant="outline"><Link href="/app/campaigns">Ask customers for feedback</Link></Button>}
                  />
                </Card>
              )}

              <Reveal><KpiRow d={d} /></Reveal>
              <Reveal>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <RatingMix d={d} />
                  <Themes d={d} />
                </div>
              </Reveal>
              <Reveal><Voices d={d} /></Reveal>
              <Reveal><Operations d={d} /></Reveal>
              {!d.scope.location_id && <Reveal><LocationsTable d={d} /></Reveal>}
              <DeliveryPanel orgId={orgId} sendTest={sendTest} />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
                Generated {new Date(d.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {d.scope.label}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-6 space-y-6">
          {tab === "email" && <EmailPreview params={params} orgId={orgId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DigestPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <DigestInner />
    </React.Suspense>
  );
}
