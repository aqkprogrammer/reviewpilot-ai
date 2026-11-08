"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Link2, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { IntegrationCard, KV } from "./shell";

interface GLoc { name: string; title: string | null; address: string; place_id?: string | null }
interface GoogleStatus {
  platform_configured: boolean; status: string; email: string | null; last_synced_at: string | null; last_error: string | null; quota_used_today: number;
  accounts: { id: string; account_name: string; display_name: string | null; type: string | null; locations: GLoc[] }[];
  locations: { id: string; name: string; google_location_name: string | null; google_account_id: string | null; google_review_url: string | null }[];
}

const STATUS_COPY: Record<string, string> = {
  connected: "Reviews sync automatically every 2 hours and owner-approved replies publish to Google.",
  not_connected: "Connect to sync Google reviews and publish owner-approved replies.",
  pending_authorization: "Authorized, but Google hasn't granted Business Profile API access to this project yet. Use manual review links meanwhile.",
  token_expired: "Google authorization expired or was revoked. Reconnect to resume syncing.",
  error: "The last sync failed repeatedly. Check the error below and reconnect if needed.",
};

export function GoogleCard() {
  const { orgId, can } = useOrg();
  const manage = can("integrations.manage");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", "google", orgId], queryFn: () => api.get<GoogleStatus>("/integrations/google") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["locations"] }); };
  const connect = useMutation({ mutationFn: () => api.post<{ url: string }>("/integrations/google/connect"), onSuccess: (r) => { window.location.href = r.url; }, onError: (e) => toast.error(errorMessage(e)) });
  const sync = useMutation({ mutationFn: () => api.post("/integrations/google/sync"), onSuccess: () => toast.success("Sync started — new reviews will appear shortly"), onError: (e) => toast.error(errorMessage(e)) });
  const discover = useMutation({ mutationFn: () => api.post("/integrations/google/discover"), onSuccess: () => { toast.success("Accounts refreshed"); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const link = useMutation({
    mutationFn: (b: { location_id: string; account_id: string; google_location_name: string }) => api.post("/integrations/google/link", b),
    onSuccess: () => { toast.success("Location linked"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unlink = useMutation({ mutationFn: (id: string) => api.post(`/integrations/google/unlink/${id}`), onSuccess: () => { toast.success("Location unlinked"); refresh(); } });

  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  const s = q.data;
  if (!s) return null;
  const status = !s.platform_configured && s.status === "not_connected" ? "not_configured" : s.status;
  const options = s.accounts.flatMap((a) => a.locations.map((l) => ({ value: `${a.id}|${l.name}`, label: `${l.title ?? l.name}${l.address ? ` — ${l.address}` : ""}`, account: a.display_name ?? a.account_name })));

  return (
    <IntegrationCard
      className="lg:col-span-2"
      icon={<GoogleIcon />}
      name="Google Business Profile"
      tagline="Official Business Profile APIs — review sync and reply publishing. We never scrape Google."
      status={status}
      footer={
        manage && (
          s.platform_configured ? (
            s.status === "not_connected" || s.status === "token_expired" ? (
              <Button size="sm" loading={connect.isPending} onClick={() => connect.mutate()}><Plug /> {s.status === "token_expired" ? "Reconnect Google" : "Connect Google"}</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" loading={sync.isPending} disabled={s.status !== "connected"} onClick={() => sync.mutate()}><RefreshCw /> Sync now</Button>
                <Button size="sm" variant="outline" loading={discover.isPending} onClick={() => discover.mutate()}>Refresh accounts</Button>
                {s.status !== "connected" && <Button size="sm" variant="outline" loading={connect.isPending} onClick={() => connect.mutate()}>Reconnect</Button>}
                <ConfirmDialog destructive title="Disconnect Google?" description="Review sync stops and the OAuth grant is revoked. Synced reviews stay in ReviewPilot; manual review links keep working." confirmLabel="Disconnect"
                  onConfirm={async () => { try { await api.delete("/integrations/google"); toast.success("Google disconnected"); refresh(); } catch (e) { toast.error(errorMessage(e)); } }}
                  trigger={<Button size="sm" variant="ghost" className="ml-auto text-danger-foreground"><Unplug /> Disconnect</Button>} />
              </>
            )
          ) : (
            <Button size="sm" variant="outline" asChild><Link href="/app/locations"><Link2 /> Add review links manually</Link></Button>
          )
        )
      }
    >
      {!s.platform_configured ? (
        <InlineAlert variant="info" icon={BookOpen} title="Google OAuth isn't configured on this server">
          An administrator needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, enable the Business Profile APIs and request API access from Google (see docs/GOOGLE_INTEGRATION.md). Until then, paste each location's Google review link on the Locations page — the public feedback page uses it.
        </InlineAlert>
      ) : (
        <p className="text-[13px] text-muted-foreground">{STATUS_COPY[s.status] ?? ""}</p>
      )}
      {s.last_error && s.status !== "connected" && <InlineAlert variant="danger" title="Last error">{s.last_error}</InlineAlert>}
      {s.status !== "not_connected" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <KV label="Google account" value={s.email} />
          <KV label="Last sync" value={s.last_synced_at ? formatDistanceToNow(new Date(s.last_synced_at), { addSuffix: true }) : "Never"} />
          <KV label="API calls today" value={s.quota_used_today} />
        </div>
      )}
      {s.accounts.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">Link Google locations</p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {s.locations.map((l) => {
              const current = l.google_location_name && l.google_account_id ? `${l.google_account_id}|${l.google_location_name}` : "none";
              return (
                <div key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{l.name}</span>
                  <Select
                    value={current}
                    disabled={!manage || link.isPending}
                    onValueChange={(v) => {
                      if (v === "none") return l.google_location_name && unlink.mutate(l.id);
                      const [account_id, google_location_name] = v.split("|");
                      link.mutate({ location_id: l.id, account_id, google_location_name });
                    }}
                  >
                    <SelectTrigger size="sm" className="sm:w-80" aria-label={`Google location for ${l.name}`}><SelectValue placeholder="Choose Google location" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </IntegrationCard>
  );
}
