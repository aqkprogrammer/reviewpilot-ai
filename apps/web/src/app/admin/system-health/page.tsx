"use client";
import { Activity, Cpu, Database, RefreshCw, Server, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, titleCase } from "@/lib/utils";
import { BarTrend, C } from "@/components/admin/charts";
import { DataTable, MetricCard, Panel, QueryState, Row, SectionHeader, StatusPill, Td, Th, relTime, useAdmin } from "@/components/admin/ui";

interface Health {
  api: { status: string; environment: string; demo_mode: boolean };
  database: { status: string; latency_ms?: number; error?: string };
  redis: { status: string; latency_ms?: number; note?: string; error?: string };
  worker: { status: string; last_heartbeat?: string | null };
  queue_backlog: number;
  jobs?: { queued: number; running: number; failed_24h: number; succeeded_24h: number };
  integration_errors?: { google: number; messaging: number };
  recent_exceptions?: { id: string; created_at: string; source: string; path: string | null; error_type: string; message: string }[];
  recent_jobs: { id: string; name: string; status: string; runner: string; attempts: number; error: string | null; created_at: string; finished_at: string | null }[];
  error_series: { hour: string; errors: number }[];
}

function Service({ name, icon: Icon, status, detail }: { name: string; icon: React.ComponentType<{ className?: string }>; status: string; detail?: string }) {
  const ok = status === "ok";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card p-4", ok ? "border-[#10b981]/30" : "border-[#f59e0b]/30")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-[13px] font-medium text-foreground"><Icon className="size-4 text-subtle-foreground" />{name}</span>
        <span className="relative flex size-2.5">
          {ok && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />}
          <span className={cn("relative inline-flex size-2.5 rounded-full", ok ? "bg-success" : status === "down" ? "bg-danger" : "bg-warning")} />
        </span>
      </div>
      <p className="mt-3"><StatusPill status={status} /></p>
      {detail && <p className="mt-2 text-[11.5px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default function SystemHealthPage() {
  const q = useAdmin<Health>("/system-health", undefined, { refetchInterval: 15_000 });
  const d = q.data;
  return (
    <>
      <SectionHeader eyebrow="Operations" title="System health" description="Live infrastructure probes. Refreshes every 15 seconds." actions={<Button variant="outline" size="sm" onClick={() => q.refetch()} loading={q.isFetching}><RefreshCw /> Refresh</Button>} />
      <QueryState query={q}>
        {d && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Service name="API" icon={Server} status={d.api.status} detail={`${titleCase(d.api.environment)}${d.api.demo_mode ? " · demo mode" : ""}`} />
              <Service name="PostgreSQL" icon={Database} status={d.database.status} detail={d.database.latency_ms !== undefined ? `${d.database.latency_ms} ms round-trip` : d.database.error} />
              <Service name="Redis" icon={Cpu} status={d.redis.status} detail={d.redis.latency_ms !== undefined ? `${d.redis.latency_ms} ms` : d.redis.note ?? d.redis.error} />
              <Service name="ARQ worker" icon={Workflow} status={d.worker.status} detail={d.worker.last_heartbeat ? `Heartbeat ${relTime(d.worker.last_heartbeat)}` : undefined} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Queue backlog" value={d.queue_backlog} icon={Activity} accent="blue" />
              <MetricCard label="Jobs succeeded (24h)" value={d.jobs?.succeeded_24h ?? 0} icon={Workflow} accent="emerald" hint={`${d.jobs?.running ?? 0} running · ${d.jobs?.queued ?? 0} queued`} />
              <MetricCard label="Jobs failed (24h)" value={d.jobs?.failed_24h ?? 0} icon={Workflow} accent={d.jobs?.failed_24h ? "rose" : "emerald"} />
              <MetricCard label="Integration errors" value={(d.integration_errors?.google ?? 0) + (d.integration_errors?.messaging ?? 0)} icon={Activity} accent="amber" hint={`${d.integration_errors?.google ?? 0} Google · ${d.integration_errors?.messaging ?? 0} messaging`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Exceptions (24h)" description="Unhandled errors per hour"><BarTrend data={d.error_series} x="hour" series={[{ key: "errors", name: "Errors", color: C.rose }]} height={200} /></Panel>
              <Panel title="Recent exceptions" flush className="xl:col-span-2">
                <ul className="max-h-[260px] divide-y divide-border overflow-y-auto scrollbar-thin">
                  {d.recent_exceptions?.map((e) => (
                    <li key={e.id} className="px-5 py-2.5">
                      <p className="flex items-center gap-2 text-[12.5px]"><span className="font-mono text-danger-foreground">{e.error_type}</span><span className="truncate font-mono text-subtle-foreground">{e.source} {e.path}</span><span className="ml-auto shrink-0 text-[11px] text-subtle-foreground">{relTime(e.created_at)}</span></p>
                      <p className="truncate text-[12px] text-muted-foreground">{e.message}</p>
                    </li>
                  ))}
                  {!d.recent_exceptions?.length && <li className="px-5 py-10 text-center text-[13px] text-muted-foreground">No exceptions recorded. </li>}
                </ul>
              </Panel>
            </div>
            <Panel title="Background jobs" description="Most recent 20" flush>
              <DataTable colSpan={6} minWidth={640} empty={!d.recent_jobs.length} head={<><Th>Job</Th><Th>Status</Th><Th>Runner</Th><Th align="right">Attempts</Th><Th>Error</Th><Th>Queued</Th></>}>
                {d.recent_jobs.map((j) => (
                  <Row key={j.id}>
                    <Td className="font-mono text-[12px] text-foreground">{j.name}</Td>
                    <Td><StatusPill status={j.status} /></Td>
                    <Td className="font-mono text-[12px]">{j.runner}</Td>
                    <Td align="right">{j.attempts}</Td>
                    <Td className="max-w-[280px] truncate text-[12px] text-danger-foreground">{j.error ?? ""}</Td>
                    <Td>{relTime(j.created_at)}</Td>
                  </Row>
                ))}
              </DataTable>
            </Panel>
          </div>
        )}
      </QueryState>
    </>
  );
}
