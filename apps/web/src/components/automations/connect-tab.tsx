"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Plus, ShieldAlert, ShoppingBag, Terminal, Trash2, Zap } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { ReadOnlyNotice } from "@/components/billing/plan-gate";
import { KVList, Panel } from "@/components/console/kit";
import { SetupSteps } from "@/components/integrations/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { type ApiKeyRow, type ShopifyStatus, automationKeys, copyText, fmtDateTime, fmtRelative } from "./types";

function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } else toast.error("Couldn't access the clipboard — select and copy manually.");
      }}
      aria-label={label}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background-subtle/70 px-3 py-1.5">
        <span className="micro-label">{label}</span>
        <CopyButton text={code} label={`Copy ${label}`} />
      </div>
      <pre className="max-h-[360px] overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-foreground-soft scrollbar-thin"><code>{code}</code></pre>
    </div>
  );
}

function useOrigin() {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

// ------------------------------------------------------------------ API keys

function CreateKeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [secret, setSecret] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) { setName(""); setSecret(null); }
  }, [open]);
  const create = useMutation({
    mutationFn: () => api.post<{ key: ApiKeyRow; secret: string }>("/automations/api-keys", { name: name.trim() }),
    onSuccess: (r) => {
      setSecret(r.secret);
      qc.invalidateQueries({ queryKey: automationKeys.keys(orgId) });
      qc.invalidateQueries({ queryKey: automationKeys.summary(orgId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Once the secret is revealed the dialog only closes via the explicit button, so it can't be dismissed by accident. */}
      <DialogContent size="md" hideClose={!!secret} onInteractOutside={(e) => secret && e.preventDefault()} onEscapeKeyDown={(e) => secret && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{secret ? "Copy your API key now" : "Create API key"}</DialogTitle>
          <DialogDescription>{secret ? "This is the only time the full key is shown. Store it in your POS, booking tool or Zapier." : "Keys can only send visits (scope visits:write). Name it after the system that will use it."}</DialogDescription>
        </DialogHeader>
        {secret ? (
          <div className="space-y-4">
            <div className="tech-corners rounded-lg border border-[color-mix(in_oklab,var(--primary)_40%,var(--border-strong))] bg-background p-3 shadow-[0_0_24px_-12px_var(--primary)]">
              <p className="micro-label mb-2">Secret · shown once</p>
              <code className="block break-all font-mono text-[12.5px] text-foreground" data-testid="api-key-secret">{secret}</code>
            </div>
            <InlineAlert variant="warning" icon={ShieldAlert} title="Treat it like a password">We store only a hash. If it leaks, revoke it and create a new one.</InlineAlert>
            <DialogFooter>
              <CopyButton text={secret} label="Copy key" className="h-9 px-4 text-sm" />
              <Button onClick={() => onOpenChange(false)}>I&apos;ve stored it</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) create.mutate(); }} className="space-y-4" noValidate>
            <FormField label="Key name" htmlFor="key-name" hint="e.g. Front desk POS, Zapier, Booking site">
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus placeholder="Front desk POS" />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}><KeyRound /> Create key</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApiKeysPanel() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const keys = useQuery({ queryKey: automationKeys.keys(orgId), queryFn: () => api.get<ApiKeyRow[]>("/automations/api-keys") });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/api-keys/${id}`),
    onSuccess: () => {
      toast.success("Key revoked — requests using it now fail with 401");
      qc.invalidateQueries({ queryKey: automationKeys.keys(orgId) });
      qc.invalidateQueries({ queryKey: automationKeys.summary(orgId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const active = (keys.data ?? []).filter((k) => !k.revoked_at);
  return (
    <Panel
      index="01"
      label="Credentials"
      title="API keys"
      icon={KeyRound}
      description="Authenticate visit ingestion from your systems. Rate limit: 120 visits per minute per key."
      actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Create key</Button>}
      flush
    >
      {keys.isError ? (
        <ErrorState message={errorMessage(keys.error)} onRetry={() => keys.refetch()} />
      ) : keys.isLoading ? (
        <div className="space-y-2 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !keys.data?.length ? (
        <EmptyState compact icon={KeyRound} title="No API keys" description="Create a key to send visits from a POS, booking tool or Zapier." />
      ) : (
        <ul className="divide-y divide-border">
          {keys.data.map((k) => (
            <li key={k.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", k.revoked_at && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13.5px] font-medium">
                  <StatusDot tone={k.revoked_at ? "idle" : k.last_used_at ? "live" : "signal"} />
                  <span className="truncate">{k.name}</span>
                </p>
                <p className="mt-0.5 font-mono text-[11.5px] text-subtle-foreground">rp_live_{k.prefix}…</p>
              </div>
              <div className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle-foreground sm:order-none sm:w-auto">
                <span title={k.created_at}>Created {fmtDateTime(k.created_at)}</span>
                <span title={k.last_used_at ?? undefined}>{k.last_used_at ? `Used ${fmtRelative(k.last_used_at)}` : "Never used"}</span>
              </div>
              {k.revoked_at ? (
                <Badge variant="neutral" size="sm" mono>Revoked</Badge>
              ) : (
                <ConfirmDialog
                  trigger={<Button variant="ghost" size="xs" className="text-danger-foreground hover:text-danger-foreground"><Trash2 /> Revoke</Button>}
                  title={`Revoke “${k.name}”?`}
                  description="Any system using this key will immediately get 401 errors. This can't be undone."
                  confirmLabel="Revoke key"
                  destructive
                  onConfirm={async () => { await revoke.mutateAsync(k.id); }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {keys.data && <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">{active.length} active · {keys.data.length - active.length} revoked</p>}
      <CreateKeyDialog open={open} onOpenChange={setOpen} />
    </Panel>
  );
}

// ------------------------------------------------------------------ ingestion docs

function IngestPanel() {
  const origin = useOrigin();
  const { locations } = useOrg();
  const endpoint = `${origin}/api/v1/automations/ingest/visits`;
  const slug = locations[0]?.slug ?? "your-location-slug";
  const curl = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer rp_live_YOUR_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "location_slug": "${slug}",
    "external_id": "receipt-10423",
    "occurred_at": "2026-11-10T13:05:00+05:30",
    "customer": { "name": "Priya Sharma", "phone": "+919876543210", "email": "priya@example.com", "language": "en" },
    "consent": { "whatsapp": true, "source": "pos_checkout", "text": "I agree to receive a feedback message about this visit on WhatsApp." }
  }'`;
  return (
    <Panel index="02" label="Endpoint" title="Send visits" icon={Terminal} description="POST one visit per request. Re-sending the same external_id is safe — it returns the existing event.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background-subtle/60 px-3 py-2">
          <span className="rounded-[4px] bg-primary-soft px-1.5 font-mono text-[10.5px] font-semibold text-primary-soft-foreground">POST</span>
          <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-foreground">{origin ? endpoint : "…"}</code>
          {origin && <CopyButton text={endpoint} label="Copy URL" />}
        </div>
        <CodeBlock code={curl} label="cURL" />
        <KVList
          items={[
            { label: "Auth", value: "Bearer rp_live_… or X-API-Key" },
            { label: "Location", value: "location_id or location_slug" },
            { label: "Idempotency", value: "external_id (per source)" },
            { label: "Consent", value: "only true is recorded, with source + text" },
            { label: "201 / 200", value: "created / duplicate" },
            { label: "401 · 404 · 422 · 429", value: "key · location · payload · rate" },
          ]}
        />
        <InlineAlert variant="info" title="Consent is never assumed">
          A phone number on a receipt isn&apos;t permission to message. Send <code className="font-mono text-[12px]">consent</code> only when the customer actually agreed — otherwise the visit is logged and skipped.
        </InlineAlert>
      </div>
    </Panel>
  );
}

function ZapierPanel() {
  const origin = useOrigin();
  return (
    <Panel index="04" label="No-code" title="Zapier" icon={Zap} description="Use “Webhooks by Zapier” to forward bookings or orders from any app Zapier supports.">
      <SetupSteps
        title="Webhooks by Zapier · POST"
        steps={[
          <>Create a Zap with your booking/POS app as the trigger (e.g. “Appointment completed”).</>,
          <>Add the action <span className="font-medium text-foreground">Webhooks by Zapier → POST</span>.</>,
          <>URL: <code className="break-all font-mono text-[11.5px] text-primary">{origin ? `${origin}/api/v1/automations/ingest/visits` : "…"}</code> · Payload type: <span className="font-mono">json</span>.</>,
          <>Data: <span className="font-mono">location_slug</span>, <span className="font-mono">external_id</span> (the booking id), <span className="font-mono">occurred_at</span>, <span className="font-mono">source</span> = <span className="font-mono">zapier</span>, and <span className="font-mono">customer__name</span> / <span className="font-mono">customer__phone</span> / <span className="font-mono">customer__email</span> (double underscore nests fields).</>,
          <>Headers: <span className="font-mono">Authorization</span> = <span className="font-mono">Bearer rp_live_…</span> (create a dedicated “Zapier” key above).</>,
          <>Only map <span className="font-mono">consent__whatsapp</span> / <span className="font-mono">consent__email</span> + <span className="font-mono">consent__source</span> + <span className="font-mono">consent__text</span> if your app records that the customer opted in.</>,
          <>Test the step — the visit appears in Activity within seconds.</>,
        ]}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ Shopify

const SHOPIFY_STATE: Record<string, { label: string; tone: "ok" | "warn" | "idle" }> = {
  connected: { label: "Receiving signed webhooks", tone: "ok" },
  pending_authorization: { label: "Saved · waiting for the first signed webhook", tone: "warn" },
  not_connected: { label: "Not set up", tone: "idle" },
};

function ShopifyPanel() {
  const { orgId, locations } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: automationKeys.shopify(orgId), queryFn: () => api.get<ShopifyStatus>("/automations/shopify") });
  const [secret, setSecret] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [domain, setDomain] = React.useState("");
  React.useEffect(() => {
    if (q.data) {
      setLocationId(q.data.location_id ?? locations[0]?.id ?? "");
      setDomain(q.data.shop_domain ?? "");
    }
  }, [q.data, locations]);
  const save = useMutation({
    mutationFn: () => api.put<ShopifyStatus>("/automations/shopify", { webhook_secret: secret.trim() || null, location_id: locationId, shop_domain: domain.trim() || null }),
    onSuccess: (d) => {
      qc.setQueryData(automationKeys.shopify(orgId), d);
      setSecret("");
      toast.success("Shopify settings saved — status turns connected after the first signed webhook");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/automations/shopify"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.shopify(orgId) });
      toast.success("Shopify disconnected — its webhooks will now be rejected");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = q.data;
  const state = SHOPIFY_STATE[d?.status ?? "not_connected"] ?? SHOPIFY_STATE.not_connected;
  const domainError = domain && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain.trim()) ? "Use the store's myshopify.com domain" : undefined;
  const secretError = secret && secret.trim().length < 16 ? "That looks too short for a Shopify signing secret" : undefined;
  return (
    <Panel
      index="03"
      label="Commerce"
      title="Shopify orders"
      icon={ShoppingBag}
      description="Official order webhooks (orders/paid, orders/fulfilled), verified with Shopify's HMAC signature. One request per order."
      actions={d && <StatusBadge status={d.status} size="md" />}
    >
      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="space-y-4">
          {d.configured && (
            <p className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              <StatusDot tone={state.tone} pulse={d.status === "connected"} /> {state.label}
              {d.last_verified_at && <span className="text-subtle-foreground">· last {fmtRelative(d.last_verified_at)}</span>}
            </p>
          )}
          {d.last_error && <InlineAlert variant="warning" title="Webhook received but not processed">{d.last_error}</InlineAlert>}
          <div className="space-y-1.5">
            <span className="micro-label">Webhook URL</span>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background-subtle/60 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-foreground">{d.webhook_url}</code>
              <CopyButton text={d.webhook_url} label="Copy URL" />
            </div>
          </div>
          <SetupSteps
            steps={[
              <>In Shopify admin open <span className="font-medium text-foreground">Settings → Notifications → Webhooks</span>.</>,
              <>Create webhooks for <span className="font-mono">Order payment</span> (orders/paid) and/or <span className="font-mono">Order fulfillment</span> (orders/fulfilled), format JSON, with the URL above.</>,
              <>Copy the signing secret Shopify shows on that page (“Your webhooks will be signed with…”) and paste it below.</>,
            ]}
          />
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
            <FormField className="sm:col-span-2" label="Webhook signing secret" htmlFor="shopify-secret" error={secretError} hint={d.secret_hint ? `Stored encrypted · ${d.secret_hint} — leave blank to keep` : "Stored encrypted, never shown again"}>
              <Input id="shopify-secret" type="password" autoComplete="off" className="font-mono" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={d.secret_hint ?? "Paste from Shopify"} invalid={!!secretError} />
            </FormField>
            <FormField label="Orders count as visits at">
              <Select value={locationId || undefined} onValueChange={setLocationId}>
                <SelectTrigger aria-label="Shopify location"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Shop domain (optional)" htmlFor="shopify-domain" error={domainError}>
              <Input id="shopify-domain" className="font-mono" value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} placeholder="your-store.myshopify.com" invalid={!!domainError} />
            </FormField>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" size="sm" loading={save.isPending} disabled={!locationId || (!secret.trim() && !d.configured) || !!domainError || !!secretError}>{d.configured ? "Save changes" : "Save & start listening"}</Button>
              {d.configured && (
                <ConfirmDialog
                  trigger={<Button type="button" variant="ghost" size="sm" className="text-danger-foreground hover:text-danger-foreground"><Trash2 /> Remove</Button>}
                  title="Disconnect Shopify?"
                  description="The signing secret is deleted and further Shopify webhooks are rejected. Recorded visits stay in the log."
                  confirmLabel="Disconnect"
                  destructive
                  onConfirm={async () => { await remove.mutateAsync(); }}
                />
              )}
            </div>
          </form>
          <InlineAlert variant="info" title="How consent is read from orders">
            Only the customer&apos;s recorded Shopify <span className="font-mono text-[12px]">email_marketing_consent</span> / <span className="font-mono text-[12px]">sms_marketing_consent</span> with state <span className="font-mono text-[12px]">subscribed</span> counts, for that channel only. WhatsApp is never inferred, and orders without consent are logged and skipped.
          </InlineAlert>
        </div>
      )}
    </Panel>
  );
}

export function ConnectTab() {
  const { can } = useOrg();
  const manage = can("integrations.manage");
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className="min-w-0 space-y-5">
        {manage ? <ApiKeysPanel /> : <Panel title="API keys" icon={KeyRound}><ReadOnlyNotice message="Only owners and admins can create or revoke API keys." /></Panel>}
        <IngestPanel />
      </div>
      <div className="min-w-0 space-y-5">
        {manage ? <ShopifyPanel /> : <Panel title="Shopify orders" icon={ShoppingBag}><ReadOnlyNotice message="Only owners and admins can connect Shopify." /></Panel>}
        <ZapierPanel />
      </div>
    </div>
  );
}
