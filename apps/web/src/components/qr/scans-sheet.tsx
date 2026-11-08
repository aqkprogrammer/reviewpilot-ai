"use client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Monitor, ScanLine, Smartphone } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ChartTooltip, GradientDefs, axisProps, gridProps } from "@/components/app/chart-kit";
import { api, errorMessage } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { QR } from "./types";

interface Scans { series: { date: string; scans: number; unique: number }[]; devices: Record<string, number>; total: number }

const DEVICE_LABEL: Record<string, string> = { android: "Android", ios: "iPhone / iPad", desktop: "Desktop", unknown: "Unknown" };

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
          <SheetTitle>Scan analytics</SheetTitle>
          <SheetDescription>{qr?.name} · {qr?.location_name}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : !d ? <Skeleton className="h-72" /> : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[["All-time scans", formatNumber(d.total)], ["Last 60 days", formatNumber(scans60)], ["Unique (est.)", formatNumber(unique)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-border p-3">
                    <p className="text-[11.5px] text-muted-foreground">{l}</p>
                    <p className="mt-1 text-lg font-semibold tabular">{v}</p>
                  </div>
                ))}
              </div>
              {!d.series.length ? (
                <EmptyState compact icon={ScanLine} title="No scans yet" description="Print the card and place it where customers finish their visit — at the counter or on tables." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                      <GradientDefs id="scan-g" color="var(--chart-4)" />
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="date" {...axisProps} tickFormatter={(x: string) => format(parseISO(x), "d MMM")} minTickGap={24} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? format(parseISO(l), "EEE d MMM") : l)} />} />
                      <Area type="monotone" dataKey="scans" name="Scans" stroke="var(--chart-4)" strokeWidth={2} fill="url(#scan-g)" />
                      <Area type="monotone" dataKey="unique" name="Unique" stroke="var(--chart-1)" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {devTotal > 0 && (
                <div>
                  <p className="mb-3 text-[13px] font-semibold">Devices</p>
                  <ul className="space-y-2.5">
                    {Object.entries(d.devices).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                      <li key={k} className="flex items-center gap-3 text-[13px]">
                        {k === "desktop" ? <Monitor className="size-4 text-muted-foreground" /> : <Smartphone className="size-4 text-muted-foreground" />}
                        <span className="w-28">{DEVICE_LABEL[k] ?? k}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-cyan" style={{ width: `${(n / devTotal) * 100}%` }} /></div>
                        <span className="w-12 text-right text-xs tabular text-muted-foreground">{formatPercent(n / devTotal, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">Scans are counted by ReviewPilot&apos;s first-party redirect. Rapid repeat scans from the same device are de-duplicated; only a salted hash of the IP is stored.</p>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
