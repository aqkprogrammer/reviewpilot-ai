"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { OpenAIIcon } from "@/components/brand/brand-icons";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { IntegrationCard, KV } from "./shell";

interface EmailStatus { provider: string; configured: boolean; from_address: string; sender: { from_name?: string; reply_to?: string | null }; delivery: { mode: string; note?: string } }

export function EmailCard() {
  const { orgId, can, me } = useOrg();
  const manage = can("integrations.manage");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", "email", orgId], queryFn: () => api.get<EmailStatus>("/integrations/email") });
  const [fromName, setFromName] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [testTo, setTestTo] = React.useState(me.user.email);
  React.useEffect(() => { if (q.data) { setFromName(q.data.sender.from_name ?? ""); setReplyTo(q.data.sender.reply_to ?? ""); } }, [q.data]);
  const save = useMutation({ mutationFn: () => api.put("/integrations/email", { from_name: fromName, reply_to: replyTo || null }), onSuccess: () => { toast.success("Sender identity saved"); qc.invalidateQueries({ queryKey: ["integrations"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const test = useMutation({
    mutationFn: () => api.post<{ simulated: boolean }>("/integrations/email/test", { to: testTo }),
    onSuccess: (r) => toast.success(r.simulated ? "Test email logged to the dev outbox (no provider configured)" : `Test email sent to ${testTo}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  const s = q.data!;
  return (
    <IntegrationCard icon={<Mail className="text-primary" />} name="Email (Resend)" tagline="Branded review-request emails with unsubscribe links and delivery tracking." status={s.configured ? "connected" : s.delivery.mode === "simulated" ? "simulated" : "not_configured"}>
      {!s.configured && <InlineAlert variant="info">RESEND_API_KEY isn't set on this server{s.delivery.mode === "simulated" ? " — emails are logged to the development outbox instead of being delivered." : "."}</InlineAlert>}
      <KV label="Sending address" value={s.from_address} mono />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Sender name" htmlFor="em-name"><Input id="em-name" value={fromName} disabled={!manage} onChange={(e) => setFromName(e.target.value)} /></FormField>
        <FormField label="Reply-to" htmlFor="em-reply"><Input id="em-reply" type="email" value={replyTo} disabled={!manage} onChange={(e) => setReplyTo(e.target.value)} placeholder="hello@yourbusiness.com" /></FormField>
      </div>
      {manage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Button size="sm" variant="outline" disabled={fromName.length < 2} loading={save.isPending} onClick={() => save.mutate()}>Save sender</Button>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Input aria-label="Test recipient" className="h-8 sm:max-w-56" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Button size="sm" variant="soft" loading={test.isPending} onClick={() => test.mutate()}><Send /> Send test</Button>
          </div>
        </div>
      )}
    </IntegrationCard>
  );
}

interface Overview { sms: { status: string; delivery: { mode: string } }; openai: { status: string; model: string | null } }

export function SmsCard({ data }: { data?: Overview["sms"] }) {
  return (
    <IntegrationCard icon={<MessageCircle className="text-cyan" />} name="SMS" tagline="Provider-agnostic SMS adapter (Twilio built in). Each market needs a compliant, registered sender." status={data?.status === "connected" ? "connected" : data?.delivery.mode === "simulated" ? "simulated" : "not_configured"}>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {data?.status === "connected" ? "SMS review requests are available in campaigns." : "Not configured. In India, SMS requires DLT registration of your sender ID and templates; add a provider's credentials on the server (TWILIO_*) once registered."}
      </p>
    </IntegrationCard>
  );
}

export function OpenAICard({ data }: { data?: Overview["openai"] }) {
  const on = data?.status === "connected";
  return (
    <IntegrationCard icon={on ? <OpenAIIcon /> : <Cpu className="text-primary" />} name="OpenAI" tagline="Powers AI replies, sentiment and insights. Keys stay on the server." status={on ? "connected" : "not_configured"}>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{on ? `Using ${data?.model}.` : "No OPENAI_API_KEY — the AI Assistant uses the offline heuristic engine and labels its output accordingly."}</p>
    </IntegrationCard>
  );
}
