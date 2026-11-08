"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, ChevronLeft, Mail, Phone, Video } from "lucide-react";
import { Skeleton, InlineAlert } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";

interface PreviewOut { subject: string | null; body: string; link: string; characters: number }

function Linkified({ text, link }: { text: string; link: string }) {
  const parts = text.split(link);
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && <span className="break-all text-[#027eb5] underline dark:text-[#53bdeb]">{link}</span>}
        </React.Fragment>
      ))}
    </>
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
  if (!q.data) return <Skeleton className="mx-auto h-[420px] max-w-sm rounded-[2rem]" />;
  const p = q.data;
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col items-center gap-3">
      {channel === "email" ? (
        <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-md">
          <div className="space-y-1 border-b border-border bg-background-subtle px-4 py-3 text-[12px]">
            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5" /> <span className="font-medium text-foreground">{org.name}</span> &lt;no-reply@reviewpilot.ai&gt;</p>
            <p className="text-[13.5px] font-semibold text-foreground">{p.subject ?? "(no subject)"}</p>
          </div>
          <div className="h-1 bg-primary" />
          <div className="space-y-4 px-6 py-6 text-[13.5px] leading-relaxed text-foreground-soft">
            <p className="font-semibold text-foreground">{org.name}</p>
            <p>Hi Priya,</p>
            <p>{p.body.replace(p.link, "").trim()}</p>
            <span className="inline-block rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white">Share your experience</span>
            <p className="text-[11.5px] text-muted-foreground">Your honest feedback — positive or negative — helps us improve.</p>
          </div>
          <div className="border-t border-border px-6 py-3 text-[11px] text-subtle-foreground">You received this because you recently visited {org.name}. <span className="underline">Unsubscribe</span></div>
        </div>
      ) : (
        <div className="w-[300px] overflow-hidden rounded-[2.2rem] border-[7px] border-[#1c1b22] bg-[#1c1b22] shadow-lg">
          {channel === "whatsapp" ? (
            <>
              <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
                <ChevronLeft className="size-4" />
                <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">{org.name[0]}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{org.name}</span><span className="block text-[10px] text-white/70">Business account</span></span>
                <Video className="size-4 opacity-80" /><Phone className="size-4 opacity-80" />
              </div>
              <div className="min-h-[360px] bg-[#efe7dd] bg-dots px-3 py-4 dark:bg-[#0b141a]">
                <p className="mx-auto mb-3 w-fit rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-[#54656f] dark:bg-[#182229] dark:text-[#8696a0]">TODAY</p>
                <div className="relative max-w-[88%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 text-[12.5px] leading-snug text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
                  <p className="whitespace-pre-wrap"><Linkified text={p.body} link={p.link} /></p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">{time}<CheckCheck className="size-3 text-[#53bdeb]" /></p>
                </div>
                <p className="mt-3 text-center text-[10px] text-[#667781]">Reply STOP to opt out</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#f2f2f7] px-3 py-3 text-center dark:bg-[#1c1c1e]">
                <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-[#8e8e93] text-sm font-semibold text-white">{org.name[0]}</span>
                <p className="mt-1 text-[11px] text-[#3c3c43] dark:text-[#ebebf5]">{org.name}</p>
              </div>
              <div className="min-h-[340px] bg-white px-3 py-4 dark:bg-black">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#e9e9eb] px-3 py-2 text-[12.5px] leading-snug text-black dark:bg-[#262628] dark:text-white">
                  <Linkified text={p.body} link={p.link} />
                </div>
                <p className="mt-1 pl-1 text-[10px] text-[#8e8e93]">Text message · {time}</p>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Rendered for a sample customer “Priya Sharma”. {channel !== "email" && <span className={p.characters > 320 ? "text-warning-foreground" : ""}>{p.characters} characters{p.characters > 320 ? " — consider shortening" : ""}.</span>}
      </p>
    </div>
  );
}
