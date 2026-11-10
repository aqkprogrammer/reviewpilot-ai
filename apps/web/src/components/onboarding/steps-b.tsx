"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, CircleCheck, Download, Mail, Megaphone, MessageSquare, Plus, QrCode, Rocket, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert, Skeleton } from "@/components/ui/states";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { meQueryKey } from "@/lib/session";
import { cn, formatCurrency } from "@/lib/utils";
import { ChoiceCard, StepFooter, StepHeader } from "./ui";
import type { WizardCtx } from "./types";

// ------------------------------------------------------------------ 5. Review collection

interface ChannelStatus { channel: string; mode: "live" | "simulated" | "unavailable"; ready: boolean; note?: string }
interface QR { id: string; name: string; code: string; location_id: string; scan_url: string }

const CHANNEL_META: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  qr: { title: "QR codes", description: "Printable table cards and counter stands that open your feedback page.", icon: QrCode },
  whatsapp: { title: "WhatsApp", description: "Send review requests with approved templates to customers who opted in.", icon: WhatsAppIcon },
  email: { title: "Email", description: "Branded review-request emails with one-click unsubscribe.", icon: Mail },
  sms: { title: "SMS", description: "Short text requests through a compliant SMS provider.", icon: MessageSquare },
};

function ModeBadge({ s }: { s?: ChannelStatus }) {
  if (!s) return null;
  if (s.mode === "live") return <Badge variant="success" size="sm" dot>Ready</Badge>;
  if (s.mode === "simulated") return <Badge variant="mint" size="sm" dot>Simulated (demo)</Badge>;
  return <Badge variant="neutral" size="sm">Needs setup</Badge>;
}

export function CollectionStep({ ctx }: { ctx: WizardCtx }) {
  const saved = (ctx.data.collection as { channels?: string[] } | undefined)?.channels;
  const [channels, setChannels] = React.useState<string[]>(saved ?? ["qr", "whatsapp"]);
  const [statuses, setStatuses] = React.useState<ChannelStatus[] | null>(null);
  const [qr, setQr] = React.useState<QR | null>(null);
  const [svg, setSvg] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const location = ctx.locations[0];

  React.useEffect(() => {
    api.get<ChannelStatus[]>("/campaigns/channels").then(setStatuses).catch(() => setStatuses([]));
    if (location) {
      api.get<QR[]>("/qr-codes", { location_id: location.id }).then((list) => list[0] && setQr(list[0])).catch(() => {});
    }
  }, [location]);

  React.useEffect(() => {
    if (!qr) return;
    let url: string | null = null;
    api.raw(`/qr-codes/${qr.id}/preview.svg`).then(async (res) => {
      url = URL.createObjectURL(await res.blob());
      setSvg(url);
    }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [qr]);

  const createQr = async () => {
    if (!location) return;
    setCreating(true);
    try {
      const created = await api.post<QR>("/qr-codes", { name: `Table card — ${location.name}`, location_id: location.id, card_headline: "How was your visit?", card_subtext: "Scan to share honest feedback" });
      setQr(created);
      toast.success("QR code created");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const status = (c: string) => statuses?.find((s) => s.channel === c);
  const toggle = (c: string) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div>
      <StepHeader step={5} icon={Megaphone} title="How will you ask for reviews?" description="Pick the channels you'll use. We show honestly which ones can send today and which need credentials first." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["qr", "whatsapp", "email", "sms"] as const).map((c) => {
          const meta = CHANNEL_META[c];
          return (
            <ChoiceCard key={c} selected={channels.includes(c)} onClick={() => toggle(c)} icon={meta.icon} title={meta.title} description={status(c)?.note ?? meta.description} badge={statuses ? <ModeBadge s={status(c)} /> : <Skeleton className="h-4 w-14" />} />
          );
        })}
      </div>

      {channels.includes("qr") && (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card hairline-top">
          <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="p-5">
              <p className="text-[14px] font-semibold">Your first QR code</p>
              {!location ? (
                <p className="mt-1.5 text-[13px] text-muted-foreground">Add a location (step 3) to generate a QR code for it.</p>
              ) : qr ? (
                <>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Scans open the feedback page for <span className="font-medium text-foreground">{location.name}</span>. Every visitor sees the same option to review you on Google.</p>
                  <p className="mt-3 truncate font-mono text-[11.5px] text-subtle-foreground">{qr.scan_url}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadFile(`/qr-codes/${qr.id}/download`, { format: "pdf" }, "qr-card.pdf")}><Download /> Printable card (PDF)</Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadFile(`/qr-codes/${qr.id}/download`, { format: "png" }, "qr.png")}>PNG</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Generate a table-card QR for {location.name}. You can customise colours, logo and templates later.</p>
                  <Button size="sm" className="mt-4" loading={creating} onClick={createQr}><QrCode /> Generate QR code</Button>
                </>
              )}
            </div>
            <div className="flex items-center justify-center border-t border-border bg-background-subtle p-5 sm:border-l sm:border-t-0">
              {qr && svg ? (
                <div className="tech-corners rounded-md border border-border bg-white p-3 shadow-sm">
                  <img src={svg} alt={`QR code for ${location?.name}`} className="size-36" />
                </div>
              ) : (
                <div className="flex size-36 items-center justify-center rounded-md border border-dashed border-border-strong text-subtle-foreground"><QrCode className="size-8" /></div>
              )}
            </div>
          </div>
        </div>
      )}

      {channels.some((c) => status(c)?.mode === "unavailable") && (
        <InlineAlert variant="info" icon={Megaphone} className="mt-4">Channels marked “Needs setup” can be connected later in Integrations. Nothing will be sent until they are.</InlineAlert>
      )}
      <StepFooter onBack={ctx.back} onSkip={() => ctx.next({ collection: { skipped: true } })} primary={<Button size="lg" onClick={() => ctx.next({ collection: { channels, qr_created: !!qr } })}>Continue <ArrowRight /></Button>} />
    </div>
  );
}

// ------------------------------------------------------------------ 6. Team

const ROLES = [
  { value: "admin", label: "Admin", hint: "Manage everything except billing" },
  { value: "manager", label: "Manager", hint: "Reviews, campaigns, customers" },
  { value: "staff", label: "Staff", hint: "Reviews and customers" },
  { value: "analyst", label: "Analyst", hint: "Read-only analytics" },
];

export function TeamStep({ ctx }: { ctx: WizardCtx }) {
  const [rows, setRows] = React.useState([{ email: "", role: "manager" }]);
  const [sent, setSent] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [rowErrors, setRowErrors] = React.useState<Record<number, string>>({});

  const send = async () => {
    const errs: Record<number, string> = {};
    rows.forEach((r, i) => {
      if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) errs[i] = "Enter a valid email";
    });
    setRowErrors(errs);
    const valid = rows.filter((r, i) => r.email && !errs[i]);
    if (Object.keys(errs).length) return;
    if (!valid.length) return ctx.next({ team: { invited: sent.length } });
    setBusy(true);
    const ok: string[] = [];
    for (const [i, r] of rows.entries()) {
      if (!r.email) continue;
      try {
        await api.post("/team/invitations", { email: r.email.trim().toLowerCase(), role: r.role, location_ids: [] });
        ok.push(r.email);
      } catch (err) {
        errs[i] = errorMessage(err);
      }
    }
    setBusy(false);
    setSent((s) => [...s, ...ok]);
    if (Object.keys(errs).length) {
      setRowErrors(errs);
      setRows((rs) => rs.filter((r) => !ok.includes(r.email)));
      return;
    }
    toast.success(`${ok.length} invitation${ok.length === 1 ? "" : "s"} sent`);
    await ctx.next({ team: { invited: sent.length + ok.length } });
  };

  return (
    <div>
      <StepHeader step={6} icon={Users} title="Invite your team" description="Managers reply to reviews, staff add customers after a visit, analysts follow the numbers. Invitations expire after 7 days." />
      {sent.length > 0 && (
        <InlineAlert variant="success" icon={CircleCheck} className="mb-4">Invited: {sent.join(", ")}</InlineAlert>
      )}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label={`Email ${i + 1}`} type="email" placeholder="colleague@business.com" value={r.email} invalid={!!rowErrors[i]}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} className="sm:flex-1" />
              <div className="flex min-w-0 gap-2">
                <Select value={r.role} onValueChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, role: v } : x)))}>
                  <SelectTrigger className="min-w-0 flex-1 sm:w-44 sm:flex-none" aria-label={`Role ${i + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((ro) => <SelectItem key={ro.value} value={ro.value}>{ro.label} — {ro.hint}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            </div>
            {rowErrors[i] && <p className="mt-1 text-xs font-medium text-danger-foreground" role="alert">{rowErrors[i]}</p>}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setRows((rs) => [...rs, { email: "", role: "staff" }])}><Plus /> Add another</Button>
      <StepFooter
        onBack={ctx.back}
        onSkip={() => ctx.next({ team: { skipped: true, invited: sent.length } })}
        primary={<Button size="lg" loading={busy} onClick={send}>{rows.some((r) => r.email) ? <><UserPlus /> Send invites</> : <>Continue <ArrowRight /></>}</Button>}
      />
    </div>
  );
}

// ------------------------------------------------------------------ 7. Plan

interface Plan { code: string; name: string; description: string | null; price_monthly_minor: number; price_yearly_minor: number; currency: string; features: string[]; is_popular: boolean; is_custom_pricing: boolean }

export function PlanStep({ ctx }: { ctx: WizardCtx }) {
  const [plans, setPlans] = React.useState<Plan[] | null>(null);
  const [interval, setBilling] = React.useState<"monthly" | "yearly">("monthly");
  const [preferred, setPreferred] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get<Plan[]>("/subscriptions/plans", undefined, { orgId: null }).then(setPlans).catch(() => setPlans([]));
    try {
      const s = JSON.parse(sessionStorage.getItem("rp_signup_plan") || "null");
      if (s?.plan) setPreferred(s.plan);
      if (s?.billing === "yearly") setBilling("yearly");
    } catch {}
  }, []);

  const choose = async (p: Plan) => {
    setBusy(p.code);
    try {
      // Finish onboarding first so the user lands in the app after checkout.
      await api.put("/onboarding", { step: 8, data: { plan: { chosen: p.code, interval } } });
      await api.post("/onboarding/complete");
      const res = await api.post<{ checkout_url: string | null }>("/subscriptions/checkout", { plan_code: p.code, interval });
      try { sessionStorage.removeItem("rp_signup_plan"); } catch {}
      if (res.checkout_url) window.location.assign(res.checkout_url);
      else await ctx.next({ plan: { chosen: p.code, interval } });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  };

  return (
    <div>
      <StepHeader step={7} icon={Rocket} title="Choose how to continue" description="Your 14-day free trial includes Growth features. Subscribe now or decide later — payments are confirmed only by the payment provider." />
      <div className="mb-5 inline-flex h-9 items-center rounded-lg border border-border bg-card/70 p-0.5" role="group" aria-label="Billing interval">
        {(["monthly", "yearly"] as const).map((v) => (
          <button key={v} onClick={() => setBilling(v)} aria-pressed={interval === v} className={cn("h-full rounded-md border px-3.5 text-[13px] font-medium transition", interval === v ? "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {v === "monthly" ? "Monthly" : <>Annual <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mint">2 months free</span></>}
          </button>
        ))}
      </div>
      {!plans ? (
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-lg" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {plans.filter((p) => !p.is_custom_pricing).map((p) => {
            const highlight = preferred ? preferred === p.code : p.is_popular;
            const price = interval === "yearly" ? p.price_yearly_minor / 12 : p.price_monthly_minor;
            return (
              <div key={p.code} className={cn("relative flex flex-col rounded-lg border bg-card p-5 transition hairline-top", highlight ? "tech-corners border-[color-mix(in_oklab,var(--primary)_55%,transparent)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]" : "border-border")}>
                {p.is_popular && <Badge variant="primary" size="sm" mono className="absolute right-4 top-4">Most popular</Badge>}
                <p className="text-[15px] font-semibold">{p.name}</p>
                <p className="mt-1 min-h-10 text-[12.5px] leading-snug text-muted-foreground">{p.description}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-[28px] font-semibold tracking-[-0.03em] tabular">{formatCurrency(price, p.currency)}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </p>
                <p className="font-mono text-[10.5px] text-subtle-foreground">{interval === "yearly" ? `${formatCurrency(p.price_yearly_minor, p.currency)} billed yearly` : "billed monthly"} · GST incl.</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex gap-2 text-[12.5px] leading-snug text-foreground-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{f}</li>
                  ))}
                </ul>
                <Button className="mt-5 w-full" variant={highlight ? "primary" : "outline"} loading={busy === p.code} disabled={!!busy && busy !== p.code} onClick={() => choose(p)}>
                  Subscribe to {p.name}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Need more than 10 locations, SSO or a DPA? <Link href="/contact?topic=enterprise" className="font-medium text-primary hover:underline">Talk to us about Enterprise</Link>.
      </p>
      <StepFooter onBack={ctx.back} primary={<Button size="lg" variant="secondary" disabled={!!busy} onClick={() => ctx.next({ plan: { trial: true } })}>Continue with free trial <ArrowRight /></Button>} />
    </div>
  );
}

// ------------------------------------------------------------------ 8. Finish

export function FinishStep({ ctx }: { ctx: WizardCtx }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const d = ctx.data as Record<string, Record<string, unknown> | undefined>;
  const checklist = [
    { label: "Business details", done: true },
    { label: `${ctx.locations.length} location${ctx.locations.length === 1 ? "" : "s"} added`, done: ctx.locations.length > 0 },
    { label: "Google review link or connection", done: ctx.locations.some((l) => l.effective_review_url) || d.google?.status === "connected" },
    { label: "First QR code", done: !!d.collection?.qr_created },
    { label: "Team invitations", done: Number(d.team?.invited ?? 0) > 0 },
  ];

  const finish = async (href: string) => {
    setBusy(true);
    try {
      await api.post("/onboarding/complete");
      await qc.invalidateQueries({ queryKey: meQueryKey });
      try { sessionStorage.removeItem("rp_signup_plan"); } catch {}
      router.replace(href);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const next = [
    { icon: Megaphone, title: "Launch a WhatsApp campaign", body: "Ask recent customers for honest feedback.", href: "/app/campaigns" },
    { icon: Upload, title: "Import customers", body: "Upload a CSV — consent stays explicit.", href: "/app/customers" },
    { icon: QrCode, title: "Print your QR cards", body: "Table cards, counter stands and receipts.", href: "/app/qr-codes" },
  ];

  return (
    <div>
      <div className="tech-corners relative mb-8 overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] bg-card p-7 hairline-top">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid opacity-70 [mask-image:linear-gradient(to_left,#000,transparent_70%)]" />
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 top-1/2 size-[260px] -translate-y-1/2">
          {[30, 52, 74, 96].map((r, i) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={i === 0 ? "var(--primary)" : "var(--border-strong)"} strokeOpacity={i === 0 ? 0.7 : 1} strokeDasharray={i === 2 ? "2 5" : undefined} />
          ))}
          <circle cx="100" cy="100" r="14" fill="var(--primary)" fillOpacity="0.85" />
        </svg>
        <div className="relative">
          <span className="flex size-12 items-center justify-center rounded-md border border-[color-mix(in_oklab,var(--mint)_35%,transparent)] bg-mint-soft text-mint shadow-[0_0_24px_-6px_var(--mint)]"><Check className="size-6" strokeWidth={2.5} /></span>
          <p className="mt-6 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em]">
            <span className="text-primary">Step 08</span>
            <span className="h-px w-5 bg-border-strong" aria-hidden />
            <span className="text-subtle-foreground">Ready for launch</span>
          </p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[32px]">{ctx.org?.name ?? "Your workspace"} is ready.</h1>
          <p className="mt-2 max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">Here&apos;s what you set up. Anything unchecked can be finished from the dashboard&apos;s setup checklist.</p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {checklist.map((c) => (
          <li key={c.label} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[13.5px]">
            <span className={cn("flex size-6 items-center justify-center rounded-[4px] border", c.done ? "border-[color-mix(in_oklab,var(--mint)_30%,transparent)] bg-mint-soft text-mint" : "border-border bg-muted text-subtle-foreground")}>
              {c.done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </li>
        ))}
      </ul>
      <p className="micro-label mb-3 mt-9">Good next steps</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {next.map((n) => (
          <button key={n.href} disabled={busy} onClick={() => finish(n.href)} className="group flex flex-col items-start justify-start rounded-lg border border-border bg-card p-4 text-left transition hairline-top hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:opacity-60">
            <n.icon className="size-5 text-primary" />
            <p className="mt-3 text-[13.5px] font-semibold">{n.title}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{n.body}</p>
          </button>
        ))}
      </div>
      <StepFooter onBack={ctx.back} primary={<Button size="lg" loading={busy} onClick={() => finish("/app")}>Go to dashboard <ArrowRight /></Button>} />
    </div>
  );
}
