"use client";
/** Delivery controls (opt-in, org toggle, test send) and the sandboxed email preview. */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, MonitorSmartphone, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { KVList, Panel, SlideToggle } from "@/components/console/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DigestSettings } from "./types";

export function useDigestSettings(orgId: string) {
  return useQuery({ queryKey: ["digest", "settings", orgId], queryFn: () => api.get<DigestSettings>("/digest/settings") });
}

export function useSendTest(params: { week_end?: string; location_id?: string }) {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; sent_to: string }>("/digest/send-test", params),
    onSuccess: (r) => (r.ok ? toast.success(`Test digest sent to ${r.sent_to}`) : toast.error("The email provider rejected the test digest.")),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function ToggleRow({ id, title, description, checked, onChange, disabled, note }: { id: string; title: string; description: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; note?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13.5px] font-medium text-foreground">{title}</label>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
        {note && <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">{note}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

export function DeliveryPanel({ orgId, sendTest }: { orgId: string; sendTest: ReturnType<typeof useSendTest> }) {
  const qc = useQueryClient();
  const q = useDigestSettings(orgId);
  const save = useMutation({
    mutationFn: (body: { email_enabled?: boolean; org_enabled?: boolean }) => api.put<DigestSettings>("/digest/settings", body),
    onMutate: async (body) => {
      const key = ["digest", "settings", orgId];
      const prev = qc.getQueryData<DigestSettings>(key);
      if (prev) qc.setQueryData(key, { ...prev, ...body });
      return { prev };
    },
    onSuccess: (d) => {
      qc.setQueryData(["digest", "settings", orgId], d);
      toast.success("Digest settings saved");
    },
    onError: (e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData(["digest", "settings", orgId], ctx.prev);
      toast.error(errorMessage(e));
    },
  });
  const s = q.data;
  return (
    <Panel id="settings" index="08" label="Delivery" title="Weekly email" icon={Mail} description="The digest is emailed every Monday morning and also appears in your notifications.">
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : q.error || !s ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} className="py-6" />
      ) : (
        <div className="space-y-5">
          <div className="divide-y divide-border">
            <ToggleRow
              id="digest-email" title="Email me this digest" checked={s.email_enabled} onChange={(v) => save.mutate({ email_enabled: v })}
              description={<>Sent to <span className="font-mono text-foreground-soft">{s.email}</span>. Scoped to the locations you can access.</>}
              note={s.is_default ? `Default for your role · ${s.default_email_enabled ? "on" : "off"}` : "Your choice"}
            />
            {s.can_manage_org ? (
              <ToggleRow
                id="digest-org" title="Weekly digest for this organization" checked={s.org_enabled} onChange={(v) => save.mutate({ org_enabled: v })}
                description="Owner control. When off, nobody in this organization receives the weekly email or notification."
              />
            ) : (
              !s.org_enabled && <p className="py-3.5 text-[12.5px] text-warning-foreground">The owner has turned the weekly digest off for this organization.</p>
            )}
          </div>
          <KVList
            items={[
              { label: "Schedule", value: s.schedule },
              { label: "Last delivered", value: s.last_sent_at ? `${s.last_sent_week} · ${format(new Date(s.last_sent_at), "d MMM, HH:mm")}` : "Not yet sent" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" loading={sendTest.isPending} onClick={() => sendTest.mutate()}><Send /> Send me a test</Button>
            <span className="text-[12px] text-muted-foreground">Sends the digest shown on this page to you only.</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ email preview */

export function EmailPreview({ params, orgId }: { params: { week_end?: string; location_id?: string }; orgId: string }) {
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const q = useQuery({
    queryKey: ["digest", "preview-html", orgId, params],
    queryFn: async () => (await api.raw("/digest/preview.html", { query: params })).text(),
  });
  return (
    <Panel
      index="09" label="Rendered email" title="Email preview" icon={MonitorSmartphone} flush
      description="Exactly what recipients receive. Rendered in a sandboxed frame with scripts disabled."
      actions={
        <SlideToggle
          id="digest-device" label="Preview width" size="sm" value={device} onChange={setDevice}
          options={[{ value: "desktop", label: <><MonitorSmartphone className="size-3.5" />Desktop</> }, { value: "mobile", label: <><Smartphone className="size-3.5" />Mobile</> }]}
        />
      }
    >
      <div className="flex items-center gap-2 border-b border-border bg-background-subtle/60 px-5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground">
        <StatusDot tone={q.isFetching ? "signal" : q.error ? "error" : "ok"} pulse={q.isFetching} />
        {q.isFetching ? "Rendering" : q.error ? "Render failed" : "Rendered from live data"}
      </div>
      <div className="bg-[color-mix(in_oklab,var(--background-subtle)_70%,transparent)] p-3 sm:p-6">
        {q.isLoading ? (
          <Skeleton className="mx-auto h-[720px] max-w-[640px]" />
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <iframe
            title="Weekly digest email preview"
            sandbox=""
            srcDoc={q.data}
            className={cn("mx-auto block h-[1500px] w-full rounded-lg border border-border bg-white transition-[max-width] duration-300", device === "mobile" ? "max-w-[390px]" : "max-w-[640px]")}
          />
        )}
      </div>
    </Panel>
  );
}
