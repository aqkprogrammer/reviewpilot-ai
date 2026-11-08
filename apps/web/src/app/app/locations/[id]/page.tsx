"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Link2, MapPin, Megaphone, MessageSquareText, Pencil, QrCode, Reply, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { PublicLink } from "@/components/locations/public-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/controls";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import type { Location } from "@/lib/types";
import { formatNumber, titleCase } from "@/lib/utils";

interface QR { id: string; name: string; code: string; scan_count: number; scans_7d: number; template: string }
interface Campaign { id: string; name: string; channel: string; status: string; stats: { sent?: number; google_clicks?: number } }
interface Member { id: string; full_name: string; email: string; avatar_url: string | null; role: string; restrict_to_locations: boolean; location_ids: string[] }

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, orgId, setLocationId, locationId } = useOrg();
  const [editing, setEditing] = React.useState(false);
  const q = useQuery({ queryKey: ["location", orgId, id], queryFn: () => api.get<Location>(`/locations/${id}`) });
  const qrs = useQuery({ queryKey: ["qr-codes", orgId, { location: id }], queryFn: () => api.get<QR[]>("/qr-codes", { location_id: id }) });
  const camps = useQuery({ queryKey: ["campaigns", orgId, { location: id }], queryFn: () => api.get<{ items: Campaign[] }>("/campaigns", { location_id: id, page_size: 10 }) });
  const team = useQuery({ queryKey: ["team", "members", orgId], queryFn: () => api.get<Member[]>("/team/members") });

  if (q.isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-72" /><div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;
  if (q.error) {
    if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState icon={MapPin} title="Location not found" action={<Button asChild variant="outline"><Link href="/app/locations">All locations</Link></Button>} />;
    return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  const l = q.data!;
  const withAccess = (team.data ?? []).filter((m) => !m.restrict_to_locations || m.location_ids.includes(l.id));

  return (
    <div className="space-y-6">
      <Link href="/app/locations" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Locations</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"><MapPin className="size-5 text-primary" /></span>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{l.name}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{[l.address_line, l.city, l.state, l.postal_code].filter(Boolean).join(", ") || "No address"}{l.phone ? ` · ${l.phone}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {locationId !== l.id && <Button variant="outline" size="sm" onClick={() => { setLocationId(l.id); toast.success(`Dashboard filtered to ${l.name}`); }}>Focus dashboard</Button>}
          {can("locations.manage") && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
              <ConfirmDialog
                destructive
                title={`Delete ${l.name}?`}
                description="The feedback page and QR codes for this location stop working immediately. Historical reviews remain in analytics."
                confirmText={l.name}
                confirmLabel="Delete location"
                onConfirm={async () => {
                  try {
                    await api.delete(`/locations/${l.id}`);
                    toast.success("Location deleted");
                    if (locationId === l.id) setLocationId(null);
                    qc.invalidateQueries({ queryKey: ["locations"] });
                    router.push("/app/locations");
                  } catch (e) { toast.error(errorMessage(e)); }
                }}
                trigger={<Button variant="danger-soft" size="sm"><Trash2 /> Delete</Button>}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average rating" value={l.average_rating?.toFixed(2) ?? "—"} icon={Star} accent="warning" />
        <StatCard label="Reviews" value={formatNumber(l.review_count)} icon={MessageSquareText} />
        <StatCard label="Awaiting response" value={formatNumber(l.pending_responses)} icon={Reply} accent={l.pending_responses ? "danger" : "success"} footer={<Link href="/app/reviews" className="text-primary hover:underline">Open reviews</Link>} />
        <StatCard label="QR codes" value={formatNumber(l.qr_count)} icon={QrCode} accent="purple" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><GoogleIcon className="size-4" />Google review destination</CardTitle><CardDescription>Where customers go when they choose to review you publicly</CardDescription></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div><p className="text-[13px] font-medium">Business Profile API</p><p className="text-xs text-muted-foreground">{l.google_location_name ?? "Not linked to a Google location"}</p></div>
              <StatusBadge status={l.google_location_name ? l.google_status : "not_connected"} />
            </div>
            {l.effective_review_url ? (
              <a href={l.effective_review_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all rounded-xl bg-background-subtle px-4 py-3 text-xs text-foreground-soft hover:text-foreground">
                <Link2 className="size-3.5 shrink-0" />{l.effective_review_url}<ExternalLink className="ml-auto size-3.5 shrink-0" />
              </a>
            ) : (
              <InlineAlert variant="warning" icon={Link2} title="No Google review link">Customers can still leave private feedback, but the “Review on Google” button is hidden until you add a link or connect Google.</InlineAlert>
            )}
            <div className="flex flex-wrap gap-2">
              {can("locations.manage") && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Set review link manually</Button>}
              {can("integrations.manage") && <Button size="sm" variant="soft" asChild><Link href="/app/integrations">Connect Google</Link></Button>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Public feedback page</CardTitle><CardDescription>Share this link or print a QR code. Everyone sees the same option to review on Google.</CardDescription></div></CardHeader>
          <CardContent className="space-y-4">
            <PublicLink slug={l.slug} />
            <Button size="sm" asChild><Link href="/app/qr-codes"><QrCode /> Create QR code</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>QR codes</CardTitle><Link href="/app/qr-codes" className="text-xs text-primary hover:underline">Manage</Link></CardHeader>
          <CardContent>
            {qrs.isLoading ? <Skeleton className="h-24" /> : !qrs.data?.length ? <p className="text-[13px] text-muted-foreground">No QR codes for this location yet.</p> : (
              <ul className="divide-y divide-border">
                {qrs.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{titleCase(r.template)} card</span></span>
                    <span className="shrink-0 text-right text-xs tabular"><span className="block font-semibold text-foreground">{formatNumber(r.scan_count)} scans</span><span className="text-muted-foreground">{r.scans_7d} this week</span></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Campaigns</CardTitle><Link href="/app/campaigns" className="text-xs text-primary hover:underline">All campaigns</Link></CardHeader>
          <CardContent>
            {camps.isLoading ? <Skeleton className="h-24" /> : !camps.data?.items.length ? <p className="text-[13px] text-muted-foreground">No campaigns for this location yet.</p> : (
              <ul className="divide-y divide-border">
                {camps.data.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <Link href={`/app/campaigns/${c.id}`} className="min-w-0 hover:underline"><span className="block truncate font-medium">{c.name}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Megaphone className="size-3" />{c.channel === "qr" ? "QR" : titleCase(c.channel)} · {formatNumber(c.stats.sent ?? 0)} sent</span></Link>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />Team with access</CardTitle><Link href="/app/team" className="text-xs text-primary hover:underline">Team</Link></CardHeader>
          <CardContent>
            {team.isLoading ? <Skeleton className="h-24" /> : (
              <ul className="space-y-2.5">
                {withAccess.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-[13px]">
                    <Avatar name={m.full_name} src={m.avatar_url} size={28} />
                    <span className="min-w-0 flex-1 truncate">{m.full_name}</span>
                    <span className="text-xs text-muted-foreground">{titleCase(m.role)}{m.restrict_to_locations ? " · scoped" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <LocationFormDialog open={editing} onOpenChange={setEditing} location={l} />
    </div>
  );
}
