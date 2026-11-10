"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { HeartHandshake, Search } from "lucide-react";
import { FilterChip } from "@/components/console/kit";
import { MonoTime, Segmented } from "@/components/dashboard/kit";
import { Pagination } from "@/components/app/pagination";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Stars } from "@/components/ui/stars";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AssigneeSelect, useAssignees } from "./assignee-select";
import { CaseStatusBadge, SeverityBadge, SlaClock } from "./sla";
import { SEVERITY, type CaseItem, type PageData, type Summary } from "./types";

export interface QueueFilters {
  status: "active" | "breached" | "resolved" | "all";
  severity: string;
  location: string;
  assignee: string;
  sort: "due" | "newest" | "severity";
  q: string;
}
/** Short row label: the customer for review/feedback cases, the title for manual ones. */
function caseLabel(c: CaseItem) {
  if (c.source === "manual") return c.title;
  return c.customer_name ?? (c.source === "review" ? "Anonymous reviewer" : "Anonymous customer");
}

export const DEFAULT_FILTERS: QueueFilters = { status: "active", severity: "all", location: "all", assignee: "all", sort: "due", q: "" };

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function CaseQueue({
  filters, setFilters, summary, onOpen, selectedId,
}: {
  filters: QueueFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueueFilters>>;
  summary?: Summary;
  onOpen: (id: string) => void;
  selectedId: string | null;
}) {
  const { orgId, locations, can } = useOrg();
  const canAct = can("reviews.reply");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(filters.q);
  const set = <K extends keyof QueueFilters>(k: K, v: QueueFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const people = useAssignees();
  const query = useQuery({
    queryKey: ["recovery", "cases", orgId, { ...filters, q: dq, page }],
    queryFn: () =>
      api.get<PageData<CaseItem>>("/recovery", {
        status: filters.status,
        severity: filters.severity === "all" ? undefined : filters.severity,
        location_id: filters.location === "all" ? undefined : filters.location,
        assignee: filters.assignee === "all" ? undefined : filters.assignee,
        sort: filters.sort,
        q: dq || undefined,
        page,
        page_size: 20,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const data = query.data;
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "Location";
  const personName = (id: string) => (id === "me" ? "Assigned to me" : id === "unassigned" ? "Unassigned" : people.data?.find((p) => p.user_id === id)?.full_name ?? "Assignee");

  const chips = [
    filters.severity !== "all" && { key: "sev", label: `Severity · ${SEVERITY[filters.severity as keyof typeof SEVERITY]?.label}`, clear: () => set("severity", "all") },
    filters.location !== "all" && { key: "loc", label: locName(filters.location), clear: () => set("location", "all") },
    filters.assignee !== "all" && { key: "as", label: personName(filters.assignee), clear: () => set("assignee", "all") },
    dq && { key: "q", label: `“${dq}”`, clear: () => set("q", "") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            id="recovery-status"
            ariaLabel="Case status"
            value={filters.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "active", label: "Active", count: summary?.open },
              { value: "breached", label: "Breached", count: summary?.breached },
              { value: "resolved", label: "Resolved" },
              { value: "all", label: "All" },
            ]}
          />
          <div className="w-full lg:max-w-xs">
            <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search cases, customers…" leading={<Search />} aria-label="Search cases" className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={filters.severity} onValueChange={(v) => set("severity", v)}>
            <SelectTrigger size="sm" className="sm:w-[150px]" aria-label="Severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.location} onValueChange={(v) => set("location", v)}>
            <SelectTrigger size="sm" className="sm:w-[180px]" aria-label="Location"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.assignee} onValueChange={(v) => set("assignee", v)}>
            <SelectTrigger size="sm" className="sm:w-[170px]" aria-label="Assignee filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(people.data ?? []).filter((p) => !p.is_you).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => set("sort", v as QueueFilters["sort"])}>
            <SelectTrigger size="sm" className="sm:ml-auto sm:w-[160px]" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due">Sort · Due soonest</SelectItem>
              <SelectItem value="severity">Sort · Severity</SelectItem>
              <SelectItem value="newest">Sort · Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((c) => <FilterChip key={c.key} label={c.label} onClear={c.clear} />)}
            <button type="button" className="ml-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground" onClick={() => { setFilters((f) => ({ ...DEFAULT_FILTERS, status: f.status, sort: f.sort })); setPage(1); }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {query.isError ? (
        <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading cases">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={HeartHandshake}
          title={chips.length || filters.status !== "active" ? "No cases match these filters" : "No open recovery cases"}
          description={chips.length || filters.status !== "active"
            ? "Try a different status or clear the filters."
            : "Cases open automatically for low-rated Google reviews and negative private feedback, so your team can follow up quickly."}
        />
      ) : (
        <>
          {/* Desktop / tablet: queue table */}
          <div className={cn("hidden md:block", query.isFetching && "opacity-80")}>
            <Table className="table-fixed">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[124px]">SLA</TH>
                  <TH className="hidden w-[100px] lg:table-cell">Severity</TH>
                  <TH>Case</TH>
                  <TH className="w-[124px]">Status</TH>
                  <TH className="w-[184px]">Assignee</TH>
                  <TH className="hidden w-[100px] xl:table-cell">Opened</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((c) => (
                  <TR
                    key={c.id}
                    data-state={selectedId === c.id ? "selected" : undefined}
                    className="group relative cursor-pointer"
                    onClick={() => onOpen(c.id)}
                  >
                    <TD className="relative">
                      <span aria-hidden className={cn("absolute inset-y-2 left-0 w-[2px] rounded-full", SEVERITY[c.severity].rail, c.status === "resolved" || c.status === "closed" ? "opacity-30" : "")} />
                      <SlaClock c={c} />
                    </TD>
                    <TD className="hidden lg:table-cell"><SeverityBadge severity={c.severity} /></TD>
                    <TD className="min-w-0">
                      <button
                        type="button"
                        className="block w-full min-w-0 text-left outline-none focus-visible:rounded-sm focus-visible:ring-[1.5px] focus-visible:ring-ring"
                        onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}
                        aria-label={`Open case: ${c.title}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="lg:hidden"><SeverityBadge severity={c.severity} /></span>
                          {c.rating != null && <Stars rating={c.rating} size={10} className="shrink-0" />}
                          <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{caseLabel(c)}</span>
                          {c.location_name && <span className="hidden min-w-0 shrink truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground xl:inline">· {c.location_name}</span>}
                          {c.is_demo && <Badge size="sm" variant="amber" mono className="shrink-0">Demo</Badge>}
                        </span>
                        {c.summary && <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{c.summary}</span>}
                      </button>
                    </TD>
                    <TD><CaseStatusBadge status={c.status} /></TD>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <AssigneeSelect caseId={c.id} locationId={c.location_id} assigneeId={c.assignee_id} assigneeName={c.assignee_name} canAct={canAct && c.status !== "resolved" && c.status !== "closed"} />
                    </TD>
                    <TD className="hidden xl:table-cell">
                      <MonoTime className="block text-foreground-soft" title={format(new Date(c.created_at), "dd MMM yyyy · HH:mm")}>{format(new Date(c.created_at), "dd MMM")}</MonoTime>
                      <MonoTime className="block">{formatDistanceToNowStrict(new Date(c.created_at))} ago</MonoTime>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Phone: stacked incident cards */}
          <ul className={cn("divide-y divide-border md:hidden", query.isFetching && "opacity-80")}>
            {data.items.map((c) => (
              <li key={c.id} className="relative">
                <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[2px] rounded-full", SEVERITY[c.severity].rail)} />
                <button type="button" onClick={() => onOpen(c.id)} className="block w-full px-4 py-3.5 text-left outline-none focus-visible:bg-surface-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SeverityBadge severity={c.severity} />
                      <CaseStatusBadge status={c.status} />
                      {c.is_demo && <Badge size="sm" variant="amber" mono>Demo</Badge>}
                    </div>
                    <SlaClock c={c} className="items-end text-right" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13.5px] font-medium text-foreground">{c.title}</p>
                  {c.summary && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">{c.summary}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground">
                    {c.rating != null && <Stars rating={c.rating} size={10} />}
                    <span>{c.assignee_name ?? "Unassigned"}</span>
                    <span>{formatDistanceToNowStrict(new Date(c.created_at))} ago</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
