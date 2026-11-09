"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FlaskConical, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { IntegrationCard, KV, KVGroup, SetupSteps, StateRail } from "./shell";

interface WAStatus {
  status: string; phone_number_id: string | null; business_account_id: string | null; display: string | null; access_token_masked: string | null;
  last_error: string | null; webhook_url: string; demo_mode: boolean;
  templates: { id: string; name: string; provider_template_name: string | null; status: string | null; language: string }[];
  remote_templates: { name: string; status: string; language: string; category: string }[];
}

function CopyField({ value }: { value: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background-subtle px-2.5 py-1.5 font-mono text-[11.5px] text-foreground-soft">{value}</code>
      <Button variant="ghost" size="icon-xs" aria-label="Copy" onClick={async () => { await navigator.clipboard.writeText(value).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? <Check className="text-success" /> : <Copy />}</Button>
    </div>
  );
}

export function WhatsAppCard() {
  const { orgId, can } = useOrg();
  const manage = can("integrations.manage");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", "whatsapp", orgId], queryFn: () => api.get<WAStatus>("/integrations/whatsapp") });
  const [form, setForm] = React.useState({ phone_number_id: "", business_account_id: "", access_token: "" });
  const [editing, setEditing] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (q.data) setForm((f) => ({ ...f, phone_number_id: q.data!.phone_number_id ?? "", business_account_id: q.data!.business_account_id ?? "" })); }, [q.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });
  const save = useMutation({
    mutationFn: () => api.put("/integrations/whatsapp", form),
    onSuccess: () => { toast.success("WhatsApp connected and verified with Meta"); setEditing(false); setErr(null); setForm((f) => ({ ...f, access_token: "" })); refresh(); },
    onError: (e) => { setErr(errorMessage(e)); refresh(); },
  });
  const syncT = useMutation({ mutationFn: () => api.post<{ templates: number }>("/integrations/whatsapp/templates/sync"), onSuccess: (r) => { toast.success(`${r.templates} templates synced from Meta`); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });

  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  const s = q.data!;
  const connected = s.status === "connected";
  const showForm = manage && (!connected || editing);
  const valid = /^\d{6,30}$/.test(form.phone_number_id) && /^\d{6,30}$/.test(form.business_account_id) && form.access_token.length >= 20;

  return (
    <IntegrationCard
      icon={<WhatsAppIcon />}
      name="WhatsApp Cloud API"
      code="Meta · Cloud API · Templates"
      tagline="Send approved-template review requests from your own WhatsApp Business number."
      status={s.status}
      footer={manage && connected && !editing && (
        <>
          <Button size="sm" variant="outline" loading={syncT.isPending} onClick={() => syncT.mutate()}><RefreshCw /> Sync templates</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Update credentials</Button>
          <ConfirmDialog destructive title="Disconnect WhatsApp?" description="Stored credentials are deleted. WhatsApp campaigns will stop sending." confirmLabel="Disconnect"
            onConfirm={async () => { try { await api.delete("/integrations/whatsapp"); toast.success("WhatsApp disconnected"); refresh(); } catch (e) { toast.error(errorMessage(e)); } }}
            trigger={<Button size="sm" variant="ghost" className="ml-auto text-danger-foreground"><Unplug /> Disconnect</Button>} />
        </>
      )}
    >
      <StateRail status={s.status} />
      {s.demo_mode && !connected && (
        <InlineAlert variant="primary" icon={FlaskConical}>Demo mode: WhatsApp campaigns are simulated and nothing is sent until you connect real credentials.</InlineAlert>
      )}
      {connected && !editing && (
        <KVGroup>
          <KV label="Number" value={s.display} mono />
          <KV label="Phone number ID" value={s.phone_number_id} mono />
          <KV label="Access token" value={s.access_token_masked} mono />
        </KVGroup>
      )}
      {s.last_error && <InlineAlert variant="danger" title="Meta rejected the credentials">{s.last_error}</InlineAlert>}
      {showForm && !connected && (
        <SetupSteps
          steps={[
            "In Meta Business Suite, add a WhatsApp Business number to a Cloud API app.",
            "Create a system user with the whatsapp_business_messaging permission and generate a permanent token.",
            "Paste the phone number ID, business account ID and token below — we verify them with Meta before saving.",
            "Add the webhook URL below in Meta → Configuration to receive delivery receipts.",
          ]}
        />
      )}
      {showForm && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Phone number ID" htmlFor="wa-pn"><Input id="wa-pn" inputMode="numeric" value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value.trim() })} placeholder="1098765432101234" /></FormField>
            <FormField label="Business account ID" htmlFor="wa-ba"><Input id="wa-ba" inputMode="numeric" value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value.trim() })} placeholder="2034567890123456" /></FormField>
          </div>
          <FormField label="Permanent access token" htmlFor="wa-tok" hint={s.access_token_masked ? `Current: ${s.access_token_masked} — enter a new token to replace it` : "System-user token with whatsapp_business_messaging permission. Stored encrypted."}>
            <Input id="wa-tok" type="password" autoComplete="off" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value.trim() })} placeholder="EAAG…" />
          </FormField>
          {err && !s.last_error && <p className="text-xs font-medium text-danger-foreground">{err}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!valid} loading={save.isPending}>Verify & connect</Button>
            {editing && <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>
      )}
      <div>
        <p className="micro-label mb-1.5">Webhook callback URL · Meta → Configuration</p>
        <CopyField value={s.webhook_url} />
      </div>
      {(s.templates.length > 0 || s.remote_templates.length > 0) && (
        <div>
          <p className="micro-label mb-2">Message templates</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(s.remote_templates.length ? s.remote_templates.map((t) => ({ key: t.name + t.language, name: t.name, lang: t.language, status: t.status?.toLowerCase() })) : s.templates.map((t) => ({ key: t.id, name: t.provider_template_name ?? t.name, lang: t.language, status: t.status }))).map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 truncate font-mono text-xs">{t.name} <span className="text-muted-foreground">· {t.lang}</span></span>
                <StatusBadge status={t.status === "approved" ? "active" : t.status ?? "pending"} />
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-subtle-foreground">Business-initiated WhatsApp messages require templates approved by Meta.</p>
        </div>
      )}
    </IntegrationCard>
  );
}
