"use client";
/**
 * Weekly digest — editorial "intelligence briefing" sections. Every figure comes from
 * GET /digest/preview; nothing here computes or invents numbers beyond formatting.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Cpu, FlaskConical, Info, MessageSquareQuote, Minus, Quote } from "lucide-react";
import { MeterBar, Panel, pad2 } from "@/components/console/kit";
import { HolographicPanel } from "@/components/intelligence";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { AnimatedNumber } from "@/components/ui/tech";
import { cn, formatNumber } from "@/lib/utils";
import type { Digest, DigestAction, DigestHighlight } from "./types";

/* ------------------------------------------------------------------ formatting */

type DeltaKind = "count" | "rating" | "rate";

export function formatDelta(v: number, kind: DeltaKind) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  const a = Math.abs(v);
  if (kind === "rating") return `${sign}${a.toFixed(1)}★`;
  if (kind === "rate") return `${sign}${Math.round(a * 100)} pts`;
  return `${sign}${formatNumber(a)}`;
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function DeltaChip({ value, kind, invert, className }: { value: number | null | undefined; kind: DeltaKind; invert?: boolean; className?: string }) {
  if (value == null) return <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground", className)}>No prior data</span>;
  const flat = value === 0 || (kind === "rating" && Math.abs(value) < 0.05) || (kind === "rate" && Math.abs(value) < 0.005);
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[4px] px-1 py-0.5 font-mono text-[10.5px] font-medium tabular",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {flat ? "No change" : formatDelta(value, kind)}
    </span>
  );
}

/* ------------------------------------------------------------------ masthead + narrative */

export function Masthead({ d }: { d: Digest }) {
  const ai = d.narrative.provider === "openai";
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-50 [mask-image:radial-gradient(ellipse_70%_90%_at_0%_0%,#000_10%,transparent_70%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">Briefing · {d.week.key}</span>
          <span aria-hidden className="h-px w-6 bg-border-strong" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground">{d.scope.label}</span>
          {d.is_demo && <Badge variant="amber" mono size="sm"><FlaskConical />Demo data</Badge>}
        </div>
        <h2 className="mt-4 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[32px]">
          {d.week.label}
          {d.week.is_partial && <span className="ml-2 align-middle font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-subtle-foreground">to date</span>}
        </h2>
        <blockquote className="mt-5 max-w-3xl border-l-2 border-primary pl-4 sm:pl-5">
          <p className="text-[16px] leading-[1.65] text-foreground-soft sm:text-[18px] sm:leading-[1.6] sm:tracking-[-0.01em]">{d.narrative.text}</p>
        </blockquote>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant={ai ? "primary" : "neutral"} mono size="sm">{ai ? <Bot /> : <Cpu />}{ai ? `OpenAI · ${d.narrative.model}` : "Offline heuristic"}</Badge>
          <span className="text-[12px] text-muted-foreground">{d.narrative.label}</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ actions (the one holographic visual) */

export function ActionsPanel({ actions, className }: { actions: DigestAction[]; className?: string }) {
  return (
    <HolographicPanel label="Recommended actions" status={`${actions.length} this week`} active className={cn("h-full", className)} as="section">
      <ol className="divide-y divide-[color-mix(in_oklab,var(--primary)_12%,var(--border))]">
        {actions.map((a, i) => {
          const body = (
            <>
              <span className="pt-0.5 font-mono text-[11px] tabular text-primary">{pad2(i + 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium leading-snug text-foreground">{a.title}</span>
                {a.detail && <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">{a.detail}</span>}
              </span>
              {a.link && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground transition-transform group-hover/act:translate-x-0.5 group-hover/act:text-primary" aria-hidden />}
            </>
          );
          return (
            <li key={`${a.kind}-${i}`}>
              {a.link ? (
                <Link href={a.link} className="group/act -mx-1 flex items-start gap-3 rounded-md px-1 py-3 outline-none transition-colors hover:bg-surface-hover/40 focus-visible:ring-[1.5px] focus-visible:ring-ring">{body}</Link>
              ) : (
                <div className="flex items-start gap-3 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </HolographicPanel>
  );
}

/* ------------------------------------------------------------------ KPI readouts */

function Kpi({ label, value, delta, footer, definition, accent }: { label: string; value: React.ReactNode; delta?: React.ReactNode; footer?: React.ReactNode; definition?: string; accent: string }) {
  return (
    <Card className="group card-hover p-5">
      <span aria-hidden className={cn("absolute inset-x-5 top-0 h-px bg-current opacity-40 transition-opacity group-hover:opacity-90", accent)} />
      <div className="flex items-center gap-1.5">
        <span className="micro-label">{label}</span>
        {definition && (
          <Tooltip content={definition}>
            <button type="button" aria-label={`About ${label}`} className="text-subtle-foreground transition hover:text-foreground"><Info className="size-3" /></button>
          </Tooltip>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.035em] tabular text-foreground">{value}</span>
        {delta}
      </div>
      {footer && <div className="mt-3 border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">{footer}</div>}
    </Card>
  );
}

export function KpiRow({ d }: { d: Digest }) {
  const r = d.reviews;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="New reviews" accent="text-primary" definition={d.definitions.new_reviews} value={<AnimatedNumber value={r.new} />} delta={<DeltaChip value={r.delta} kind="count" />} footer={<>Previous week {formatNumber(r.previous)}</>} />
      <Kpi
        label="Average rating" accent="text-amber" definition={d.definitions.average_rating}
        value={r.average_rating == null ? "—" : <AnimatedNumber value={r.average_rating} format={(n) => n.toFixed(2)} />}
        delta={r.average_rating == null ? undefined : <DeltaChip value={r.rating_delta} kind="rating" />}
        footer={<>Previous week {r.previous_average_rating == null ? "—" : `${r.previous_average_rating.toFixed(2)}★`}</>}
      />
      <Kpi
        label="Response rate" accent="text-mint" definition={d.definitions.response_rate}
        value={r.response_rate == null ? "—" : <AnimatedNumber value={r.response_rate} format={(n) => `${Math.round(n * 100)}%`} />}
        delta={r.response_rate == null ? undefined : <DeltaChip value={r.response_rate_delta} kind="rate" />}
        footer={<>{formatNumber(r.responded)} of {formatNumber(r.new)} replied</>}
      />
      <Kpi label="Awaiting reply" accent="text-ice" definition={d.definitions.pending_replies} value={<AnimatedNumber value={r.pending_replies} />} footer={<>{formatNumber(r.backlog)} in total backlog</>} />
    </div>
  );
}

/* ------------------------------------------------------------------ rating mix + themes */

export function RatingMix({ d }: { d: Digest }) {
  const mix = d.reviews.rating_mix;
  const max = Math.max(1, ...mix.map((m) => m.count));
  return (
    <Panel index="02" label="Distribution" title="Rating mix" description={`${formatNumber(d.reviews.new)} reviews this week`} className="h-full">
      {d.reviews.new === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">No reviews this week.</p>
      ) : (
        <ul className="space-y-3" aria-label="Rating mix">
          {mix.map((m) => (
            <li key={m.rating} className="grid grid-cols-[34px_1fr_72px] items-center gap-3">
              <span className="font-mono text-[12px] tabular text-foreground-soft">{m.rating}★</span>
              <MeterBar value={m.count} max={max} tone={m.rating >= 4 ? "primary" : m.rating === 3 ? "amber" : "danger"} className="h-1.5" label={`${m.rating} star: ${m.count} reviews`} />
              <span className="text-right font-mono text-[11.5px] tabular text-muted-foreground">{m.count} · {Math.round(m.share * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Themes({ d }: { d: Digest }) {
  const max = Math.max(1, ...d.themes.map((t) => t.mentions));
  const source = { tagged: "Tagged topics", keyword: "Detected from review text", mixed: "Tagged + detected from text", none: "No topics" }[d.themes_source];
  return (
    <Panel index="03" label="Signal" title="Top themes" description={source} className="h-full" bodyClassName="pt-3">
      {d.themes.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">No recurring themes detected this week.</p>
      ) : (
        <ul className="divide-y divide-border" aria-label="Top themes">
          {d.themes.map((t) => (
            <li key={t.topic} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5">
              <span className="truncate text-[13.5px] font-medium first-letter:uppercase">{t.label}</span>
              <span className="font-mono text-[11.5px] tabular text-muted-foreground">
                {t.mentions} mention{t.mentions === 1 ? "" : "s"} · {t.avg_rating.toFixed(1)}★
              </span>
              <div className="col-span-2 flex items-center gap-3">
                <MeterBar value={t.mentions} max={max} tone={t.negative > t.positive ? "amber" : "primary"} className="h-1" />
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground">
                  <span className="text-mint">{t.positive}+</span> / <span className="text-amber">{t.negative}−</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ voices */

function Excerpt({ h, tone }: { h: DigestHighlight; tone: "praise" | "complaint" }) {
  return (
    <figure className={cn("relative rounded-lg border bg-background-subtle/60 p-4 pl-5 before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-full", tone === "praise" ? "border-border before:bg-mint" : "border-border before:bg-amber")}>
      <Quote className={cn("absolute right-3 top-3 size-4 opacity-30", tone === "praise" ? "text-mint" : "text-amber")} aria-hidden />
      <blockquote className="pr-6 text-[14px] leading-relaxed text-foreground-soft">“{h.excerpt}”</blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
        <span className="text-foreground-soft normal-case tracking-normal">{h.reviewer}</span>
        <Stars rating={h.rating} size={11} />
        <span>{new Date(`${h.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        {h.location_name && <span className="truncate">· {h.location_name}</span>}
      </figcaption>
    </figure>
  );
}

export function Voices({ d }: { d: Digest }) {
  const cols: { key: "praise" | "complaints"; title: string; empty: string; tone: "praise" | "complaint"; index: string }[] = [
    { key: "praise", title: "What customers praised", empty: "No written praise this week.", tone: "praise", index: "04" },
    { key: "complaints", title: "What needs attention", empty: "No written complaints this week.", tone: "complaint", index: "05" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cols.map((c) => (
        <Panel key={c.key} index={c.index} label="Voice of customer" title={c.title} icon={MessageSquareQuote} description="Excerpts from this week's reviews · first name and initial only">
          <div className="space-y-3">
            {d.highlights[c.key].length === 0 ? <p className="py-4 text-[13px] text-muted-foreground">{c.empty}</p> : d.highlights[c.key].map((h) => <Excerpt key={h.review_id} h={h} tone={c.tone} />)}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ operations */

function Stat({ label, value, sub, tone }: { label: string; value: number | string; sub?: React.ReactNode; tone?: "danger" | "ok" }) {
  return (
    <div className="min-w-0 bg-background-subtle px-4 py-3.5">
      <dt className="micro-label truncate">{label}</dt>
      <dd className={cn("mt-1.5 font-mono text-[20px] font-medium leading-none tabular", tone === "danger" ? "text-danger-foreground" : tone === "ok" ? "text-success-foreground" : "text-foreground")}>{value}</dd>
      {sub && <dd className="mt-1.5 truncate text-[11.5px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

export function Operations({ d }: { d: Digest }) {
  const { recovery: rc, requests: rq, automation: au, qr } = d;
  const groups = [
    {
      title: "Service recovery", href: "/app/recovery", definition: d.definitions.recovery,
      stats: [
        { label: "Opened", value: rc.opened, sub: `Prev. week ${rc.previous_opened}` },
        { label: "Resolved", value: rc.resolved, tone: rc.resolved ? ("ok" as const) : undefined },
        { label: "Past deadline", value: rc.breached, tone: rc.breached ? ("danger" as const) : undefined },
        { label: "Open now", value: rc.open_now },
      ],
    },
    {
      title: "Review requests", href: "/app/review-requests", definition: d.definitions.google_clicks,
      stats: [
        { label: "Sent", value: rq.sent, sub: `Prev. week ${rq.previous_sent}` },
        { label: "Google clicks", value: rq.google_clicks, sub: `Prev. week ${rq.previous_google_clicks}` },
        { label: "Click-through", value: pct(rq.click_rate) },
        { label: "QR scans", value: qr.scans, sub: `Prev. week ${qr.previous_scans}` },
      ],
    },
    {
      title: "Post-visit automation", href: "/app/automations", definition: d.definitions.visits,
      stats: [
        { label: "Visits received", value: au.visits, sub: `Prev. week ${au.previous_visits}` },
        { label: "Requests sent", value: au.requests_sent },
        { label: "Skipped", value: au.skipped, sub: au.failed ? `${au.failed} failed` : undefined },
        { label: "Active rules", value: au.active_rules },
      ],
    },
  ];
  return (
    <Panel index="06" label="Operations" title="Recovery, requests & automation" description="Activity recorded during the week" bodyClassName="space-y-5">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground-soft">
              {g.title}
              <Tooltip content={g.definition}><button type="button" aria-label={`About ${g.title}`} className="text-subtle-foreground hover:text-foreground"><Info className="size-3" /></button></Tooltip>
            </p>
            <Link href={g.href} className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground underline-offset-4 hover:text-primary hover:underline">Open</Link>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            {g.stats.map((s) => <Stat key={s.label} {...s} />)}
          </dl>
        </section>
      ))}
    </Panel>
  );
}

/* ------------------------------------------------------------------ locations */

export function LocationsTable({ d }: { d: Digest }) {
  if (d.locations.length < 2) return null;
  return (
    <Panel index="07" label="Per location" title="Location breakdown" flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-background-subtle/60 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
              <th scope="col" className="px-5 py-2.5 font-normal">Location</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">New</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Rating</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Replied</th>
              <th scope="col" className="px-5 py-2.5 text-right font-normal">Awaiting</th>
            </tr>
          </thead>
          <tbody>
            {d.locations.map((l) => (
              <tr key={l.location_id} className="border-b border-border last:border-0 hover:bg-surface-hover/40">
                <th scope="row" className="px-5 py-3 text-left font-medium">{l.name}</th>
                <td className="px-3 py-3 text-right font-mono tabular">{l.new_reviews}<span className="ml-1.5 text-[11px] text-subtle-foreground">/ {l.previous_new_reviews}</span></td>
                <td className="px-3 py-3 text-right font-mono tabular">
                  {l.average_rating == null ? "—" : `${l.average_rating.toFixed(1)}★`}
                  {l.average_rating != null && l.rating_delta != null && <DeltaChip value={l.rating_delta} kind="rating" className="ml-2" />}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular">{pct(l.response_rate)}</td>
                <td className={cn("px-5 py-3 text-right font-mono tabular", l.pending_replies ? "text-warning-foreground" : "text-muted-foreground")}>{l.pending_replies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">New = this week / previous week</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ skeleton */

export function DigestSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading digest">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-60 rounded-xl" /><Skeleton className="h-60 rounded-xl" /></div>
    </div>
  );
}

