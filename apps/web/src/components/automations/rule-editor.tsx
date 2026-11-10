"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageSquare, Sparkles } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { Segmented } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { RuleFlow } from "./flow";
import { type Rule, type RuleChannel, automationKeys, formatDelay, hasQuiet, hh } from "./types";

interface Template { id: string; name: string; channel: string; language: string; subject: string | null; body: string; is_system: boolean }
interface PreviewOut { subject: string | null; body: string; link: string; characters: number }

const DEFAULT_BODY = "Hi {{name}}, thank you for visiting {{business}} today! We'd love your honest feedback — it takes a minute: {{link}}";
const PLACEHOLDERS = ["{{name}}", "{{business}}", "{{location}}", "{{link}}"];
const BANNED = ["discount for", "free gift", "coupon for review", "in exchange for", "5-star", "five star", "5 star"];
const DELAYS = [
  { value: "0", label: "Now" },
  { value: "30", label: "30m" },
  { value: "120", label: "2h" },
  { value: "1440", label: "1d" },
  { value: "4320", label: "3d" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function bodyError(body: string) {
  if (!body.trim()) return "Write a message or pick a template";
  if (body.trim().length < 10) return "Message is too short";
  if (!body.includes("{{link}}")) return "Include the {{link}} placeholder — it's the tracked feedback link";
  const lower = body.toLowerCase();
  if (BANNED.some((b) => lower.includes(b))) return "Review requests can't offer incentives or ask only for positive reviews";
  return null;
}

/** Message bubble rendered from POST /campaigns/preview (server-side placeholder rendering). */
function LivePreview({ locationId, channel, body }: { locationId: string | null; channel: RuleChannel; body: string }) {
  const debounced = useDebounced(body);
  const previewChannel = channel === "auto" ? "whatsapp" : channel;
  const valid = !!locationId && !bodyError(debounced);
  const q = useQuery({
    queryKey: ["campaigns", "preview", locationId, previewChannel, debounced],
    queryFn: () => api.post<PreviewOut>("/campaigns/preview", { location_id: locationId, channel: previewChannel, body: debounced }),
    enabled: valid,
    placeholderData: (p) => p,
  });
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background-subtle/70 px-4 py-2.5">
        <span className="micro-label">Live preview · {channel === "auto" ? "WhatsApp (auto)" : previewChannel}</span>
        {q.data && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{q.data.characters} chars</span>}
      </div>
      <div className="relative bg-background-subtle/40 p-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-60" />
        {!locationId ? (
          <p className="relative text-[12.5px] text-muted-foreground">Add a location to preview the message.</p>
        ) : !valid ? (
          <p className="relative text-[12.5px] text-muted-foreground">{bodyError(debounced)}</p>
        ) : q.isError ? (
          <InlineAlert variant="danger" className="relative" title="Preview failed">{errorMessage(q.error)}</InlineAlert>
        ) : !q.data ? (
          <Skeleton className="relative h-24 rounded-lg" />
        ) : (
          <div className={cn("relative max-w-[340px] rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm", previewChannel === "email" ? "border-border-strong bg-card" : "rounded-tl-sm border-[color-mix(in_oklab,var(--mint)_22%,var(--border))] bg-[color-mix(in_oklab,var(--mint)_8%,var(--card))]")}>
            <p className="whitespace-pre-wrap break-words text-foreground">
              {q.data.body.split(q.data.link).map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="break-all text-primary underline underline-offset-2">{q.data.link}</span>}
                </React.Fragment>
              ))}
            </p>
            <p className="mt-1.5 text-right font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">Sample · Priya Sharma</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function RuleEditorDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule?: Rule | null }) {
  const { orgId, locations } = useOrg();
  const qc = useQueryClient();
  const editing = !!rule;
  const [name, setName] = React.useState("");
  const [locationId, setLocationId] = React.useState<string>("all");
  const [channel, setChannel] = React.useState<RuleChannel>("auto");
  const [mode, setMode] = React.useState<"write" | "template">("write");
  const [templateId, setTemplateId] = React.useState<string>("");
  const [body, setBody] = React.useState(DEFAULT_BODY);
  const [delay, setDelay] = React.useState(120);
  const [quietOn, setQuietOn] = React.useState(true);
  const [quiet, setQuiet] = React.useState({ start: 21, end: 9 });
  const [cooldown, setCooldown] = React.useState(30);
  const [enabled, setEnabled] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setTouched(false);
    setName(rule?.name ?? "Post-visit review request");
    setLocationId(rule?.location_id ?? "all");
    setChannel(rule?.channel ?? "auto");
    setMode(rule?.template_id && !rule.message_body ? "template" : "write");
    setTemplateId(rule?.template_id ?? "");
    setBody(rule?.message_body ?? DEFAULT_BODY);
    setDelay(rule?.delay_minutes ?? 120);
    const q = rule?.quiet_hours;
    setQuietOn(rule ? hasQuiet(q) : true);
    setQuiet(hasQuiet(q) ? { start: q.start, end: q.end } : { start: 21, end: 9 });
    setCooldown(rule?.cooldown_days ?? 30);
    setEnabled(rule?.enabled ?? true);
  }, [open, rule]);

  const templates = useQuery({ queryKey: ["campaigns", "templates", orgId], queryFn: () => api.get<Template[]>("/campaigns/templates"), enabled: open });
  const usable = (templates.data ?? []).filter((t) => t.channel !== "qr" && (channel === "auto" || t.channel === channel));
  const template = usable.find((t) => t.id === templateId) ?? null;
  const effectiveBody = mode === "template" ? template?.body ?? "" : body;
  const previewLocation = locationId !== "all" ? locationId : locations[0]?.id ?? null;
  const tz = locations.find((l) => l.id === previewLocation)?.timezone;

  const nameError = name.trim().length < 2 ? "Give the rule a name" : null;
  const msgError = mode === "template" ? (template ? null : "Pick a template") : bodyError(body);
  const delayError = delay < 0 || delay > 10080 || !Number.isFinite(delay) ? "Between 0 and 10,080 minutes (7 days)" : null;
  const cooldownError = cooldown < 0 || cooldown > 365 || !Number.isFinite(cooldown) ? "Between 0 and 365 days" : null;
  const invalid = !!(nameError || msgError || delayError || cooldownError);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        location_id: locationId === "all" ? null : locationId,
        channel,
        template_id: mode === "template" ? templateId : null,
        message_body: mode === "write" ? body.trim() : null,
        delay_minutes: delay,
        quiet_hours: quietOn && quiet.start !== quiet.end ? quiet : null,
        cooldown_days: cooldown,
        enabled,
      };
      return editing ? api.patch<Rule>(`/automations/rules/${rule!.id}`, payload) : api.post<Rule>("/automations/rules", payload);
    },
    onSuccess: (r) => {
      toast.success(editing ? `“${r.name}” updated` : `“${r.name}” created${r.enabled ? " and live" : ""}`);
      qc.invalidateQueries({ queryKey: automationKeys.all });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 402 ? "WhatsApp review requests aren't included in your plan. Choose Auto, email or SMS — or upgrade." : errorMessage(e)),
  });

  const insert = (token: string) => {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit automation rule" : "New automation rule"}</DialogTitle>
          <DialogDescription>When a visit is recorded, send one review request — only to customers who agreed to hear from you.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!invalid) save.mutate();
          }}
        >
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Rule name" htmlFor="rule-name" error={touched ? nameError ?? undefined : undefined} required>
                <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} invalid={touched && !!nameError} />
              </FormField>
              <FormField label="Applies to" hint={locationId === "all" ? "A location-specific rule takes priority" : undefined}>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Channel" hint={channel === "auto" ? "First channel with consent, preferring WhatsApp" : channel === "whatsapp" ? "Requires a plan with WhatsApp review requests" : undefined}>
              <Segmented
                id="rule-channel"
                ariaLabel="Channel"
                fill
                value={channel}
                onChange={(v) => { setChannel(v); setTemplateId(""); }}
                options={[
                  { value: "auto", label: "Auto", icon: Sparkles },
                  { value: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
                  { value: "email", label: "Email", icon: Mail },
                  { value: "sms", label: "SMS", icon: MessageSquare },
                ]}
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Message</span>
                <Segmented id="rule-msg-mode" size="sm" ariaLabel="Message source" value={mode} onChange={setMode} options={[{ value: "write", label: "Write" }, { value: "template", label: "Template" }]} />
              </div>
              {mode === "write" ? (
                <>
                  <Textarea ref={bodyRef} id="rule-body" aria-label="Message body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} invalid={touched && !!msgError} className="font-[450]" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="micro-label mr-1">Insert</span>
                    {PLACEHOLDERS.map((p) => (
                      <button key={p} type="button" onClick={() => insert(p)} className="rounded-[5px] border border-border bg-background-subtle px-1.5 py-0.5 font-mono text-[10.5px] text-foreground-soft transition hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring">
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              ) : templates.isLoading ? (
                <Skeleton className="h-10" />
              ) : (
                <Select value={templateId || undefined} onValueChange={setTemplateId}>
                  <SelectTrigger aria-label="Template" aria-invalid={touched && !!msgError}><SelectValue placeholder={usable.length ? "Choose a template" : "No templates for this channel"} /></SelectTrigger>
                  <SelectContent>
                    {usable.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.channel}{t.is_system ? " · system" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {touched && msgError && <p className="text-xs font-medium text-danger-foreground" role="alert">{msgError}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Wait after the visit" htmlFor="rule-delay" error={delayError ?? undefined} hint={delayError ? undefined : formatDelay(delay)}>
                <div className="space-y-2">
                  <Input id="rule-delay" type="number" inputMode="numeric" min={0} max={10080} value={Number.isFinite(delay) ? delay : ""} onChange={(e) => setDelay(e.target.value === "" ? NaN : Number(e.target.value))} trailing={<span className="pr-1 font-mono text-[10.5px] uppercase text-subtle-foreground">min</span>} invalid={!!delayError} />
                  <Segmented id="rule-delay-presets" size="sm" mono ariaLabel="Delay presets" value={DELAYS.find((d) => Number(d.value) === delay)?.value ?? ("custom" as string)} onChange={(v) => setDelay(Number(v))} options={DELAYS} />
                </div>
              </FormField>
              <FormField label="Cooldown per customer" htmlFor="rule-cooldown" error={cooldownError ?? undefined} hint={cooldownError ? undefined : cooldown ? `Skip if they got any request in ${cooldown} days` : "No cooldown"}>
                <Input id="rule-cooldown" type="number" inputMode="numeric" min={0} max={365} value={Number.isFinite(cooldown) ? cooldown : ""} onChange={(e) => setCooldown(e.target.value === "" ? NaN : Number(e.target.value))} trailing={<span className="pr-1 font-mono text-[10.5px] uppercase text-subtle-foreground">days</span>} invalid={!!cooldownError} />
              </FormField>
            </div>

            <div className="rounded-lg border border-border">
              <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">Quiet hours</span>
                  <span className="block text-xs text-muted-foreground">No messages overnight — in each location&apos;s own timezone</span>
                </span>
                <Switch checked={quietOn} onCheckedChange={setQuietOn} aria-label="Quiet hours" />
              </label>
              {quietOn && (
                <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-3">
                  {(["start", "end"] as const).map((k) => (
                    <FormField key={k} label={k === "start" ? "From" : "Until"}>
                      <Select value={String(quiet[k])} onValueChange={(v) => setQuiet((q) => ({ ...q, [k]: Number(v) }))}>
                        <SelectTrigger className="font-mono" aria-label={k === "start" ? "Quiet hours start" : "Quiet hours end"}><SelectValue /></SelectTrigger>
                        <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)} className="font-mono">{hh(h)}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                  ))}
                  {quiet.start === quiet.end && <p className="col-span-2 text-xs text-warning-foreground">Start and end are the same — quiet hours will be off.</p>}
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <span>
                <span className="block text-[13px] font-medium">Rule enabled</span>
                <span className="block text-xs text-muted-foreground">New visits are matched only while enabled</span>
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Rule enabled" />
            </label>
          </div>

          <div className="min-w-0 space-y-4">
            <LivePreview locationId={previewLocation} channel={channel} body={effectiveBody} />
            <RuleFlow channel={channel} delay={Number.isFinite(delay) ? delay : 0} quiet={quietOn ? quiet : null} cooldown={Number.isFinite(cooldown) ? cooldown : 0} timezone={tz} />
          </div>

          <DialogFooter className="lg:col-span-2 mt-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{editing ? "Save changes" : "Create rule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
