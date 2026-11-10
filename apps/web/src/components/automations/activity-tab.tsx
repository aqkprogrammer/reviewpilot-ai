"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, MousePointerClick, Search } from "lucide-react";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { MeterBar, Panel } from "@/components/console/kit";
import { Segmented } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, formatNumber } from "@/lib/utils";
import { CHANNEL_LABELS, SKIP_LABELS, SOURCE_LABELS, type Summary, type VisitRow, automationKeys, fmtDateTime, fmtRelative } from "./types";

type StatusFilter = "all" | "scheduled" | "sent" | "skipped" | "failed";
interface PageOut { items: VisitRow[]; total: number; page: number; pages: number; page_size: number }

function reasonText(v: VisitRow) {
  if (!v.skip_reason) return null;
  return SKIP_LABELS[v.skip_reason] ?? v.skip_label ?? v.skip_reason;
}

function Outcome({ v }: { v: VisitRow }) {
  const reason = reasonText(v);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={v.status === "processing" ? "in_progress" : v.status} />
        {v.google_clicked_at && (
          <Tooltip content="Customer clicked “Review on Google” — intent, not a confirmed review">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber"><MousePointerClick className="size-3" />Google</span>
          </Tooltip>
        )}
      </div>
      {reason && <p className={cn("mt-1 max-w-[240px] text-[11.5px] leading-snug", v.status === "failed" ? "text-danger-foreground" : "text-muted-foreground")}>{reason}</p>}
      {v.status === "scheduled" && v.scheduled_for && <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ice">Sends {fmtRelative(v.scheduled_for)}</p>}
    </div>
  );
}

function SkipBreakdown({ summary }: { summary?: Summary }) {
  const rows = summary?.skipped_by_reason ?? [];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel index="01" label={`Not sent · ${summary?.window_days ?? 7}d`} title="Why visits didn't become requests" description="Every skip has a reason — consent and opt-outs are never bypassed.">
      {!summary ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6" />)}</div>
      ) : !rows.length ? (
        <p className="text-[12.5px] text-muted-foreground">Nothing skipped or failed in this window.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.reason}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
                <span className="truncate text-foreground-soft">{SKIP_LABELS[r.reason] ?? r.label}</span>
                <span className="font-mono tabular text-foreground">{formatNumber(r.count)}</span>
              </div>
              <MeterBar value={r.count} max={max} tone={["no_consent", "opted_out", "cooldown"].includes(r.reason) ? "muted" : r.reason.includes("channel") || r.reason === "not_in_plan" ? "amber" : "danger"} label={`${r.label}: ${r.count}`} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ActivityTab({ summary }: { summary?: Summary }) {
  const { orgId } = useOrg();
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [source, setSource] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: automationKeys.visits(orgId, status, source, q, page),
    queryFn: () => api.get<PageOut>("/automations/visits", { page, page_size: 20, status: status === "all" ? undefined : status, source: source === "all" ? undefined : source, q }),
    placeholderData: (p) => p,
    refetchInterval: 30_000,
  });
  const filtered = status !== "all" || source !== "all" || !!q;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0 overflow-hidden xl:order-1">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-center">
          <Segmented
            id="auto-status"
            ariaLabel="Status"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: "all", label: "All" }, { value: "scheduled", label: "Scheduled" }, { value: "sent", label: "Sent" }, { value: "skipped", label: "Skipped" }, { value: "failed", label: "Failed" }]}
          />
          <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
            <div className="min-w-[170px] flex-1 lg:max-w-xs"><Input leading={<Search />} placeholder="Customer or external id" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search visits" /></div>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {list.isError ? (
          <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={Activity}
            title={filtered ? "No visits match" : "No visits recorded yet"}
            description={filtered ? "Try another status or source." : "Send visits from your POS or booking tool with an API key, connect Shopify, or record one manually."}
            action={filtered ? <Button size="sm" variant="outline" onClick={() => { setStatus("all"); setSource("all"); setSearch(""); }}>Clear filters</Button> : undefined}
          />
        ) : (
          <div className={list.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Customer</TH>
                    <TH>Visit</TH>
                    <TH>Rule · channel</TH>
                    <TH>Outcome</TH>
                  </TR>
                </THead>
                <TBody>
                  {list.data.items.map((v) => (
                    <TR key={v.id}>
                      <TD className="max-w-[220px]">
                        <p className="truncate font-medium text-foreground">{v.customer_name ?? (v.customer_contact ? "Unnamed customer" : "No contact")}</p>
                        <p className="truncate font-mono text-[11px] text-subtle-foreground">{v.customer_contact ?? "—"}</p>
                      </TD>
                      <TD>
                        <p className="font-mono text-[11.5px] tabular text-foreground" title={v.occurred_at}>{fmtDateTime(v.occurred_at)}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <span className="rounded-[4px] border border-border px-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-foreground-soft">{SOURCE_LABELS[v.source] ?? v.source}</span>
                          <span className="truncate">{v.location_name}</span>
                        </p>
                      </TD>
                      <TD className="max-w-[200px]">
                        <p className="truncate text-foreground-soft">{v.rule_name ?? "—"}</p>
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{v.channel ? CHANNEL_LABELS[v.channel] ?? v.channel : "—"}{v.request_status ? ` · ${v.request_status}` : ""}</p>
                      </TD>
                      <TD><Outcome v={v} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {list.data.items.map((v) => (
                <li key={v.id} className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{v.customer_name ?? "Unnamed customer"}</p>
                      <p className="truncate font-mono text-[11px] text-subtle-foreground">{v.customer_contact ?? "—"}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] tabular text-subtle-foreground">{fmtDateTime(v.occurred_at)}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
                    <span className="rounded-[4px] border border-border px-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-foreground-soft">{SOURCE_LABELS[v.source] ?? v.source}</span>
                    <span>{v.location_name}</span>
                    {v.rule_name && <span className="truncate">· {v.rule_name}</span>}
                  </p>
                  <Outcome v={v} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.page_size} onPage={setPage} />}
      </Card>
      <div className="space-y-5 xl:order-2">
        <SkipBreakdown summary={summary} />
        {summary && Object.keys(summary.by_source).length > 0 && (
          <Panel label={`Sources · ${summary.window_days}d`}>
            <ul className="space-y-2">
              {Object.entries(summary.by_source).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-foreground-soft">{SOURCE_LABELS[k] ?? k}</span>
                  <span className="font-mono tabular">{formatNumber(n)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
