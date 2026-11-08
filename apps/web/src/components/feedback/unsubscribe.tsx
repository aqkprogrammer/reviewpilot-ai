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
      <div className="mt-20 rounded-3xl border border-[#ebe8f4] bg-white p-7 text-center shadow-[0_12px_32px_-16px_rgb(22_17_43/0.18)]">
        {state === "done" ? (
          <>
            <CircleCheck className="mx-auto size-10 text-[#059669]" />
            <h1 className="mt-4 text-xl font-semibold">You&apos;ve been unsubscribed</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#6e6a86]">You won&apos;t receive further review requests from this business on any channel. Unsubscribed in error? Contact the business directly.</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f3f2f9]"><BellOff className="size-5 text-[#6e6a86]" /></span>
            <h1 className="mt-4 text-xl font-semibold">Stop review requests?</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#6e6a86]">We&apos;ll stop sending you feedback and review requests from this business on WhatsApp, email and SMS.</p>
            {!t && <p className="mt-4 text-sm text-danger-foreground">This unsubscribe link is incomplete.</p>}
            {state === "error" && <p className="mt-4 text-sm text-danger-foreground" role="alert">{error}</p>}
            <Button size="lg" variant="secondary" className="mt-6 w-full rounded-2xl" disabled={!t} loading={state === "busy"} onClick={confirm}>Unsubscribe</Button>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-[11.5px] text-[#9a97b0]">ReviewPilot AI</p>
    </FeedbackShell>
  );
}
