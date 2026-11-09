"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, Megaphone, Pencil, Phone, Plus, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Eyebrow, IconTile, ReadoutStrip } from "@/components/console/kit";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { PublicLink } from "@/components/locations/public-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Reveal, SegmentMeter, StatusDot } from "@/components/ui/tech";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import type { Location } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

export default function LocationsPage() {
  const { can, orgId } = useOrg();
  const canManage = can("locations.manage");
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [open, setOpen] = React.useState(false);
  const q = useQuery({ queryKey: ["locations", orgId], queryFn: () => api.get<Location[]>("/locations") });
  const plan = useQuery({ queryKey: ["subscription", orgId], queryFn: () => api.get<{ plan: { max_locations: number; name: string } | null; usage: { locations: number } }>("/subscriptions/current") });
  const max = plan.data?.plan?.max_locations;
  const list = q.data ?? [];
  const used = list.length;
  const reviews = list.reduce((a, l) => a + l.review_count, 0);
  const pending = list.reduce((a, l) => a + l.pending_responses, 0);
  const linked = list.filter((l) => l.google_location_name || l.effective_review_url).length;

  return (
    <div className="space-y-5">
      <PageHeader
        className="mb-0"
        eyebrow={<Eyebrow parts={["Manage", "Location network"]} />}
        title="Locations"
        description="Every branch gets its own feedback page, QR codes, campaigns and review analytics."
        actions={
          <div className="flex items-center gap-4">
            {max != null && (
              <div className="hidden items-center gap-3 sm:flex" title={`${used} of ${max} locations on ${plan.data?.plan?.name}`}>
                <div className="text-right">
                  <p className="micro-label">Plan slots</p>
                  <p className="font-mono text-[12px] tabular text-foreground">{used} / {max} <span className="text-subtle-foreground">· {plan.data?.plan?.name}</span></p>
                </div>
                <SegmentMeter value={max ? (used / max) * 100 : 0} segments={Math.min(12, Math.max(1, max))} tone={used >= max ? "warning" : "primary"} />
              </div>
            )}
            {canManage && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add location</Button>}
          </div>
        }
      />
      {list.length > 0 && (
        <ReadoutStrip
          items={[
            { label: "Locations", value: used, tone: "signal" },
            { label: "Reviews · all branches", value: formatNumber(reviews) },
            { label: "Awaiting response", value: formatNumber(pending), tone: pending ? "warn" : "muted" },
            { label: "Google destination set", value: `${linked} / ${used}`, tone: linked === used ? "ok" : "warn" },
          ]}
        />
      )}
      {q.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      ) : q.error ? (
        <QueryErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <Card><EmptyState icon={MapPin} title="Add your first location" description="Create a location to get a public feedback page and printable QR codes." action={canManage && <Button onClick={() => setOpen(true)}><Plus /> Add location</Button>} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((l, i) => (
            <Reveal key={l.id} delay={Math.min(i, 5) * 0.04} className="h-full min-w-0">
              <Card className="card-hover group relative flex h-full flex-col overflow-hidden">
                <div className="relative border-b border-border p-5">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-60 [mask-image:linear-gradient(180deg,#000,transparent)]" />
                  <div className="relative flex items-start gap-3.5">
                    <IconTile size={38} signal={l.is_active}><MapPin /></IconTile>
                    <Link href={`/app/locations/${l.id}`} className="min-w-0 flex-1 outline-none">
                      <p className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">
                        <StatusDot tone={l.is_active ? "ok" : "idle"} />
                        <span className="truncate">{l.is_active ? "Live" : "Paused"}{l.city ? ` · ${l.city}` : ""}</span>
                      </p>
                      <h3 className="mt-1 truncate text-[15.5px] font-semibold tracking-[-0.015em] transition-colors group-hover:text-primary">{l.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{[l.address_line, l.city, l.state].filter(Boolean).join(", ") || "No address added"}</p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      {canManage && (
                        <Button variant="ghost" size="icon-xs" className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100" aria-label={`Edit ${l.name}`} onClick={() => { setEditing(l); setOpen(true); }}><Pencil /></Button>
                      )}
                      <Link href={`/app/locations/${l.id}`} aria-label={`Open ${l.name}`} className="flex size-7 items-center justify-center rounded-md text-subtle-foreground transition group-hover:text-foreground"><ArrowUpRight className="size-4" /></Link>
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-px border-b border-border bg-border">
                  {[
                    { label: "Rating", value: l.average_rating ? `${l.average_rating.toFixed(2)}★` : "—", cls: l.average_rating ? "text-amber" : "" },
                    { label: "Reviews", value: formatNumber(l.review_count), cls: "" },
                    { label: "Pending", value: formatNumber(l.pending_responses), cls: l.pending_responses > 0 ? "text-warning-foreground" : "text-muted-foreground" },
                  ].map((m) => (
                    <div key={m.label} className="bg-card px-4 py-3">
                      <dt className="micro-label">{m.label}</dt>
                      <dd className={cn("mt-1 text-[18px] font-semibold leading-none tracking-[-0.02em] tabular", m.cls)}>{m.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><QrCode className="size-3.5" />{l.qr_count} QR</span>
                    <span className="flex items-center gap-1.5"><Megaphone className="size-3.5" />{l.campaign_count} campaigns</span>
                    {l.phone && <span className="hidden items-center gap-1.5 sm:flex"><Phone className="size-3.5" />{l.phone}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-border bg-background-subtle/60 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-medium"><GoogleIcon className="size-3.5" />Google destination</span>
                    {l.google_location_name ? <StatusBadge status={l.google_status} /> : l.effective_review_url ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Manual link</span> : <StatusBadge status="not_connected" />}
                  </div>
                  <PublicLink slug={l.slug} compact />
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
      <LocationFormDialog open={open} onOpenChange={setOpen} location={editing} />
    </div>
  );
}
