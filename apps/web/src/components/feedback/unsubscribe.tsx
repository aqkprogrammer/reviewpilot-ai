"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BellOff, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { FeedbackShell } from "./feedback-page";

export function Unsubscribe() {
  const params = useSearchParams();
  const t = params.get("t");
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
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground">ReviewPilot AI</p>
    </FeedbackShell>
  );
}
