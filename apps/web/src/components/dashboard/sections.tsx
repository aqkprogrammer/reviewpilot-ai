"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight, Bot, CheckCircle2, Circle, Lightbulb, MapPin, Megaphone, MessageSquareText, QrCode, Sparkles, ThumbsUp, TrendingDown, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { StatusBadge } from "@/components/app/status-badge";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { Overview } from "./types";

/** Abstract layered "orb" drawn in SVG — echoes the 3D sculpture in premium dashboards without images. */
function HeroOrb() {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="orb-a" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#7c3aed" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#3b1d8f" stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id="orb-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2563ff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="orb-c" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <circle cx="110" cy="110" r="74" fill="url(#orb-a)" />
      {[0, 30, 60, 90, 120, 150].map((r, i) => (
        <ellipse key={r} cx="110" cy="110" rx="92" ry={26 + (i % 3) * 6} fill="none" stroke={i % 2 ? "url(#orb-b)" : "url(#orb-c)"} strokeWidth={i % 2 ? 7 : 5} transform={`rotate(${r} 110 110)`} opacity={0.75} />
      ))}
      <circle cx="84" cy="80" r="16" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function HeroCard({ data, loading }: { data?: Overview; loading: boolean }) {
  const { me, membership } = useOrg();
  const first = me.user.full_name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const k = data?.kpis;
  const insight = data?.insights[0];
  const tiles = [
    { label: "New reviews", value: k ? formatNumber(k.new_reviews) : "—" },
    { label: "Avg rating", value: k?.period_average_rating?.toFixed(2) ?? "—" },
    { label: "Google clicks", value: k ? formatNumber(k.google_clicks) : "—" },
    { label: "QR scans", value: k ? formatNumber(k.qr_scans) : "—" },
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#5b3cf2_0%,#6a4cff_38%,#7c3aed_70%,#9333ea_100%)] p-6 text-white shadow-[0_20px_50px_-20px_rgb(91_60_242/0.7)] sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgb(255_255_255/0.18),transparent_45%)]" aria-hidden />
      <div className="absolute -bottom-24 -left-10 size-64 rounded-full bg-[#2563ff]/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-8 top-1/2 hidden size-[250px] -translate-y-1/2 animate-float md:block lg:-right-2" aria-hidden>
        <HeroOrb />
      </div>
      <div className="relative max-w-xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-white/75">{greeting}, {first}</p>
          {data?.is_demo && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/25">Demo data</span>}
        </div>
        <h2 className="mt-1.5 text-[22px] font-semibold leading-snug tracking-[-0.02em] sm:text-2xl">
          {loading || !k ? (
            <span className="inline-block h-7 w-72 animate-pulse rounded-md bg-white/15" />
          ) : (
            <>
              {membership.organization.name} is rated <span className="tabular">{k.average_rating?.toFixed(1) ?? "—"}★</span> across{" "}
              <span className="tabular">{formatNumber(k.total_reviews)}</span> reviews
            </>
          )}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              <p className="text-lg font-semibold tabular leading-tight">{t.value}</p>
              <p className="text-[11px] text-white/70">{t.label}</p>
            </div>
          ))}
        </div>
        {insight && (
          <Link href="/app/ai-assistant" className="group mt-4 flex items-start gap-2.5 rounded-xl bg-black/15 px-3.5 py-2.5 text-[12.5px] ring-1 ring-inset ring-white/10 transition hover:bg-black/25">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <span className="min-w-0 flex-1"><span className="font-semibold">AI insight:</span> {insight.title}</span>
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        )}
      </div>
    </div>
  );
}

const INSIGHT_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  complaint: { icon: TriangleAlert, chip: "bg-warning-soft text-warning-foreground" },
  praise: { icon: ThumbsUp, chip: "bg-success-soft text-success-foreground" },
  trend: { icon: TrendingDown, chip: "bg-danger-soft text-danger-foreground" },
  recommendation: { icon: Lightbulb, chip: "bg-primary-soft text-primary-soft-foreground" },
};

export function InsightsCard({ insights }: { insights: Overview["insights"] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><Bot className="size-4 text-primary" /> AI insights</CardTitle>
          <CardDescription>Patterns found in your actual review text</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild><Link href="/app/ai-assistant">Open assistant <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent className="flex-1">
        {!insights.length ? (
          <EmptyState compact icon={Sparkles} title="No insights yet" description="Insights appear once you have a handful of reviews to analyse." />
        ) : (
          <ul className="space-y-3">
            {insights.slice(0, 4).map((i) => {
              const s = INSIGHT_STYLE[i.kind] ?? INSIGHT_STYLE.recommendation;
              return (
                <li key={i.id} className="flex gap-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", s.chip)}><s.icon className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug">{i.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {insights[0] && (
          <p className="mt-4 text-[11px] text-subtle-foreground">Generated by {insights[0].generated_by === "openai" ? "OpenAI" : "offline analysis (no API key configured)"}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentReviewsCard({ reviews }: { reviews: Overview["recent_reviews"] }) {
  const { locations } = useOrg();
  const locName = (id: string) => locations.find((l) => l.id === id)?.name;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recent reviews</CardTitle>
          <CardDescription>Latest feedback across your locations</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild><Link href="/app/reviews">View all <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent className="pt-4">
        {!reviews.length ? (
          <EmptyState compact icon={MessageSquareText} title="No reviews yet" description="Connect Google or start collecting reviews with a QR code." action={<Button size="sm" asChild><Link href="/app/qr-codes">Create QR code</Link></Button>} />
        ) : (
          <ul className="-mx-2 space-y-1">
            {reviews.map((r) => (
              <li key={r.id}>
                <Link href={`/app/reviews?review=${r.id}`} className="flex gap-3 rounded-lg px-2 py-2.5 transition hover:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-medium">{r.reviewer_name ?? "Anonymous"}</span>
                      <Stars rating={r.rating} size={12} />
                      {r.source === "demo" && <Badge size="sm" variant="outline">Demo</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-muted-foreground">{r.comment || <em>Rating only</em>}</p>
                    <p className="mt-1 text-[11px] text-subtle-foreground">{locName(r.location_id)} · {formatDistanceToNow(new Date(r.review_created_at), { addSuffix: true })}</p>
                  </div>
                  <div className="shrink-0 pt-0.5"><StatusBadge status={r.response_status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function QuickActions() {
  const { can } = useOrg();
  const actions = [
    { href: "/app/campaigns/new", label: "New campaign", sub: "WhatsApp, email or SMS", icon: Megaphone, chip: "bg-primary-soft text-primary-soft-foreground", show: can("campaigns.manage") },
    { href: "/app/qr-codes?new=1", label: "Generate QR", sub: "Printable table card", icon: QrCode, chip: "bg-blue-soft text-blue", show: can("campaigns.manage") },
    { href: "/app/team", label: "Invite teammate", sub: "Roles & location access", icon: UserPlus, chip: "bg-purple-soft text-purple", show: can("team.manage") },
    { href: "/app/locations", label: "Add location", sub: "Branches & review links", icon: MapPin, chip: "bg-cyan-soft text-cyan", show: can("locations.manage") },
  ].filter((a) => a.show);
  if (!actions.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-2.5 pt-4">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="group rounded-xl border border-border p-3 transition hover:border-primary/30 hover:bg-primary-soft/30">
            <span className={cn("flex size-8 items-center justify-center rounded-lg", a.chip)}><a.icon className="size-4" /></span>
            <p className="mt-2.5 text-[13px] font-medium">{a.label}</p>
            <p className="text-[11.5px] text-muted-foreground">{a.sub}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

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
      <div className="absolute right-0 top-0 h-24 w-40 bg-[radial-gradient(circle_at_top_right,var(--primary-soft),transparent_70%)]" aria-hidden />
      <CardHeader>
        <div>
          <CardTitle>Finish setting up</CardTitle>
          <CardDescription>{done} of {steps.length} complete</CardDescription>
        </div>
        {can("settings.manage") && (
          <button onClick={dismiss} className="relative rounded-md p-1 text-subtle-foreground hover:bg-muted hover:text-foreground" aria-label="Hide checklist"><X className="size-4" /></button>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        <Progress value={(done / steps.length) * 100} className="mb-4" />
        <ul className="space-y-1">
          {steps.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-muted/60", s.done && "text-muted-foreground line-through decoration-border-strong")}>
                {s.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-border-strong" />}
                <span className="flex-1">{s.label}</span>
                {!s.done && <ArrowRight className="size-3.5 text-subtle-foreground" />}
              </Link>
            </li>
          ))}
        </ul>
        <p className="sr-only">{membership.organization.name} setup progress</p>
      </CardContent>
    </Card>
  );
}

export function CampaignsMini({ campaigns }: { campaigns: Overview["campaigns"] }) {
  return (
    <ul className="space-y-3">
      {campaigns.slice(0, 4).map((c) => (
        <li key={c.campaign_id}>
          <Link href={`/app/campaigns/${c.campaign_id}`} className="flex items-center gap-3 rounded-lg transition hover:opacity-80">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 text-[11.5px] capitalize text-muted-foreground">{c.channel} · {formatNumber(c.sent)} sent · {formatNumber(c.google_clicks)} Google clicks</p>
            </div>
            <span className="text-[13px] font-semibold tabular">{formatPercent(c.conversion_rate, 0)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
