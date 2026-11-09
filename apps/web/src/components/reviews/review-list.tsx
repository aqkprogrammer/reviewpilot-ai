"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowDownUp, CornerDownLeft, Flag, MessageSquareText, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { AnimatedNumber, SegmentMeter, StatusDot } from "@/components/ui/tech";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { SENTIMENT_VARIANT, TOPIC_LABELS, ratingTone, type Review } from "./types";

export interface ReviewFilters {
  q: string;
  rating: number[];
  status: string;
  sentiment: string;
  source: string;
  date_from: string;
  date_to: string;
  sort: string;
}

export const EMPTY_FILTERS: ReviewFilters = { q: "", rating: [], status: "", sentiment: "", source: "", date_from: "", date_to: "", sort: "newest" };

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

interface Stats { total: number; average_rating: number | null; pending: number; responded: number; negative_pending: number }

export function ReviewStatsStrip() {
  const { orgId, locationId } = useOrg();
  const q = useQuery({
    queryKey: ["reviews", "stats", orgId, locationId],
    queryFn: () => api.get<Stats>("/reviews/stats", { location_id: locationId }),
  });
  const s = q.data;
  const coverage = s && s.total ? s.responded / s.total : 0;
  const int = (n: number) => formatNumber(Math.round(n));
  const cells: { label: string; node: React.ReactNode; sub?: React.ReactNode; tone?: string }[] = [
    { label: "Total reviews", node: <AnimatedNumber value={s?.total} format={int} />, sub: "All sources" },
    {
      label: "Average rating",
      node: <span className="inline-flex items-center gap-1.5"><AnimatedNumber value={s?.average_rating} format={(n) => n.toFixed(2)} /><Star className="size-4 fill-amber text-amber" aria-hidden /></span>,
      sub: s?.average_rating != null ? <Stars rating={s.average_rating} size={10} /> : "—",
    },
    { label: "Awaiting reply", node: <AnimatedNumber value={s?.pending} format={int} />, tone: s?.pending ? "text-warning-foreground" : undefined, sub: <span className="inline-flex items-center gap-1.5"><StatusDot tone={s?.pending ? "warn" : "ok"} /> {s?.pending ? "Queue open" : "Inbox zero"}</span> },
    { label: "Negative · unanswered", node: <AnimatedNumber value={s?.negative_pending} format={int} />, tone: s?.negative_pending ? "text-danger-foreground" : undefined, sub: <span className="inline-flex items-center gap-1.5"><StatusDot tone={s?.negative_pending ? "error" : "ok"} pulse={!!s?.negative_pending} /> {s?.negative_pending ? "Needs attention" : "Clear"}</span> },
    { label: "Response coverage", node: <AnimatedNumber value={coverage * 100} format={(n) => `${n.toFixed(0)}%`} />, sub: <SegmentMeter value={coverage * 100} segments={14} tone={coverage >= 0.7 ? "success" : coverage >= 0.4 ? "warning" : "danger"} /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c, i) => (
        <div key={c.label} className={cn("bg-card px-5 py-4", i === 4 && "col-span-2 lg:col-span-1")}>
          <p className="micro-label">{c.label}</p>
          {s ? (
            <>
              <p className={cn("mt-2 text-[24px] font-semibold leading-none tracking-[-0.035em] tabular text-foreground", c.tone)}>{c.node}</p>
              <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{c.sub}</div>
            </>
          ) : (
            <Skeleton className="mt-2 h-7 w-16" />
          )}
        </div>
      ))}
    </div>
  );
}

function FiltersPopover({ value, onChange }: { value: ReviewFilters; onChange: (f: ReviewFilters) => void }) {
  const active = value.rating.length + [value.sentiment, value.source, value.date_from, value.date_to].filter(Boolean).length;
  const toggleRating = (r: number) => onChange({ ...value, rating: value.rating.includes(r) ? value.rating.filter((x) => x !== r) : [...value.rating, r] });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="md" className={cn(active > 0 && "border-[color-mix(in_oklab,var(--primary)_45%,var(--border-strong))]")}>
          <SlidersHorizontal /> Filters
          {active > 0 && <span className="rounded-[4px] bg-primary px-1.5 font-mono text-[10.5px] font-semibold text-primary-foreground">{active}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] space-y-4 p-4">
        <p className="micro-label">Filter parameters</p>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Rating</p>
          <div className="flex gap-1.5" role="group" aria-label="Rating">
            {[5, 4, 3, 2, 1].map((r) => (
              <button
                key={r}
                onClick={() => toggleRating(r)}
                aria-pressed={value.rating.includes(r)}
                className={cn("flex h-8 flex-1 items-center justify-center gap-1 rounded-md border font-mono text-[12px] transition", value.rating.includes(r) ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] bg-primary-soft text-primary-soft-foreground" : "border-border text-foreground-soft hover:bg-surface-hover")}
              >
                {r}<Star className="size-3 fill-amber text-amber" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sentiment</p>
            <Select value={value.sentiment || "all"} onValueChange={(v) => onChange({ ...value, sentiment: v === "all" ? "" : v })}>
              <SelectTrigger size="sm" aria-label="Sentiment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {["positive", "neutral", "mixed", "negative"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Source</p>
            <Select value={value.source || "all"} onValueChange={(v) => onChange({ ...value, source: v === "all" ? "" : v })}>
              <SelectTrigger size="sm" aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="demo">Demo data</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Date range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="From" value={value.date_from} max={value.date_to || undefined} onChange={(e) => onChange({ ...value, date_from: e.target.value })} className="h-8 text-[13px]" />
            <Input type="date" aria-label="To" value={value.date_to} min={value.date_from || undefined} onChange={(e) => onChange({ ...value, date_to: e.target.value })} className="h-8 text-[13px]" />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q, status: value.status, sort: value.sort })} disabled={!active}>
          Clear filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ActiveChips({ value, onChange }: { value: ReviewFilters; onChange: (f: ReviewFilters) => void }) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  value.rating.forEach((r) => chips.push({ key: `r${r}`, label: `${r}★`, clear: () => onChange({ ...value, rating: value.rating.filter((x) => x !== r) }) }));
  if (value.sentiment) chips.push({ key: "s", label: value.sentiment, clear: () => onChange({ ...value, sentiment: "" }) });
  if (value.source) chips.push({ key: "src", label: value.source === "demo" ? "Demo data" : "Google", clear: () => onChange({ ...value, source: "" }) });
  if (value.date_from) chips.push({ key: "df", label: `From ${value.date_from}`, clear: () => onChange({ ...value, date_from: "" }) });
  if (value.date_to) chips.push({ key: "dt", label: `To ${value.date_to}`, clear: () => onChange({ ...value, date_to: "" }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-background-subtle/40 px-4 py-2">
      <span className="micro-label mr-1">Active</span>
      {chips.map((c) => (
        <button key={c.key} onClick={c.clear} className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft px-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-primary-soft-foreground transition hover:border-primary" aria-label={`Remove filter ${c.label}`}>
          {c.label}<X className="size-3" />
        </button>
      ))}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Awaiting" },
  { value: "responded", label: "Responded" },
  { value: "handled", label: "Handled" },
];

export function ReviewList({ filters, setFilters, onOpen }: { filters: ReviewFilters; setFilters: (f: ReviewFilters) => void; onOpen: (id: string) => void }) {
  const { orgId, locationId } = useOrg();
  const [page, setPage] = React.useState(1);
  const q = useDebounced(filters.q);
  const params = { ...filters, q };
  React.useEffect(() => setPage(1), [JSON.stringify(params), locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useQuery({
    queryKey: ["reviews", "list", orgId, locationId, params, page],
    queryFn: () =>
      api.get<{ items: Review[]; total: number; page: number; pages: number; page_size: number }>("/reviews", {
        page, page_size: 15, q: params.q, rating: params.rating.map(String), status: params.status, sentiment: params.sentiment, source: params.source,
        date_from: params.date_from, date_to: params.date_to, sort: params.sort, location_id: locationId,
      }),
    placeholderData: (prev) => prev,
  });

  const hasFilters = JSON.stringify({ ...filters, sort: "newest" }) !== JSON.stringify({ ...EMPTY_FILTERS });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 xl:flex-row xl:items-center">
        <Segmented id="review-status" ariaLabel="Response status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={STATUS_OPTIONS} />
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <div className="min-w-[180px] flex-1 xl:max-w-xs">
            <Input leading={<Search />} placeholder="Search text or reviewer" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search reviews" />
          </div>
          <FiltersPopover value={filters} onChange={setFilters} />
          <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v })}>
            <SelectTrigger className="w-[156px]" aria-label="Sort"><span className="flex items-center gap-2"><ArrowDownUp className="size-3.5 text-muted-foreground" /><SelectValue /></span></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="rating_low">Lowest rating</SelectItem>
              <SelectItem value="rating_high">Highest rating</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <ActiveChips value={filters} onChange={setFilters} />

      <div className="hidden grid-cols-[3px_64px_minmax(0,1fr)_130px] gap-4 border-b border-border bg-background-subtle/60 px-5 py-2 md:grid">
        <span />
        <span className="micro-label !text-[10px]">Rating</span>
        <span className="micro-label !text-[10px]">Review</span>
        <span className="micro-label !text-[10px] text-right">Status</span>
      </div>

      {list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-5"><Skeleton className="h-10 w-14" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-32" /></div></div>
          ))}
        </div>
      ) : !list.data?.items.length ? (
        <EmptyState
          icon={MessageSquareText}
          title={hasFilters ? "No reviews match these filters" : "No reviews yet"}
          description={hasFilters ? "Try widening the date range or clearing filters." : "Reviews appear here once Google Business Profile syncs, or start collecting with a QR code."}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}><X /> Clear filters</Button> : undefined}
        />
      ) : (
        <ul className={cn("divide-y divide-border transition-opacity", list.isFetching && "opacity-70")}>
          {list.data.items.map((r) => {
            const tone = ratingTone(r.rating);
            const d = new Date(r.review_created_at);
            return (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.id)}
                  className="group grid w-full grid-cols-[3px_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-4 text-left transition hover:bg-surface-hover/50 focus-visible:bg-surface-hover/60 focus-visible:outline-none sm:px-5 md:grid-cols-[3px_64px_minmax(0,1fr)_130px]"
                >
                  <span aria-hidden className={cn("row-span-2 w-[3px] self-stretch rounded-full opacity-80 transition group-hover:opacity-100 md:row-span-1", tone.rail)} />
                  <div className="hidden md:block">
                    <p className={cn("font-mono text-[20px] font-medium leading-none tabular", tone.text)}>{r.rating}.0</p>
                    <Stars rating={r.rating} size={9} className="mt-1.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-[13.5px] font-semibold text-foreground">{r.reviewer_name ?? "Anonymous"}</span>
                      <Stars rating={r.rating} size={11} className="md:hidden" />
                      <MonoTime title={format(d, "d MMM yyyy, h:mm a")}>{format(d, "dd MMM yyyy · HH:mm")}</MonoTime>
                      <span className="text-[11.5px] text-subtle-foreground">· {formatDistanceToNow(d, { addSuffix: true })}</span>
                      {r.is_flagged && <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-danger-foreground"><Flag className="size-3" aria-hidden /> Flagged</span>}
                    </div>
                    <p className={cn("mt-1 line-clamp-2 text-[13px] leading-relaxed", r.comment ? "text-foreground-soft" : "italic text-muted-foreground")}>{r.comment || "Rating only — no written review"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {r.location_name && <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground">{r.location_name}</span>}
                      {r.sentiment && <Badge size="sm" variant={SENTIMENT_VARIANT[r.sentiment] ?? "neutral"} dot className="capitalize">{r.sentiment}</Badge>}
                      {r.topics.slice(0, 3).map((t) => <Badge key={t} size="sm" variant="outline">{TOPIC_LABELS[t] ?? titleCase(t)}</Badge>)}
                      {r.source === "demo" && <Badge size="sm" variant="amber" mono>Demo</Badge>}
                    </div>
                  </div>
                  <div className="col-start-2 flex items-center justify-between gap-2 md:col-start-auto md:flex-col md:items-end md:justify-start">
                    <StatusBadge status={r.response_status} />
                    {r.response_status === "pending" && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                        Reply <CornerDownLeft className="size-3" />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
    </Card>
  );
}
