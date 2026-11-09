"use client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Monitor, ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, StatusDot } from "@/components/ui/tech";
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps } from "@/components/app/chart-kit";
import { SegBar } from "@/components/dashboard/kit";
import { api, errorMessage } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { QR } from "./types";

interface Scans { series: { date: string; scans: number; unique: number }[]; devices: Record<string, number>; total: number }

const DEVICE_LABEL: Record<string, string> = { android: "Android", ios: "iPhone / iPad", desktop: "Desktop", unknown: "Unknown" };
const int = (n: number) => formatNumber(Math.round(n));

export function ScansSheet({ qr, onClose }: { qr: QR | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["qr-codes", "scans", qr?.id], queryFn: () => api.get<Scans>(`/qr-codes/${qr!.id}/scans`, { days: 60 }), enabled: !!qr });
  const d = q.data;
  const devTotal = d ? Object.values(d.devices).reduce((a, b) => a + b, 0) : 0;
  const unique = d?.series.reduce((a, s) => a + s.unique, 0) ?? 0;
  const scans60 = d?.series.reduce((a, s) => a + s.scans, 0) ?? 0;
  return (
    <Sheet open={!!qr} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <p className="micro-label mb-2 flex items-center gap-2"><StatusDot tone="live" pulse /> Scan telemetry · {qr?.code}</p>
          <SheetTitle>Scan analytics</SheetTitle>
          <SheetDescription>{qr?.name} · {qr?.location_name}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : !d ? <Skeleton className="h-72" /> : (
            <>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {([["All-time scans", d.total], ["Last 60 days", scans60], ["Unique (est.)", unique]] as const).map(([l, v]) => (
                  <div key={l} className="bg-card p-3.5">
                    <p className="micro-label !text-[9.5px]">{l}</p>
                    <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular"><AnimatedNumber value={v} format={int} /></p>
                  </div>
                ))}
              </div>
              {!d.series.length ? (
                <EmptyState compact icon={ScanLine} title="No scans yet" description="Print the card and place it where customers finish their visit — at the counter or on tables." />
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="micro-label">Daily scans · 60 days</p>
                    <Legend items={[{ label: "Scans", color: "var(--chart-1)" }, { label: "Unique", color: "var(--chart-4)" }]} />
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={d.series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                        <GradientDefs id="scan-g" color="var(--chart-1)" />
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="date" {...axisProps} tickFormatter={(x: string) => format(parseISO(x), "d MMM")} minTickGap={24} />
                        <YAxis {...axisProps} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE d MMM") : l)} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 3" }} />
                        <Area type="monotone" dataKey="scans" name="Scans" stroke="var(--chart-1)" strokeWidth={1.75} fill="url(#scan-g)" />
                        <Line type="monotone" dataKey="unique" name="Unique" stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {devTotal > 0 && (
                <div>
                  <p className="micro-label mb-3">Devices</p>
                  <ul className="space-y-3">
                    {Object.entries(d.devices).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                      <li key={k} className="grid grid-cols-[16px_110px_minmax(0,1fr)_64px] items-center gap-3 text-[13px]">
                        {k === "desktop" ? <Monitor className="size-4 text-muted-foreground" /> : <Smartphone className="size-4 text-muted-foreground" />}
                        <span className="truncate">{DEVICE_LABEL[k] ?? k}</span>
                        <SegBar value={n / devTotal} height={8} />
                        <span className="text-right font-mono text-[11px] tabular text-muted-foreground"><span className="text-foreground">{n}</span> · {formatPercent(n / devTotal, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="flex gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />Scans are counted by ReviewPilot&apos;s first-party redirect. Rapid repeat scans from the same device are de-duplicated; only a salted hash of the IP is stored.</p>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
