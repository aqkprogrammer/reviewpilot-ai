"use client";
import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BellOff, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { FeedbackShell, type PublicLocation } from "./feedback-page";

export function Unsubscribe() {
  const params = useSearchParams();
  const t = params.get("t");
  const { slug } = useParams<{ slug: string }>();
  // No tracking token is sent here, so this read has no side effects.
  const loc = useQuery({ queryKey: ["public-location", slug], queryFn: () => api.get<PublicLocation>(`/public/locations/${slug}`, undefined, { orgId: null }), enabled: !!slug, retry: false });
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = React.useState("");
  const confirm = async () => {
    setState("busy");
    try {
      await api.post("/public/unsubscribe", { t }, { orgId: null });
      setState("done");
    } catch (err) {
      setError(errorMessage(err));
      setState("error");
    }
  };
  return (
    <FeedbackShell>
      <div className="mt-20 overflow-hidden rounded-xl border border-border-strong bg-card text-center shadow-md">
        <div className="flex items-center justify-between border-b border-border px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">
          <span>Message preferences</span>
          <BellOff className="size-3.5" />
        </div>
        <div className="p-7">
        {state === "done" ? (
          <>
            <span className="mx-auto flex size-12 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--mint)_30%,transparent)] bg-mint-soft"><CircleCheck className="size-6 text-mint" /></span>
            <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">You&apos;ve been unsubscribed</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You won&apos;t receive further review requests from this business on any channel. Unsubscribed in error? Contact the business directly.</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border-strong bg-background"><BellOff className="size-5 text-muted-foreground" /></span>
            <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">Stop review requests?</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We&apos;ll stop sending you feedback and review requests from this business on WhatsApp, email and SMS.</p>
            {!t && <p className="mt-4 text-sm text-danger-foreground">This unsubscribe link is incomplete.</p>}
            {state === "error" && <p className="mt-4 text-sm text-danger-foreground" role="alert">{error}</p>}
            <Button size="lg" variant="secondary" className="mt-6 w-full" disabled={!t} loading={state === "busy"} onClick={confirm}>Unsubscribe</Button>
          </>
        )}
        </div>
      </div>
      {loc.data?.footer_text && <p className="mt-6 text-center text-[11px] text-muted-foreground">{loc.data.footer_text}</p>}
      {loc.isSuccess && loc.data.show_attribution !== false && <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">Powered by ReviewPilot AI</p>}
    </FeedbackShell>
  );
}
