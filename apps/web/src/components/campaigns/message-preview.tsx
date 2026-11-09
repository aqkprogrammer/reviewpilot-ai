"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BatteryMedium, CheckCheck, ChevronLeft, Mail, Phone, Signal, Video, Wifi } from "lucide-react";
import { Skeleton, InlineAlert } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/tech";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";

interface PreviewOut { subject: string | null; body: string; link: string; characters: number }

function Linkified({ text, link, className }: { text: string; link: string; className?: string }) {
  const parts = text.split(link);
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && <span className={cn("break-all underline underline-offset-2", className)}>{link}</span>}
        </React.Fragment>
      ))}
    </>
  );
}

/** Graphite device shell; forced to the dark token set so it reads as hardware in both themes. */
function Device({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="dark relative w-[292px] shrink-0 rounded-[2.4rem] border border-border-strong bg-background p-[7px] shadow-lg">
      <div className="overflow-hidden rounded-[2rem] border border-border bg-background-subtle">
        <div className="relative flex h-8 items-center justify-between px-6 font-mono text-[10.5px] text-foreground">
          <span className="tabular">{time}</span>
          <span aria-hidden className="absolute left-1/2 top-1.5 h-[18px] w-[76px] -translate-x-1/2 rounded-full bg-background" />
          <span className="flex items-center gap-1 text-foreground-soft"><Signal className="size-3" /><Wifi className="size-3" /><BatteryMedium className="size-3.5" /></span>
        </div>
        {children}
        <div className="flex h-5 items-center justify-center bg-background-subtle"><span className="h-1 w-24 rounded-full bg-foreground/60" /></div>
      </div>
    </div>
  );
}

export function MessagePreview({ locationId, channel, body, subject }: { locationId: string; channel: string; body: string; subject?: string }) {
  const { membership } = useOrg();
  const org = membership.organization;
  const q = useQuery({
    queryKey: ["campaigns", "preview", locationId, channel, body, subject],
    queryFn: () => api.post<PreviewOut>("/campaigns/preview", { location_id: locationId, channel, body, subject: subject || null }),
    enabled: !!locationId && !!body,
  });
  if (q.isError) return <InlineAlert variant="danger" title="Preview failed">{errorMessage(q.error)}</InlineAlert>;
  if (!q.data) return <Skeleton className="mx-auto h-[460px] max-w-[292px] rounded-[2.4rem]" />;
  const p = q.data;
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const segments = channel === "sms" ? Math.max(1, Math.ceil(p.characters / 160)) : null;

  const telemetry: [string, React.ReactNode][] = [
    ["Channel", channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "Email"],
    ["Sample recipient", "Priya Sharma"],
    ...(channel !== "email" ? ([["Characters", <span key="c" className={p.characters > 320 ? "text-warning-foreground" : undefined}>{p.characters}{p.characters > 320 ? " · long" : ""}</span>]] as [string, React.ReactNode][]) : []),
    ...(segments ? ([["SMS segments", segments]] as [string, React.ReactNode][]) : []),
    ...(p.subject ? ([["Subject", p.subject]] as [string, React.ReactNode][]) : []),
    ["Tracked link", <span key="l" className="break-all text-primary">{p.link}</span>],
  ];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
      <div className="relative flex justify-center overflow-hidden rounded-xl border border-border bg-background-subtle/50 px-3 py-6 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-tech-grid-fade opacity-80" />
        <span className="micro-label absolute left-4 top-3">Render · {channel}</span>
        <div className="relative pt-3">
          {channel === "email" ? (
            <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-border-strong bg-card shadow-lg">
              <div className="flex items-center gap-1.5 border-b border-border bg-background-subtle px-3 py-2" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-border-strong" />)}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">Inbox</span>
              </div>
              <div className="space-y-1 border-b border-border px-4 py-3 text-[12px]">
                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5" /> <span className="font-medium text-foreground">{org.name}</span> <span className="font-mono text-[11px]">&lt;no-reply@reviewpilot.ai&gt;</span></p>
                <p className="text-[14px] font-semibold text-foreground">{p.subject ?? "(no subject)"}</p>
              </div>
              <div className="h-[3px] bg-primary" />
              <div className="space-y-4 px-6 py-6 text-[13.5px] leading-relaxed text-foreground-soft">
                <p className="font-semibold text-foreground">{org.name}</p>
                <p>Hi Priya,</p>
                <p className="whitespace-pre-wrap">{p.body.replace(p.link, "").trim()}</p>
                <span className="inline-block rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground">Share your experience</span>
                <p className="text-[11.5px] text-muted-foreground">Your honest feedback — positive or negative — helps us improve.</p>
              </div>
              <div className="border-t border-border px-6 py-3 text-[11px] text-subtle-foreground">You received this because you recently visited {org.name}. <span className="underline">Unsubscribe</span></div>
            </div>
          ) : channel === "whatsapp" ? (
            <Device time={time}>
              <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 text-foreground">
                <ChevronLeft className="size-4 text-success" />
                <span className="flex size-7 items-center justify-center rounded-full bg-success-soft font-mono text-[11px] font-semibold text-success">{org.name[0]}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{org.name}</span><span className="block text-[10px] text-muted-foreground">Business account</span></span>
                <Video className="size-4 text-muted-foreground" /><Phone className="size-4 text-muted-foreground" />
              </div>
              <div className="min-h-[360px] bg-background bg-dots px-3 py-4">
                <p className="mx-auto mb-3 w-fit rounded-md bg-card px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">Today</p>
                <div className="relative max-w-[88%] rounded-lg rounded-tl-none border border-border bg-card px-2.5 py-1.5 text-[12.5px] leading-snug text-foreground shadow-sm">
                  <p className="whitespace-pre-wrap"><Linkified text={p.body} link={p.link} className="text-ice" /></p>
                  <p className="mt-1 flex items-center justify-end gap-1 font-mono text-[9.5px] text-subtle-foreground">{time}<CheckCheck className="size-3 text-ice" /></p>
                </div>
                <p className="mt-3 text-center text-[10px] text-subtle-foreground">Reply STOP to opt out</p>
              </div>
            </Device>
          ) : (
            <Device time={time}>
              <div className="border-b border-border bg-card px-3 py-3 text-center">
                <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-muted font-mono text-sm font-semibold text-foreground">{org.name[0]}</span>
                <p className="mt-1 text-[11px] text-muted-foreground">{org.name}</p>
              </div>
              <div className="min-h-[340px] bg-background px-3 py-4">
                <p className="mb-3 text-center font-mono text-[9.5px] uppercase tracking-[0.1em] text-subtle-foreground">Text message · Today {time}</p>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[12.5px] leading-snug text-foreground">
                  <Linkified text={p.body} link={p.link} className="text-ice" />
                </div>
              </div>
            </Device>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background-subtle/40 p-4">
        <p className="micro-label mb-3 flex items-center gap-2"><StatusDot tone="signal" /> Render telemetry</p>
        <dl className="space-y-2.5">
          {telemetry.map(([k, val]) => (
            <div key={k}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle-foreground">{k}</dt>
              <dd className="mt-0.5 font-mono text-[12px] text-foreground">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">Rendered by the API for a sample customer. Real sends personalise each placeholder.</p>
      </div>
    </div>
  );
}
