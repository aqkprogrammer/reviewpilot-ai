"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownUp, Filter, Flag, MessageSquareReply, MessageSquareText, Search, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber, titleCase } from "@/lib/utils";
import { SENTIMENT_STYLE, TOPIC_LABELS, type Review } from "./types";

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

export function ReviewStatsStrip() {
  const { orgId, locationId } = useOrg();
  const q = useQuery({
    queryKey: ["reviews", "stats", orgId, locationId],
    queryFn: () => api.get<{ total: number; average_rating: number | null; pending: number; responded: number; negative_pending: number }>("/reviews/stats", { location_id: locationId }),
  });
  const s = q.data;
  const tiles = [
    { label: "Total reviews", value: formatNumber(s?.total), tone: "text-foreground" },
    { label: "Average rating", value: s?.average_rating?.toFixed(2) ?? "—", tone: "text-foreground", star: true },
    { label: "Awaiting reply", value: formatNumber(s?.pending), tone: "text-warning-foreground" },
    { label: "Negative, unanswered", value: formatNumber(s?.negative_pending), tone: s?.negative_pending ? "text-danger-foreground" : "text-foreground" },
    { label: "Responded", value: formatNumber(s?.responded), tone: "text-success-foreground" },
  ];
  return (
    <Card className="grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {tiles.map((t) => (
        <div key={t.label} className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground">{t.label}</p>
          {s ? (
            <p className={cn("mt-1 flex items-center gap-1 text-xl font-semibold tabular tracking-tight", t.tone)}>
              {t.value}
              {t.star && <Star className="size-4 fill-[#f5a524] text-[#f5a524]" />}
            </p>
          ) : (
            <Skeleton className="mt-2 h-6 w-16" />
          )}
        </div>
      ))}
    </Card>
  );
}

function FiltersPopover({ value, onChange }: { value: ReviewFilters; onChange: (f: ReviewFilters) => void }) {
  const active = value.rating.length + [value.sentiment, value.source, value.date_from, value.date_to].filter(Boolean).length;
  const toggleRating = (r: number) => onChange({ ...value, rating: value.rating.includes(r) ? value.rating.filter((x) => x !== r) : [...value.rating, r] });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="md">
          <Filter /> Filters
          {active > 0 && <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-semibold text-primary-foreground">{active}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Rating</p>
          <div className="flex gap-1.5">
            {[5, 4, 3, 2, 1].map((r) => (
              <button
                key={r}
                onClick={() => toggleRating(r)}
                aria-pressed={value.rating.includes(r)}
                className={cn("flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border text-[13px] font-medium transition", value.rating.includes(r) ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted")}
              >
                {r}<Star className="size-3 fill-[#f5a524] text-[#f5a524]" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sentiment</p>
            <Select value={value.sentiment || "all"} onValueChange={(v) => onChange({ ...value, sentiment: v === "all" ? "" : v })}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {["positive", "neutral", "mixed", "negative"].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Source</p>
            <Select value={value.source || "all"} onValueChange={(v) => onChange({ ...value, source: v === "all" ? "" : v })}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
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

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Awaiting reply" },
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
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Response status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={filters.status === t.value}
              onClick={() => setFilters({ ...filters, status: t.value })}
              className={cn("h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition", filters.status === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="min-w-[200px] flex-1 lg:max-w-xs">
            <Input leading={<Search />} placeholder="Search text or reviewer" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search reviews" />
          </div>
          <FiltersPopover value={filters} onChange={setFilters} />
          <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: v })}>
            <SelectTrigger className="w-[150px]" aria-label="Sort"><span className="flex items-center gap-2"><ArrowDownUp className="size-3.5 text-muted-foreground" /><SelectValue /></span></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="rating_low">Lowest rating</SelectItem>
              <SelectItem value="rating_high">Highest rating</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-5"><Skeleton className="size-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-32" /></div></div>
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
          {list.data.items.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="group flex w-full gap-4 px-5 py-4 text-left transition hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none">
                <div className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular", r.rating >= 4 ? "bg-success-soft text-success-foreground" : r.rating === 3 ? "bg-warning-soft text-warning-foreground" : "bg-danger-soft text-danger-foreground")}>
                  {r.rating}.0
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[13.5px] font-semibold">{r.reviewer_name ?? "Anonymous"}</span>
                    <Stars rating={r.rating} size={12} />
                    <span className="text-[12px] text-subtle-foreground">{formatDistanceToNow(new Date(r.review_created_at), { addSuffix: true })}</span>
                    {r.is_flagged && <Flag className="size-3.5 text-danger" aria-label="Flagged" />}
                  </div>
                  <p className={cn("mt-1 line-clamp-2 text-[13px] leading-relaxed", r.comment ? "text-foreground-soft" : "italic text-muted-foreground")}>{r.comment || "Rating only — no written review"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.location_name && <span className="text-[11.5px] text-muted-foreground">{r.location_name}</span>}
                    {r.sentiment && <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-medium capitalize", SENTIMENT_STYLE[r.sentiment])}>{r.sentiment}</span>}
                    {r.topics.slice(0, 3).map((t) => <Badge key={t} size="sm" variant="neutral">{TOPIC_LABELS[t] ?? titleCase(t)}</Badge>)}
                    {r.source === "demo" && <Badge size="sm" variant="outline">Demo</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={r.response_status} />
                  {r.response_status === "pending" && (
                    <span className="hidden items-center gap-1 text-[12px] font-medium text-primary opacity-0 transition group-hover:opacity-100 sm:inline-flex">
                      <MessageSquareReply className="size-3.5" /> Reply
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
    </Card>
  );
}
