"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, BellRing, CalendarClock, Check, CheckCheck, FileText, Lock, MapPin, Rocket, Save, Sparkles, Tag, Users, Wand2, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { StatusDot, TechFrame } from "@/components/ui/tech";
import { Segmented, choiceClass } from "@/components/dashboard/kit";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CHANNEL_META, ChannelIcon, type Campaign } from "./shared";
import { MessagePreview } from "./message-preview";

const schema = z
  .object({
    name: z.string().trim().min(2, "Give the campaign a name").max(160),
    location_id: z.string().min(1, "Choose a location"),
    channel: z.enum(["whatsapp", "email", "sms", "qr"]),
    template_id: z.string().optional(),
    message_subject: z.string().max(255).optional(),
    message_body: z.string().max(1500).optional(),
    audience_mode: z.enum(["all", "tags"]),
    tags: z.array(z.string()),
    send_mode: z.enum(["now", "schedule"]),
    schedule_at: z.string().optional(),
    reminder_enabled: z.boolean(),
    reminder_after_hours: z.number().min(12).max(336),
    max_reminders: z.number().min(0).max(2),
  })
  .superRefine((v, ctx) => {
    if (v.channel !== "qr") {
      if (!v.message_body || v.message_body.trim().length < 10) ctx.addIssue({ code: "custom", path: ["message_body"], message: "Write a message (at least 10 characters)" });
      else if (!v.message_body.includes("{{link}}")) ctx.addIssue({ code: "custom", path: ["message_body"], message: "Include the {{link}} placeholder so customers can reach your feedback page" });
      if (v.channel === "email" && !v.message_subject?.trim()) ctx.addIssue({ code: "custom", path: ["message_subject"], message: "Add an email subject" });
      if (v.audience_mode === "tags" && !v.tags.length) ctx.addIssue({ code: "custom", path: ["tags"], message: "Pick at least one tag" });
    }
    if (v.send_mode === "schedule") {
      if (!v.schedule_at) ctx.addIssue({ code: "custom", path: ["schedule_at"], message: "Pick a date and time" });
      else if (new Date(v.schedule_at) <= new Date()) ctx.addIssue({ code: "custom", path: ["schedule_at"], message: "Schedule a time in the future" });
    }
  });

type Values = z.infer<typeof schema>;

const STEPS = [
  { title: "Name", desc: "What is this campaign for?", fields: ["name"] },
  { title: "Location", desc: "Which branch are you asking about?", fields: ["location_id"] },
  { title: "Channel", desc: "How will customers hear from you?", fields: ["channel"] },
  { title: "Message", desc: "Template, wording and audience", fields: ["message_body", "message_subject", "tags"] },
  { title: "Schedule", desc: "Timing and reminders", fields: ["schedule_at", "reminder_after_hours", "max_reminders"] },
  { title: "Preview", desc: "See what customers receive", fields: [] },
  { title: "Launch", desc: "Review and go live", fields: [] },
] as const;

interface ChannelStatus { channel: string; mode: "live" | "simulated" | "unavailable"; ready: boolean; note?: string }
interface Template { id: string; name: string; channel: string; language: string; subject: string | null; body: string; provider_template_name: string | null; provider_status: string | null; is_system: boolean }

export function CampaignWizard() {
  const router = useRouter();
  const { orgId, locations, locationId, membership } = useOrg();
  const [step, setStep] = React.useState(0);
  const reduce = useReducedMotion();
  const [apiError, setApiError] = React.useState<{ message: string; code: string } | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "", location_id: locationId ?? locations[0]?.id ?? "", channel: "whatsapp", template_id: undefined, message_subject: "", message_body: "",
      audience_mode: "all", tags: [], send_mode: "now", schedule_at: "", reminder_enabled: true, reminder_after_hours: 48, max_reminders: 1,
    },
  });
  const { register, setValue, control, trigger, formState: { errors } } = form;
  const v = useWatch({ control }) as Values;

  React.useEffect(() => {
    if (!form.getValues("location_id") && locations[0]) setValue("location_id", locations[0].id);
  }, [locations, form, setValue]);

  const channels = useQuery({ queryKey: ["campaigns", "channels", orgId], queryFn: () => api.get<ChannelStatus[]>("/campaigns/channels") });
  const templates = useQuery({
    queryKey: ["campaigns", "templates", orgId, v.channel],
    queryFn: () => api.get<Template[]>("/campaigns/templates", { channel: v.channel }),
    enabled: v.channel !== "qr",
  });
  const tags = useQuery({ queryKey: ["customers", "tags", orgId], queryFn: () => api.get<string[]>("/customers/tags") });

  const genTemplate = useMutation({
    mutationFn: (language: string) => api.post<{ subject: string | null; body: string; notes: string; provider: string }>("/ai/templates", { purpose: "review_request", channel: v.channel, language, tone: "friendly" }),
    onSuccess: (t) => {
      setValue("message_body", t.body, { shouldValidate: true, shouldDirty: true });
      if (t.subject) setValue("message_subject", t.subject);
      setValue("template_id", undefined);
      toast.success(t.provider === "openai" ? "Template generated with AI" : "Template generated (offline heuristic)");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const save = useMutation({
    mutationFn: (launch: boolean) => {
      const val = form.getValues();
      return api.post<Campaign>("/campaigns", {
        name: val.name, location_id: val.location_id, channel: val.channel, template_id: val.template_id || null,
        message_subject: val.channel === "email" ? val.message_subject : null, message_body: val.channel === "qr" ? null : val.message_body,
        audience: val.audience_mode === "tags" ? { tags: val.tags } : {},
        schedule_at: val.send_mode === "schedule" && val.schedule_at ? new Date(val.schedule_at).toISOString() : null,
        reminder_enabled: val.channel !== "qr" && val.reminder_enabled, reminder_after_hours: val.reminder_after_hours, max_reminders: val.max_reminders, launch,
      });
    },
    onSuccess: (c, launch) => {
      toast.success(launch ? (c.status === "scheduled" ? "Campaign scheduled" : "Campaign launched — requests are being sent") : "Draft saved");
      router.push(`/app/campaigns/${c.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setApiError({ message: e.message, code: e.code });
        if (e.code === "validation_error" && /message|body|link/i.test(e.message)) setStep(3);
      } else toast.error(errorMessage(e));
    },
  });

  const next = async () => {
    const ok = await trigger(STEPS[step].fields as unknown as (keyof Values)[]);
    if (!ok) return;
    if (step === 2) {
      const st = channels.data?.find((c) => c.channel === v.channel);
      if (st && !st.ready) return;
    }
    setApiError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const location = locations.find((l) => l.id === v.location_id);
  const chStatus = channels.data?.find((c) => c.channel === v.channel);
  const whatsappLocked = membership.organization.plan_code === "starter";

  const progress = (step / (STEPS.length - 1)) * 100;
  const manifest: [string, React.ReactNode][] = [
    ["Name", v.name || "—"],
    ["Location", location?.name ?? "—"],
    ["Channel", <span key="ch" className="inline-flex items-center gap-1.5">{CHANNEL_META[v.channel].label}{chStatus && <StatusDot tone={chStatus.mode === "live" ? "live" : chStatus.mode === "simulated" ? "warn" : "idle"} />}</span>],
    ["Audience", v.channel === "qr" ? "Anyone who scans" : v.audience_mode === "tags" ? (v.tags.length ? v.tags.join(", ") : "Tags —") : "All consented"],
    ["Timing", v.send_mode === "schedule" ? (v.schedule_at ? format(new Date(v.schedule_at), "dd MMM · HH:mm") : "Scheduled —") : "On launch"],
    ["Reminders", v.channel !== "qr" && v.reminder_enabled ? `${v.max_reminders} × ${v.reminder_after_hours}h` : "Off"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        {/* Mobile: compact progress */}
        <div className="lg:hidden">
          <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <span className="text-primary">Step {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span>
            <span className="text-subtle-foreground">{STEPS[step].title}</span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.title} className={cn("h-1 flex-1 rounded-[1px] transition-colors", i < step ? "bg-primary" : i === step ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-border-strong")} />
            ))}
          </div>
        </div>

        <nav aria-label="Campaign steps" className="hidden lg:block">
          <p className="micro-label mb-4">Mission sequence</p>
          <ol className="relative">
            <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-px bg-border" />
            <motion.span
              aria-hidden
              className="absolute left-[15px] top-4 w-px origin-top bg-primary shadow-[0_0_8px_var(--primary)]"
              style={{ height: "calc(100% - 32px)" }}
              initial={false}
              animate={{ scaleY: progress / 100 }}
              transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s.title} className="relative pb-4 last:pb-0">
                  <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step} aria-current={current ? "step" : undefined} className="group flex w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-default">
                    <span className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-[11px] tabular transition",
                      done ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] text-primary group-hover:bg-primary-soft" : current ? "border-primary text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent),0_0_16px_-4px_var(--primary)]" : "border-border text-subtle-foreground",
                    )}>
                      {done ? <Check className="size-3.5" strokeWidth={2.5} /> : String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-[13px] font-medium", current ? "text-foreground" : done ? "text-foreground-soft" : "text-muted-foreground")}>{s.title}</span>
                      <span className="block truncate text-[11.5px] text-subtle-foreground">{s.desc}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="hidden rounded-xl border border-border bg-background-subtle/50 p-4 lg:block">
          <p className="micro-label mb-3">Manifest</p>
          <dl className="space-y-2">
            {manifest.map(([k, val]) => (
              <div key={k} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[12px]">
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{k}</dt>
                <dd className="truncate text-foreground-soft">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      <Card className="overflow-hidden">
        <div className="relative border-b border-border px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-primary">Step {String(step + 1).padStart(2, "0")} <span className="text-subtle-foreground">/ {String(STEPS.length).padStart(2, "0")} · {STEPS[step].title}</span></p>
            {chStatus?.mode === "simulated" && step >= 2 && <Badge size="sm" variant="amber" mono dot className="hidden sm:inline-flex">Simulated delivery</Badge>}
          </div>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em]">{STEPS[step].title === "Launch" ? "Ready to launch" : STEPS[step].desc}</h2>
          <div className="absolute inset-x-0 bottom-0 h-px bg-border" aria-hidden>
            <motion.div className="h-px origin-left bg-primary shadow-[0_0_8px_var(--primary)]" initial={false} animate={{ scaleX: (step + 1) / STEPS.length }} transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[360px] space-y-5 px-5 py-6 sm:px-6"
          >
            {step === 0 && (
              <FormField label="Campaign name" htmlFor="name" error={errors.name?.message} hint="Only your team sees this — e.g. “Weekend diners — November”.">
                <Input id="name" autoFocus placeholder="Weekend diners — November" {...register("name")} invalid={!!errors.name} />
              </FormField>
            )}

            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Location">
                {locations.map((l) => {
                  const sel = v.location_id === l.id;
                  return (
                    <button key={l.id} type="button" role="radio" aria-checked={sel} onClick={() => setValue("location_id", l.id, { shouldValidate: true })} className={cn("flex items-start gap-3 p-4", choiceClass(sel))}>
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background-subtle", sel ? "text-primary" : "text-muted-foreground")}><MapPin className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-foreground">{l.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[l.address_line, l.city].filter(Boolean).join(", ") || "No address"}</span>
                        <span className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                          {l.effective_review_url ? <><StatusDot tone="ok" /><span className="text-subtle-foreground">Google link ready</span></> : <><StatusDot tone="warn" /><span className="text-warning-foreground">No Google review link</span></>}
                        </span>
                        {!l.effective_review_url && <span className="mt-1 block text-[11.5px] text-muted-foreground">Customers can still leave private feedback.</span>}
                      </span>
                      {sel && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
                {errors.location_id && <p className="text-xs text-danger-foreground">{errors.location_id.message}</p>}
                {!locations.length && <InlineAlert variant="warning" title="No locations">Add a location first. <Link href="/app/locations" className="font-medium text-primary underline">Manage locations</Link></InlineAlert>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Channel">
                  {(["whatsapp", "email", "sms", "qr"] as const).map((ch) => {
                    const st = channels.data?.find((c) => c.channel === ch);
                    const meta = CHANNEL_META[ch];
                    const sel = v.channel === ch;
                    const desc = { whatsapp: "Highest response rates in India. Uses approved Meta templates.", email: "Branded email with unsubscribe link.", sms: "Short message with opt-out instructions.", qr: "Track a printed table card or counter display." }[ch];
                    return (
                      <button key={ch} type="button" role="radio" aria-checked={sel} onClick={() => { setValue("channel", ch); setValue("template_id", undefined); setApiError(null); }} className={cn("p-4", choiceClass(sel))}>
                        <div className="flex items-center justify-between">
                          <ChannelIcon channel={ch} />
                          {!st ? <Skeleton className="h-5 w-16" /> : (
                            <Badge size="sm" mono variant={st.mode === "live" ? "success" : st.mode === "simulated" ? "amber" : "neutral"} dot>{st.mode === "live" ? "Live" : st.mode === "simulated" ? "Simulated" : "Not connected"}</Badge>
                          )}
                        </div>
                        <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">{meta.label}{ch === "whatsapp" && whatsappLocked && <Lock className="size-3.5 text-muted-foreground" aria-label="Requires Growth plan" />}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                      </button>
                    );
                  })}
                </div>
                {chStatus?.note && <InlineAlert variant={chStatus.ready ? "info" : "warning"}>{chStatus.note}{!chStatus.ready && <> — <Link href="/app/integrations" className="font-medium underline">open Integrations</Link></>}</InlineAlert>}
                {v.channel === "whatsapp" && whatsappLocked && (
                  <InlineAlert variant="primary" icon={Sparkles} title="WhatsApp campaigns are on the Growth plan" action={<Button size="xs" asChild><Link href="/app/subscription">Upgrade</Link></Button>}>
                    Your Starter plan includes QR and email collection.
                  </InlineAlert>
                )}
              </div>
            )}

            {step === 3 && (
              v.channel === "qr" ? (
                <InlineAlert variant="info" title="QR campaigns don't send messages">
                  Scans are tracked through your QR codes. After launching, link a QR code from the <Link href="/app/qr-codes" className="font-medium underline">QR Codes</Link> page. Everyone who scans sees the same feedback page with an equal option to review on Google.
                </InlineAlert>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="micro-label">Template library</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["en", "hi", "hinglish"] as const).map((l) => (
                          <Button key={l} type="button" size="xs" variant="soft" onClick={() => genTemplate.mutate(l)} loading={genTemplate.isPending && genTemplate.variables === l}>
                            <Wand2 /> {l === "en" ? "AI · English" : l === "hi" ? "AI · Hindi" : "AI · Hinglish"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {templates.isLoading ? <Skeleton className="h-20" /> : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {templates.data?.map((t) => (
                          <button key={t.id} type="button" aria-pressed={v.template_id === t.id} onClick={() => { setValue("template_id", t.id); setValue("message_body", t.body, { shouldValidate: true }); if (t.subject) setValue("message_subject", t.subject); setApiError(null); }} className={cn("p-3", choiceClass(v.template_id === t.id))}>
                            <div className="flex items-center gap-2">
                              <FileText className={cn("size-3.5", v.template_id === t.id ? "text-primary" : "text-muted-foreground")} />
                              <span className="truncate text-[12.5px] font-medium text-foreground">{t.name}</span>
                              <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">{t.language}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{t.body}</p>
                            {t.channel === "whatsapp" && t.provider_template_name && <p className="mt-1.5 font-mono text-[10px] text-subtle-foreground">META · {t.provider_template_name} · {t.provider_status ?? "unknown"}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {v.channel === "email" && (
                    <FormField label="Email subject" htmlFor="subject" error={errors.message_subject?.message} required>
                      <Input id="subject" {...register("message_subject")} invalid={!!errors.message_subject} placeholder="How was your visit to {{business}}?" />
                    </FormField>
                  )}
                  <FormField label="Message" htmlFor="body" error={errors.message_body?.message} required
                    labelAction={<span className={cn("font-mono text-[10.5px] tabular", (v.message_body?.length ?? 0) > 1400 ? "text-warning-foreground" : "text-subtle-foreground")}>{v.message_body?.length ?? 0}/1500</span>}
                    hint={<>Placeholders: {["{{name}}", "{{business}}", "{{location}}", "{{link}}"].map((p) => <code key={p} className={cn("mx-0.5 rounded-[4px] border border-border bg-background-subtle px-1 font-mono text-[11px]", v.message_body?.includes(p) ? "text-primary" : "text-foreground-soft")}>{p}</code>)}. Ask for honest feedback — never offer incentives or ask only for 5 stars.</>}>
                    <Textarea id="body" rows={5} {...register("message_body", { onChange: () => setValue("template_id", undefined) })} invalid={!!errors.message_body} />
                  </FormField>
                  {v.channel === "whatsapp" && <p className="-mt-3 text-[11.5px] text-muted-foreground">With a live WhatsApp connection, Meta delivers the approved template; this text is used for previews, SMS and email fallback.</p>}
                  <div>
                    <p className="micro-label mb-2.5">Audience</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([["all", Users, "All consented customers", "Customers of this location who agreed to be contacted"], ["tags", Tag, "Customers with tags", "e.g. regulars, weekend, VIP"]] as const).map(([mode, Icon, title, sub]) => (
                        <button key={mode} type="button" onClick={() => setValue("audience_mode", mode)} aria-pressed={v.audience_mode === mode} className={cn("flex items-start gap-3 p-3", choiceClass(v.audience_mode === mode))}>
                          <Icon className={cn("mt-0.5 size-4", v.audience_mode === mode ? "text-primary" : "text-muted-foreground")} />
                          <span><span className="block text-[13px] font-medium text-foreground">{title}</span><span className="block text-[11.5px] text-muted-foreground">{sub}</span></span>
                        </button>
                      ))}
                    </div>
                    {v.audience_mode === "tags" && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.data?.length ? tags.data.map((t) => {
                          const on = v.tags.includes(t);
                          return (
                            <button key={t} type="button" onClick={() => setValue("tags", on ? v.tags.filter((x) => x !== t) : [...v.tags, t], { shouldValidate: true })} aria-pressed={on}
                              className={cn("h-7 rounded-[5px] border px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition", on ? "border-[color-mix(in_oklab,var(--primary)_55%,transparent)] bg-primary-soft text-primary-soft-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground")}>
                              {on && <Check className="mr-1 inline size-3" />}{t}
                            </button>
                          );
                        }) : <p className="text-xs text-muted-foreground">No customer tags yet. Add tags on the Customers page.</p>}
                        {errors.tags && <p className="w-full text-xs text-danger-foreground">{errors.tags.message}</p>}
                      </div>
                    )}
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Lock className="size-3" /> Customers without consent for {CHANNEL_META[v.channel].label} or who opted out are skipped automatically.</p>
                  </div>
                </div>
              )
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([["now", Zap, "Send now", "Requests go out as soon as you launch"], ["schedule", CalendarClock, "Schedule", "Pick a date and time"]] as const).map(([mode, Icon, title, sub]) => (
                    <button key={mode} type="button" onClick={() => setValue("send_mode", mode)} aria-pressed={v.send_mode === mode} className={cn("flex items-start gap-3 p-4", choiceClass(v.send_mode === mode))}>
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background-subtle", v.send_mode === mode ? "text-primary" : "text-muted-foreground")}><Icon className="size-4" /></span>
                      <span><span className="block text-[13.5px] font-medium text-foreground">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
                    </button>
                  ))}
                </div>
                {v.send_mode === "schedule" && (
                  <FormField label="Send at" htmlFor="schedule_at" error={errors.schedule_at?.message} hint="Your local time. We recommend 11:00–19:00 for the best response.">
                    <Input id="schedule_at" type="datetime-local" {...register("schedule_at")} invalid={!!errors.schedule_at} className="max-w-xs font-mono" />
                  </FormField>
                )}
                {v.channel !== "qr" && (
                  <div className="rounded-xl border border-border bg-background-subtle/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background-subtle text-mint"><BellRing className="size-4" /></span>
                        <div>
                          <p className="text-[13.5px] font-medium">Send a reminder</p>
                          <p className="text-xs text-muted-foreground">Only to customers who haven&apos;t opened the feedback page yet.</p>
                        </div>
                      </div>
                      <Switch checked={v.reminder_enabled} onCheckedChange={(c) => setValue("reminder_enabled", c)} aria-label="Enable reminders" />
                    </div>
                    {v.reminder_enabled && (
                      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="micro-label">Wait before reminding</p>
                          <Segmented id="rem-wait" ariaLabel="Wait before reminding" size="sm" mono value={String(v.reminder_after_hours)} onChange={(x) => setValue("reminder_after_hours", Number(x))} options={[24, 48, 72, 120].map((h) => ({ value: String(h), label: h < 48 ? `${h}h` : `${h / 24}d` }))} />
                        </div>
                        <div className="space-y-2">
                          <p className="micro-label">Maximum reminders</p>
                          <Segmented id="rem-max" ariaLabel="Maximum reminders" size="sm" mono value={String(v.max_reminders)} onChange={(x) => setValue("max_reminders", Number(x))} options={[{ value: "1", label: "1 reminder" }, { value: "2", label: "2 reminders" }]} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (v.channel === "qr" ? (
              <InlineAlert variant="info" title="Nothing to preview">QR campaigns don&apos;t send messages. Customers who scan land on your feedback page for {location?.name}.</InlineAlert>
            ) : (
              <MessagePreview locationId={v.location_id} channel={v.channel} body={v.message_body ?? ""} subject={v.message_subject} />
            ))}

            {step === 6 && (
              <div className="space-y-4">
                <TechFrame className="rounded-xl border border-border">
                  <dl className="divide-y divide-border">
                    {[
                      ["Campaign", v.name],
                      ["Location", location?.name ?? "—"],
                      ["Channel", `${CHANNEL_META[v.channel].label}${chStatus?.mode === "simulated" ? " (simulated in demo mode)" : ""}`],
                      ["Audience", v.channel === "qr" ? "Anyone who scans" : v.audience_mode === "tags" ? `Tagged: ${v.tags.join(", ")}` : "All consented customers"],
                      ["Timing", v.send_mode === "schedule" && v.schedule_at ? format(new Date(v.schedule_at), "EEE d MMM yyyy, h:mm a") : "Immediately"],
                      ["Reminders", v.channel !== "qr" && v.reminder_enabled ? `${v.max_reminders} after ${v.reminder_after_hours}h if unopened` : "None"],
                    ].map(([k, val], i) => (
                      <div key={k} className="grid grid-cols-[110px_1fr] gap-4 px-4 py-3 text-[13px] sm:grid-cols-[140px_1fr]">
                        <dt className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground"><span className="text-primary/70">{String(i + 1).padStart(2, "0")}</span>{k}</dt>
                        <dd className="font-medium text-foreground">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </TechFrame>
                <InlineAlert variant="success" icon={CheckCheck} title="Compliant by design">
                  Every recipient gets the same message and the same option to leave a public Google review — no gating, no incentives. Customers can opt out at any time.
                </InlineAlert>
              </div>
            )}

            {apiError && (
              <InlineAlert variant={apiError.code === "plan_limit_exceeded" ? "primary" : "danger"} title={apiError.code === "plan_limit_exceeded" ? "Upgrade required" : "Couldn't save the campaign"}
                action={apiError.code === "plan_limit_exceeded" ? <Button size="xs" asChild><Link href="/app/subscription">View plans</Link></Button> : apiError.code === "channel_not_configured" ? <Button size="xs" variant="outline" asChild><Link href="/app/integrations">Integrations</Link></Button> : undefined}>
                {apiError.message}
              </InlineAlert>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background-subtle/50 px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={step === 0 ? () => router.push("/app/campaigns") : back}><ArrowLeft /> {step === 0 ? "Cancel" : "Back"}</Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={step === 2 && !!chStatus && !chStatus.ready}>Continue <span className="hidden font-mono text-[10.5px] opacity-70 sm:inline">{String(step + 2).padStart(2, "0")}</span><ArrowRight /></Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => save.mutate(false)} loading={save.isPending && save.variables === false}><Save /> Save draft</Button>
              <Button type="button" variant="gradient" onClick={() => save.mutate(true)} loading={save.isPending && save.variables === true}><Rocket /> {v.send_mode === "schedule" ? "Schedule campaign" : "Launch campaign"}</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
