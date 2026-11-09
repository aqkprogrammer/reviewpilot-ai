"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import {
  ArrowRight, ArrowUpRight, Bot, Check, Lightbulb, MapPin, Megaphone, MessageSquareText, QrCode, Sparkles, ThumbsUp, TrendingDown, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { AnimatedNumber, GridBackdrop, StatusDot } from "@/components/ui/tech";
import { StatusBadge } from "@/components/app/status-badge";
import { ChartTooltip } from "@/components/app/chart-kit";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";
import { MonoTime, PanelHeader, PanelLink } from "./kit";
import { IntelligenceStatus, ReputationIntelligenceCore } from "@/components/intelligence";
import type { Overview } from "./types";

/* ------------------------------------------------------------------ */
/* Hero instrument                                                     */
/* ------------------------------------------------------------------ */

export function HeroInstrument({ data, loading }: { data?: Overview; loading: boolean }) {
  const { me, membership } = useOrg();
  const first = me.user.full_name.split(" ")[0];
  const k = data?.kpis;
  const insight = data?.insights[0];
  const avg = k?.average_rating ?? null;
  const health = avg == null ? null : avg >= 4.5 ? { t: "Excellent", tone: "ok" as const } : avg >= 4 ? { t: "Healthy", tone: "ok" as const } : avg >= 3.5 ? { t: "Watch", tone: "warn" as const } : { t: "At risk", tone: "error" as const };
  const readouts = [
    { label: "New reviews", value: k?.new_reviews, fmt: (n: number) => formatNumber(Math.round(n)) },
    { label: "Period avg", value: k?.period_average_rating, fmt: (n: number) => n.toFixed(2) },
    { label: "Google clicks", value: k?.google_clicks, fmt: (n: number) => formatNumber(Math.round(n)) },
    { label: "QR scans", value: k?.qr_scans, fmt: (n: number) => formatNumber(Math.round(n)) },
  ];
  return (
    <Card className="relative flex h-full flex-col overflow-hidden">
      <GridBackdrop />
      <div className="relative grid flex-1 gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8">
        <div className="mx-auto flex flex-col items-center">
          <ReputationIntelligenceCore
            detail="lite"
            className="w-[240px] sm:w-[260px]"
            title={avg != null ? `Average rating ${avg.toFixed(2)} out of 5` : "Average rating unavailable"}
            centerValue={loading || !k ? "—" : <AnimatedNumber value={avg} format={(n) => n.toFixed(2)} duration={1.2} />}
            centerLabel="Avg rating · /5"
          />
          <IntelligenceStatus
            className="mt-1 justify-center"
            active={3}
            stages={["Ingested", "Analysed", "Answered"]}
            counts={[
              k ? formatNumber(k.new_reviews) : null,
              data ? formatNumber(data.sentiment.filter((s) => s.sentiment !== "unclassified").reduce((a, s) => a + s.count, 0)) : null,
              k && k.response_rate != null ? formatNumber(Math.round(k.new_reviews * k.response_rate)) : null,
            ]}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="micro-label">Reputation signal</span>
            {health && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground-soft">
                <StatusDot tone={health.tone} pulse={health.tone === "ok"} /> {health.t}
              </span>
            )}
            {data?.is_demo && <Badge size="sm" variant="amber" mono dot>Demo data</Badge>}
          </div>
          <h2 className="mt-2.5 text-[21px] font-semibold leading-snug tracking-[-0.03em] text-foreground sm:text-[24px]">
            {loading || !k ? (
              <Skeleton className="h-7 w-72 max-w-full" />
            ) : (
              <>
                {membership.organization.name} holds <span className="text-signal tabular">{avg?.toFixed(1) ?? "—"}★</span> across{" "}
                <span className="tabular">{formatNumber(k.total_reviews)}</span> reviews.
              </>
            )}
          </h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Welcome back, {first}. Here is where things stand for the selected period.</p>

          <dl className="mt-5 grid grid-cols-2 border-y border-border sm:grid-cols-4">
            {readouts.map((r, i) => (
              <div key={r.label} className={cn("py-3 pr-3", i % 2 === 1 && "pl-4 sm:pl-0", i > 0 && "sm:border-l sm:border-border sm:pl-4", i % 2 === 1 && "border-l border-border", i >= 2 && "border-t border-border sm:border-t-0")}>
                <dt className="micro-label">{r.label}</dt>
                <dd className="mt-1.5 font-mono text-[18px] font-medium tabular text-foreground">
                  {k ? <AnimatedNumber value={r.value ?? null} format={r.fmt} /> : <Skeleton className="h-5 w-12" />}
                </dd>
              </div>
            ))}
          </dl>

          {insight ? (
            <Link href="/app/ai-assistant" className="group mt-4 flex items-start gap-3 rounded-lg border border-border bg-background-subtle/70 px-3.5 py-3 outline-none transition hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] focus-visible:ring-[1.5px] focus-visible:ring-ring">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Sparkles className="size-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="micro-label block">Top AI insight · {insight.evidence_count} reviews</span>
                <span className="mt-0.5 block text-[13px] font-medium text-foreground">{insight.title}</span>
              </span>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ) : data ? (
            <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">No AI insight yet — needs more review text</p>
          ) : null}
        </div>
      </div>
      {data && <RatingTrace series={data.series} allTime={avg} />}
    </Card>
  );
}

/** Daily average rating across the selected period (days without reviews are skipped). */
function RatingTrace({ series, allTime }: { series: Overview["series"]; allTime: number | null }) {
  const pts = series.filter((p) => p.avg_rating != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.avg_rating as number));
  const max = Math.max(...pts.map((p) => p.avg_rating as number));
  return (
    <div className="relative border-t border-border bg-background-subtle/40 px-5 py-3 sm:px-6">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        <span>Daily avg rating · period trace</span>
        <span className="tabular">Low <span className="text-foreground">{min.toFixed(1)}</span> · High <span className="text-foreground">{max.toFixed(1)}</span>{allTime != null && <> · Baseline <span className="text-amber">{allTime.toFixed(2)}</span></>}</span>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
            <YAxis hide domain={[1, 5]} />
            {allTime != null && <ReferenceLine y={allTime} stroke="var(--amber)" strokeDasharray="2 4" strokeOpacity={0.7} />}
            <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "number" && series[l] ? format(new Date(series[l].date), "EEE d MMM") : String(l ?? ""))} valueFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} />} cursor={{ stroke: "var(--border-strong)" }} />
            <Line type="monotone" dataKey="avg_rating" name="Avg rating" stroke="var(--primary)" strokeWidth={1.5} dot={false} connectNulls activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI insights                                                         */
/* ------------------------------------------------------------------ */

const INSIGHT_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  complaint: { icon: TriangleAlert, tone: "text-warning", label: "Complaint" },
  praise: { icon: ThumbsUp, tone: "text-success", label: "Praise" },
  trend: { icon: TrendingDown, tone: "text-danger", label: "Trend" },
  recommendation: { icon: Lightbulb, tone: "text-primary", label: "Recommendation" },
};

export function InsightsCard({ insights, index }: { insights: Overview["insights"]; index?: string }) {
  return (
    <Card className="flex flex-col">
      <PanelHeader
        index={index}
        eyebrow="Intelligence"
        title={<span className="flex items-center gap-2"><Bot className="size-4 text-primary" /> AI insights</span>}
        description="Patterns found in your actual review text"
        action={<Link href="/app/ai-assistant" className="group rounded outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"><PanelLink>Assistant <ArrowUpRight className="size-3" /></PanelLink></Link>}
      />
      <div className="flex-1 p-5 pt-4">
        {!insights.length ? (
          <EmptyState compact icon={Sparkles} title="No insights yet" description="Insights appear once you have a handful of reviews to analyse." />
        ) : (
          <ol className="relative space-y-0">
            {insights.slice(0, 4).map((i, n) => {
              const s = INSIGHT_STYLE[i.kind] ?? INSIGHT_STYLE.recommendation;
              return (
                <li key={i.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
                  <span className="pt-0.5 font-mono text-[10.5px] text-subtle-foreground">{String(n + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                      <s.icon className={cn("size-3", s.tone)} />
                      <span className={s.tone}>{s.label}</span>
                      <span className="text-subtle-foreground">· {i.evidence_count} reviews</span>
                    </p>
                    <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">{i.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{i.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {insights[0] && (
        <p className="border-t border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
          Source · {insights[0].generated_by === "openai" ? "OpenAI" : "Offline analysis (no API key configured)"}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Recent reviews feed                                                 */
/* ------------------------------------------------------------------ */

export function RecentReviewsCard({ reviews, index }: { reviews: Overview["recent_reviews"]; index?: string }) {
  const { locations } = useOrg();
  const locName = (id: string) => locations.find((l) => l.id === id)?.name;
  return (
    <Card className="flex h-full flex-col">
      <PanelHeader
        index={index}
        eyebrow="Feed"
        title="Recent reviews"
        description="Latest feedback across your locations"
        action={<Link href="/app/reviews" className="group rounded outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"><PanelLink>Inbox <ArrowUpRight className="size-3" /></PanelLink></Link>}
      />
      <div className="flex-1 px-3 pb-3 pt-3">
        {!reviews.length ? (
          <EmptyState compact icon={MessageSquareText} title="No reviews yet" description="Connect Google or start collecting reviews with a QR code." action={<Button size="sm" asChild><Link href="/app/qr-codes">Create QR code</Link></Button>} />
        ) : (
          <ul>
            {reviews.map((r) => {
              const d = new Date(r.review_created_at);
              return (
                <li key={r.id}>
                  <Link
                    href={`/app/reviews?review=${r.id}`}
                    className="group grid grid-cols-[3px_minmax(0,1fr)_auto] gap-3 rounded-lg px-2 py-2.5 outline-none transition hover:bg-surface-hover/60 focus-visible:ring-[1.5px] focus-visible:ring-ring sm:grid-cols-[3px_74px_minmax(0,1fr)_auto]"
                  >
                    <span aria-hidden className={cn("w-[3px] self-stretch rounded-full", r.rating >= 4 ? "bg-success/60" : r.rating === 3 ? "bg-amber/70" : "bg-danger/80")} />
                    <span className="hidden pt-0.5 sm:block">
                      <MonoTime className="block" title={format(d, "d MMM yyyy, h:mm a")}>{format(d, "dd MMM")}</MonoTime>
                      <MonoTime className="block">{format(d, "HH:mm")}</MonoTime>
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-medium text-foreground">{r.reviewer_name ?? "Anonymous"}</span>
                        <Stars rating={r.rating} size={11} />
                        {r.source === "demo" && <Badge size="sm" variant="outline" mono>Demo</Badge>}
                      </span>
                      <span className={cn("mt-0.5 line-clamp-1 block text-[12.5px]", r.comment ? "text-foreground-soft" : "italic text-muted-foreground")}>{r.comment || "Rating only"}</span>
                      <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground">
                        {locName(r.location_id) ?? "—"} · {formatDistanceToNow(d, { addSuffix: true })}
                      </span>
                    </span>
                    <span className="pt-0.5"><StatusBadge status={r.response_status} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pending responses                                                   */
/* ------------------------------------------------------------------ */

export function PendingResponses({ pending, negative, loading, index }: { pending?: number; negative?: number; loading: boolean; index?: string }) {
  const urgent = (negative ?? 0) > 0;
  return (
    <Card className={cn("relative overflow-hidden", urgent && "border-[color-mix(in_oklab,var(--danger)_30%,var(--border))]")}>
      <PanelHeader index={index} eyebrow="Queue" title="Pending responses" description="Reviews still waiting for a reply" />
      <div className="p-5 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            {loading ? <Skeleton className="h-9 w-16" /> : (
              <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular"><AnimatedNumber value={pending ?? null} /></span>
            )}
            <p className={cn("mt-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em]", urgent ? "text-danger-foreground" : "text-subtle-foreground")}>
              <StatusDot tone={urgent ? "error" : "ok"} pulse={urgent} />
              {urgent ? `${negative} negative waiting` : "No negative backlog"}
            </p>
          </div>
          <Button size="sm" variant={urgent ? "primary" : "soft"} asChild>
            <Link href="/app/reviews?status=pending">Reply now <ArrowRight /></Link>
          </Button>
        </div>
        <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-muted-foreground">Replying within 24 hours shows customers you are listening.</p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

export function QuickActions({ index }: { index?: string }) {
  const { can } = useOrg();
  const actions = [
    { href: "/app/campaigns/new", label: "New campaign", sub: "WhatsApp · email · SMS", icon: Megaphone, show: can("campaigns.manage") },
    { href: "/app/qr-codes?new=1", label: "Generate QR", sub: "Printable table card", icon: QrCode, show: can("campaigns.manage") },
    { href: "/app/team", label: "Invite teammate", sub: "Roles & access", icon: UserPlus, show: can("team.manage") },
    { href: "/app/locations", label: "Add location", sub: "Branches & links", icon: MapPin, show: can("locations.manage") },
  ].filter((a) => a.show);
  if (!actions.length) return null;
  return (
    <Card>
      <PanelHeader index={index} eyebrow="Shortcuts" title="Quick actions" />
      <div className="grid grid-cols-2 gap-px overflow-hidden p-5 pt-4">
        <div className="col-span-2 grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="group relative rounded-lg border border-border bg-background-subtle/50 p-3 outline-none transition hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] hover:bg-surface-hover/60 focus-visible:ring-[1.5px] focus-visible:ring-ring">
              <a.icon className="size-4 text-muted-foreground transition group-hover:text-primary" />
              <ArrowUpRight className="absolute right-2.5 top-2.5 size-3 text-subtle-foreground opacity-0 transition group-hover:opacity-100" />
              <p className="mt-2.5 text-[13px] font-medium text-foreground">{a.label}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">{a.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Setup checklist (real state only)                                   */
/* ------------------------------------------------------------------ */

interface IntegrationsOverview { google: { status: string } }
interface SubCurrent { subscription: { status: string; provider: string | null } | null }

export function SetupChecklist() {
  const { orgId, locations, membership, can } = useOrg();
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    try {
      setHidden(localStorage.getItem(`rp_checklist_${orgId}`) === "hidden");
    } catch {}
  }, [orgId]);
  const integrations = useQuery({ queryKey: ["integrations", orgId], queryFn: () => api.get<IntegrationsOverview>("/integrations") });
  const qrs = useQuery({ queryKey: ["qr-codes", orgId, "all"], queryFn: () => api.get<unknown[]>("/qr-codes") });
  const campaigns = useQuery({ queryKey: ["campaigns", orgId, "checklist"], queryFn: () => api.get<{ total: number }>("/campaigns", { page_size: 1 }) });
  const team = useQuery({ queryKey: ["team", "members", orgId], queryFn: () => api.get<unknown[]>("/team/members") });
  const invites = useQuery({ queryKey: ["team", "invitations", orgId], queryFn: () => api.get<unknown[]>("/team/invitations") });
  const sub = useQuery({ queryKey: ["subscription", orgId], queryFn: () => api.get<SubCurrent>("/subscriptions/current") });

  if (hidden) return null;
  const loaded = integrations.data && qrs.data && campaigns.data && team.data && sub.data;
  if (!loaded) return null;
  const steps = [
    { done: locations.some((l) => l.effective_review_url), label: "Add a Google review link", href: "/app/locations" },
    { done: integrations.data!.google.status === "connected", label: "Connect Google Business Profile", href: "/app/integrations" },
    { done: qrs.data!.length > 0, label: "Create your first QR code", href: "/app/qr-codes?new=1" },
    { done: campaigns.data!.total > 0, label: "Launch a review campaign", href: "/app/campaigns/new" },
    { done: team.data!.length > 1 || (invites.data?.length ?? 0) > 0, label: "Invite your team", href: "/app/team" },
    { done: sub.data!.subscription?.status === "active", label: "Choose a plan", href: "/app/subscription" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(`rp_checklist_${orgId}`, "hidden");
    } catch {}
  };
  return (
    <Card className="relative overflow-hidden">
      <PanelHeader
        eyebrow="Commissioning"
        title="Finish setting up"
        action={can("settings.manage") ? (
          <button onClick={dismiss} className="rounded-md p-1 text-subtle-foreground transition hover:bg-muted hover:text-foreground" aria-label="Hide checklist"><X className="size-4" /></button>
        ) : undefined}
      />
      <div className="p-5 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" role="meter" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Setup progress">
            {steps.map((s, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-[2px]", s.done ? "bg-primary shadow-[0_0_8px_-1px_var(--primary)]" : "bg-border-strong")} />
            ))}
          </div>
          <span className="font-mono text-[11px] tabular text-muted-foreground">{done}/{steps.length}</span>
        </div>
        <ul className="mt-3.5 space-y-0.5">
          {steps.map((s, i) => (
            <li key={s.label}>
              <Link href={s.href} className={cn("group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[12.5px] outline-none transition hover:bg-surface-hover/60 focus-visible:ring-[1.5px] focus-visible:ring-ring", s.done ? "text-subtle-foreground" : "text-foreground")}>
                <span className="w-5 font-mono text-[10px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", s.done ? "border-transparent bg-primary-soft text-primary" : "border-border-strong")}>
                  {s.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cn("flex-1", s.done && "line-through decoration-border-strong")}>{s.label}</span>
                {!s.done && <ArrowRight className="size-3.5 text-subtle-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />}
              </Link>
            </li>
          ))}
        </ul>
        <p className="sr-only">{membership.organization.name} setup progress</p>
      </div>
    </Card>
  );
}
