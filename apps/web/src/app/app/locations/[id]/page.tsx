"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Crosshair, ExternalLink, Link2, MapPin, Megaphone, MessageSquareText, Pencil, QrCode, Reply, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { QueryErrorState } from "@/components/billing/plan-gate";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Eyebrow, IconTile, Monogram, Panel } from "@/components/console/kit";
import { LocationFormDialog } from "@/components/locations/location-form-dialog";
import { PublicLink } from "@/components/locations/public-link";
import { ROLE_INFO } from "@/components/team/roles";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, InlineAlert, Skeleton } from "@/components/ui/states";
import { AnimatedNumber, Reveal, StatusDot } from "@/components/ui/tech";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import type { Location } from "@/lib/types";
import { formatNumber, titleCase } from "@/lib/utils";

interface QR { id: string; name: string; code: string; scan_count: number; scans_7d: number; template: string }
interface Campaign { id: string; name: string; channel: string; status: string; stats: { sent?: number; google_clicks?: number } }
interface Member { id: string; full_name: string; email: string; avatar_url: string | null; role: string; restrict_to_locations: boolean; location_ids: string[] }

const PanelLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="group inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground transition hover:text-primary">{children}<ArrowRight className="size-3 transition group-hover:translate-x-0.5" /></Link>
);

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

  if (q.isLoading) return <div className="space-y-6"><Skeleton className="h-4 w-40" /><Skeleton className="h-24 rounded-xl" /><div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-64 rounded-xl" /></div>;
  if (q.error) {
    if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState icon={MapPin} title="Location not found" action={<Button asChild variant="outline"><Link href="/app/locations">All locations</Link></Button>} />;
    return <QueryErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  const l = q.data!;
  const withAccess = (team.data ?? []).filter((m) => !m.restrict_to_locations || m.location_ids.includes(l.id));
  const focused = locationId === l.id;

  return (
    <div className="space-y-6">
      <Link href="/app/locations" className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" /> Locations</Link>
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <IconTile size={52} signal={l.is_active}><MapPin /></IconTile>
          <div className="min-w-0">
            <Eyebrow parts={[<span key="s" className="flex items-center gap-1.5"><StatusDot tone={l.is_active ? "ok" : "idle"} />{l.is_active ? "Live" : "Paused"}</span>, `/r/${l.slug}`]} />
            <h1 className="mt-1.5 truncate text-[24px] font-semibold leading-tight tracking-[-0.025em]">{l.name}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{[l.address_line, l.city, l.state, l.postal_code].filter(Boolean).join(", ") || "No address"}{l.phone ? <span className="font-mono text-xs"> · {l.phone}</span> : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {focused ? (
            <Button variant="soft" size="sm" onClick={() => { setLocationId(null); toast.success("Workspace filter cleared"); }}><Crosshair /> Focused · clear</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setLocationId(l.id); toast.success(`Dashboard filtered to ${l.name}`); }}><Crosshair /> Focus dashboard</Button>
          )}
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
        <StatCard label="Average rating" value={l.average_rating == null ? "—" : <AnimatedNumber value={l.average_rating} format={(n) => n.toFixed(2)} />} icon={Star} accent="amber" />
        <StatCard label="Reviews" value={<AnimatedNumber value={l.review_count} />} icon={MessageSquareText} />
        <StatCard label="Awaiting response" value={<AnimatedNumber value={l.pending_responses} />} icon={Reply} accent={l.pending_responses ? "warning" : "success"} footer={<Link href="/app/reviews" className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary hover:underline">Open reviews →</Link>} />
        <StatCard label="QR codes" value={<AnimatedNumber value={l.qr_count} />} icon={QrCode} accent="mint" footer={<span className="font-mono">{l.campaign_count} campaigns</span>} />
      </div>

      <Reveal>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel index="01" label="Destination" title={<><GoogleIcon className="size-4" />Google review destination</>} description="Where customers go when they choose to review you publicly">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background-subtle/60 px-4 py-3">
                <div className="min-w-0"><p className="text-[13px] font-medium">Business Profile API</p><p className="truncate font-mono text-[11px] text-muted-foreground">{l.google_location_name ?? "Not linked to a Google location"}</p></div>
                <StatusBadge status={l.google_location_name ? l.google_status : "not_connected"} />
              </div>
              {l.effective_review_url ? (
                <a href={l.effective_review_url} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-lg border border-border px-4 py-3 font-mono text-[11.5px] text-foreground-soft transition hover:border-border-strong hover:text-foreground">
                  <Link2 className="size-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{l.effective_review_url}</span><ExternalLink className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                </a>
              ) : (
                <InlineAlert variant="warning" icon={Link2} title="No Google review link">Customers can still leave private feedback, but the “Review on Google” button is hidden until you add a link or connect Google.</InlineAlert>
              )}
              <div className="flex flex-wrap gap-2">
                {can("locations.manage") && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Set review link manually</Button>}
                {can("integrations.manage") && <Button size="sm" variant="soft" asChild><Link href="/app/integrations">Connect Google</Link></Button>}
              </div>
            </div>
          </Panel>
          <Panel index="02" label="Public page" title="Public feedback page" description="Share this link or print a QR code. Everyone sees the same option to review on Google.">
            <div className="space-y-4">
              <PublicLink slug={l.slug} />
              <Button size="sm" asChild><Link href="/app/qr-codes"><QrCode /> Create QR code</Link></Button>
            </div>
          </Panel>
        </div>
      </Reveal>

      <Reveal>
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel index="03" label="Physical" title="QR codes" flush actions={<PanelLink href="/app/qr-codes">Manage</PanelLink>}>
            {qrs.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : !qrs.data?.length ? <p className="p-5 text-[13px] text-muted-foreground">No QR codes for this location yet.</p> : (
              <ul className="divide-y divide-border">
                {qrs.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                    <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{titleCase(r.template)} card</span></span>
                    <span className="shrink-0 text-right font-mono text-xs tabular"><span className="block text-foreground">{formatNumber(r.scan_count)} scans</span><span className="text-subtle-foreground">+{r.scans_7d} · 7d</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel index="04" label="Outreach" title="Campaigns" flush actions={<PanelLink href="/app/campaigns">All</PanelLink>}>
            {camps.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : !camps.data?.items.length ? <p className="p-5 text-[13px] text-muted-foreground">No campaigns for this location yet.</p> : (
              <ul className="divide-y divide-border">
                {camps.data.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                    <Link href={`/app/campaigns/${c.id}`} className="min-w-0 transition-colors hover:text-primary"><span className="block truncate font-medium">{c.name}</span><span className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground"><Megaphone className="size-3" />{c.channel === "qr" ? "QR" : c.channel === "whatsapp" ? "WhatsApp" : titleCase(c.channel)} · {formatNumber(c.stats.sent ?? 0)} sent</span></Link>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel index="05" label="Access" title={<><Users className="size-4 text-primary" />Team with access</>} flush actions={<PanelLink href="/app/team">Team</PanelLink>}>
            {team.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : (
              <ul className="divide-y divide-border">
                {withAccess.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                    <Monogram name={m.full_name} src={m.avatar_url} size={26} />
                    <span className="min-w-0 flex-1 truncate">{m.full_name}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{ROLE_INFO[m.role]?.label ?? titleCase(m.role)}{m.restrict_to_locations ? " · scoped" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Reveal>
      <LocationFormDialog open={editing} onOpenChange={setEditing} location={l} />
    </div>
  );
}
