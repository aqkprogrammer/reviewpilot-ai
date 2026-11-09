"use client";
import * as React from "react";
import { Activity, Cpu, Database, Layers, Plug, RefreshCw, Server, Timer, Workflow, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/tech";
import { cn, titleCase } from "@/lib/utils";
import { BarTrend, C } from "@/components/admin/charts";
import { DataTable, Row, StatusTabs, Td, Th } from "@/components/admin/table";
import { EmptyLine, SystemStatusChip, Kpi, KpiGrid, Notice, Panel, QueryState, SectionHeader, StatusPill, relTime, stamp, useAdmin } from "@/components/admin/ui";

interface Health {
  api: { status: string; environment: string; demo_mode: boolean };
  database: { status: string; latency_ms?: number; error?: string };
  redis: { status: string; latency_ms?: number; note?: string; error?: string };
  worker: { status: string; last_heartbeat?: string | null };
  queue_backlog: number;
  jobs?: { queued: number; running: number; failed_24h: number; succeeded_24h: number };
  integration_errors?: { google: number; messaging: number };
  integrations_configured?: Record<string, boolean>;
  recent_exceptions?: { id: string; created_at: string; source: string; path: string | null; error_type: string; message: string }[];
  recent_jobs: { id: string; name: string; status: string; runner: string; attempts: number; error: string | null; created_at: string; finished_at: string | null }[];
  error_series: { hour: string; errors: number }[];
}

const tone = (s: string) => (s === "ok" ? "ok" : s === "down" || s === "unknown" ? "error" : "warn") as "ok" | "warn" | "error";

function Service({ name, icon: Icon, status, metric, detail, role }: { name: string; icon: React.ComponentType<{ className?: string }>; status: string; metric: string; detail?: string; role: string }) {
  const t = tone(status);
  return (
    <div className="relative bg-card px-4 py-4">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", t === "ok" ? "bg-success/50" : t === "warn" ? "bg-amber/60" : "bg-danger/70")} />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground"><Icon className="size-4 text-subtle-foreground" />{name}</span>
        <StatusDot tone={t} pulse={t === "ok"} label={`${name} ${status}`} />
      </div>
      <p className="micro-label mt-3">{role}</p>
      <p className="mt-1 font-mono text-[20px] font-medium tabular tracking-[-0.02em] text-foreground">{metric}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusPill status={status} dot={false} />
        {detail && <span className="truncate font-mono text-[10.5px] text-subtle-foreground">{detail}</span>}
      </div>
    </div>
  );
}

/** 24 hourly buckets ending now; hours with no exceptions are real zeros. */
function fillHours(rows: { hour: string; errors: number }[]) {
  const map = new Map(rows.map((r) => [new Date(r.hour).getTime(), r.errors]));
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return Array.from({ length: 24 }, (_, i) => {
    const t = now.getTime() - (23 - i) * 3_600_000;
    return { hour: new Date(t).toISOString(), errors: map.get(t) ?? 0 };
  });
}

export default function SystemHealthPage() {
  const q = useAdmin<Health>("/system-health", undefined, { refetchInterval: 15_000 });
  const d = q.data;
  const [jobFilter, setJobFilter] = React.useState("all");
  const jobs = d?.recent_jobs.filter((j) => jobFilter === "all" || j.status === jobFilter) ?? [];
  const intErr = (d?.integration_errors?.google ?? 0) + (d?.integration_errors?.messaging ?? 0);
  const series = d ? fillHours(d.error_series) : [];
  const exc24 = series.reduce((a, s) => a + s.errors, 0);
  return (
    <>
      <SectionHeader
        title="System health"
        description="Live infrastructure probes from the API process. Auto-refreshes every 15 seconds."
        actions={
          <>
            <span className="hidden items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground md:flex" aria-live="polite">
              Probe {q.dataUpdatedAt ? stamp(new Date(q.dataUpdatedAt).toISOString()) : "—"}
            </span>
            <SystemStatusChip h={d} />
            <Button variant="outline" size="sm" onClick={() => q.refetch()} loading={q.isFetching}>{!q.isFetching && <RefreshCw />} Probe now</Button>
          </>
        }
      />
      <QueryState query={q}>
        {d && (
          <div className="space-y-4">
            {d.worker.status === "inline" && <Notice icon={Workflow}>Redis is unavailable, so background jobs run <span className="font-mono text-amber">inline</span> inside the API process (development fallback). Start Redis and the ARQ worker for production behaviour.</Notice>}
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2 xl:grid-cols-4">
              <Service name="API" icon={Server} status={d.api.status} role="Environment" metric={d.api.environment} detail={d.api.demo_mode ? "demo mode" : "live mode"} />
              <Service name="PostgreSQL" icon={Database} status={d.database.status} role="Round-trip" metric={d.database.latency_ms != null ? `${d.database.latency_ms} ms` : "—"} detail={d.database.error} />
              <Service name="Redis" icon={Cpu} status={d.redis.status} role="Latency" metric={d.redis.latency_ms != null ? `${d.redis.latency_ms} ms` : "—"} detail={d.redis.note ?? d.redis.error} />
              <Service name="ARQ worker" icon={Workflow} status={d.worker.status} role="Heartbeat" metric={d.worker.last_heartbeat ? relTime(d.worker.last_heartbeat) : d.worker.status === "inline" ? "in-process" : "—"} />
            </div>
            <KpiGrid className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Queue backlog" value={d.queue_backlog} icon={Layers} tone={d.queue_backlog > 100 ? "warning" : "ice"} sub="arq:queue depth" />
              <Kpi label="Running" value={d.jobs?.running ?? 0} icon={Activity} tone="cyan" sub="In flight now" />
              <Kpi label="Queued" value={d.jobs?.queued ?? 0} icon={Timer} tone="ice" sub="Awaiting a runner" />
              <Kpi label="Succeeded · 24h" value={d.jobs?.succeeded_24h ?? 0} icon={Workflow} tone="success" sub="Completed jobs" />
              <Kpi label="Failed · 24h" value={d.jobs?.failed_24h ?? 0} icon={XCircle} tone={d.jobs?.failed_24h ? "danger" : "success"} alert={!!d.jobs?.failed_24h} sub="After retries" />
              <Kpi label="Integration errors" value={intErr} icon={Plug} tone={intErr ? "warning" : "success"} alert={!!intErr} sub={`${d.integration_errors?.google ?? 0} google · ${d.integration_errors?.messaging ?? 0} msg`} />
            </KpiGrid>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Exceptions" description="Unhandled errors per hour" meta={`${exc24} · 24h`}>
                <BarTrend data={series} x="hour" series={[{ key: "errors", name: "Exceptions", color: C.danger }]} height={210} />
              </Panel>
              <Panel title="Recent exceptions" description="Captured by the error middleware" meta={`${d.recent_exceptions?.length ?? 0} latest`} flush className="xl:col-span-2">
                <ul className="max-h-[262px] divide-y divide-border overflow-y-auto scrollbar-thin">
                  {d.recent_exceptions?.map((e) => (
                    <li key={e.id} className="px-4 py-2.5">
                      <p className="flex items-center gap-2 text-[12px]">
                        <code className="font-mono text-danger-foreground">{e.error_type}</code>
                        <span className="truncate font-mono text-[11px] text-subtle-foreground">{e.source}{e.path ? ` ${e.path}` : ""}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-subtle-foreground">{stamp(e.created_at)}</span>
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">{e.message}</p>
                    </li>
                  ))}
                  {!d.recent_exceptions?.length && <li><EmptyLine className="py-14">No exceptions recorded</EmptyLine></li>}
                </ul>
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
              <Panel
                title="Background jobs"
                description="Most recent 20 · filter is applied to this list"
                flush
                actions={
                  <StatusTabs id="jobs" value={jobFilter} onChange={setJobFilter} items={["all", "queued", "running", "succeeded", "failed"].map((s) => ({ value: s, label: titleCase(s), count: s === "all" ? d.recent_jobs.length : d.recent_jobs.filter((j) => j.status === s).length, tone: s === "failed" ? "danger" : undefined }))} />
                }
              >
                <DataTable colSpan={6} minWidth={720} maxHeight={420} empty={!jobs.length} caption="Background jobs" head={<><Th>Job</Th><Th>Status</Th><Th>Runner</Th><Th align="right">Tries</Th><Th>Error</Th><Th>Queued</Th></>}>
                  {jobs.map((j) => (
                    <Row key={j.id}>
                      <Td className="font-mono text-[12px] text-foreground">{j.name}</Td>
                      <Td><StatusPill status={j.status} /></Td>
                      <Td className="font-mono text-[11px] uppercase">{j.runner}</Td>
                      <Td align="right" className="font-mono text-[12px]">{j.attempts}</Td>
                      <Td className="max-w-[260px] truncate text-[12px] text-danger-foreground" >{j.error ?? <span className="text-subtle-foreground">—</span>}</Td>
                      <Td className="whitespace-nowrap font-mono text-[11px]">{stamp(j.created_at)}</Td>
                    </Row>
                  ))}
                </DataTable>
              </Panel>
              <Panel title="Platform credentials" description="Configured via environment · values never shown">
                <ul className="space-y-2">
                  {Object.entries(d.integrations_configured ?? {}).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex items-center gap-2 font-mono text-[11.5px] text-foreground-soft"><StatusDot tone={v ? "ok" : "idle"} />{k}</span>
                      <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", v ? "text-success" : "text-subtle-foreground")}>{v ? "Configured" : "Not set"}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
