"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, Megaphone, MessageSquareText, Pencil, Phone, Plus, QrCode, Star } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { PublicLink } from "@/components/locations/public-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
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

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Every branch gets its own feedback page, QR codes, campaigns and review analytics."
        actions={
          <div className="flex items-center gap-3">
            {max != null && <span className="hidden text-xs text-muted-foreground tabular sm:inline">{q.data?.length ?? 0} of {max} on {plan.data?.plan?.name}</span>}
            {canManage && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add location</Button>}
          </div>
        }
      />
      {q.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      ) : q.error ? (
        <QueryErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Card><EmptyState icon={MapPin} title="Add your first location" description="Create a location to get a public feedback page and printable QR codes." action={canManage && <Button onClick={() => setOpen(true)}><Plus /> Add location</Button>} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l) => (
            <Card key={l.id} className="card-hover group relative flex flex-col overflow-hidden">
              <div className="relative h-20 overflow-hidden border-b border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_14%,var(--card)),color-mix(in_oklab,var(--blue)_10%,var(--card)))]">
                <div className="bg-dots absolute inset-0 opacity-60" aria-hidden />
                <div className="absolute bottom-3 left-5 flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm"><MapPin className="size-4 text-primary" /></span>
                  {!l.is_active && <StatusBadge status="paused" />}
                </div>
                {canManage && (
                  <Button variant="outline" size="icon-xs" className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={`Edit ${l.name}`} onClick={() => { setEditing(l); setOpen(true); }}><Pencil /></Button>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <Link href={`/app/locations/${l.id}`} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight">{l.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{[l.address_line, l.city, l.state].filter(Boolean).join(", ") || "No address added"}</p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-subtle-foreground transition group-hover:text-foreground" />
                </Link>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric icon={Star} label="Rating" value={l.average_rating ? l.average_rating.toFixed(2) : "—"} />
                  <Metric icon={MessageSquareText} label="Reviews" value={formatNumber(l.review_count)} />
                  <Metric label="Pending" value={formatNumber(l.pending_responses)} warn={l.pending_responses > 0} />
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><QrCode className="size-3.5" />{l.qr_count} QR</span>
                  <span className="flex items-center gap-1.5"><Megaphone className="size-3.5" />{l.campaign_count} campaigns</span>
                  {l.phone && <span className="hidden items-center gap-1.5 sm:flex"><Phone className="size-3.5" />{l.phone}</span>}
                </div>
                <div className="mt-auto space-y-3 pt-4">
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium"><GoogleIcon className="size-3.5" />Google</span>
                    {l.google_location_name ? <StatusBadge status={l.google_status} /> : l.effective_review_url ? <span className="text-[11.5px] text-muted-foreground">Manual review link</span> : <StatusBadge status="not_connected" />}
                  </div>
                  <PublicLink slug={l.slug} compact />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <LocationFormDialog open={open} onOpenChange={setOpen} location={editing} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, warn }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-background-subtle px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{Icon && <Icon className="size-3" />}{label}</p>
      <p className={cn("mt-0.5 text-[15px] font-semibold tabular", warn && "text-warning-foreground")}>{value}</p>
    </div>
  );
}
