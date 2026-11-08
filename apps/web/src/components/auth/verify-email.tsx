"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleCheck, LoaderCircle, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/session";
import { AuthHeading } from "./auth-shell";
import { StatusIcon } from "./recovery";

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  const qc = useQueryClient();
  const me = useMe();
  const [state, setState] = React.useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = React.useState("This verification link is missing a token.");
  const [resending, setResending] = React.useState(false);
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api
      .post("/auth/verify-email", { token }, { orgId: null })
      .then(() => {
        setState("ok");
        qc.invalidateQueries({ queryKey: meQueryKey });
      })
      .catch((err) => {
        setMessage(errorMessage(err));
        setState("error");
      });
  }, [token, qc]);

  const resend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification", undefined, { orgId: null });
      toast.success("Verification email sent");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }
  if (state === "ok") {
    return (
      <div>
        <StatusIcon icon={CircleCheck} tone="success" />
        <AuthHeading title="Email verified" description="Thanks for confirming your address. Your account is fully set up." />
        <Button asChild size="lg" className="w-full"><Link href={me.data ? "/app" : "/login"}>{me.data ? "Go to dashboard" : "Sign in"}</Link></Button>
      </div>
    );
  }
  return (
    <div>
      <StatusIcon icon={MailWarning} tone="danger" />
      <AuthHeading title="This link didn't work" description={message} />
      {me.data ? (
        me.data.user.email_verified ? (
          <Button asChild size="lg" className="w-full"><Link href="/app">Your email is already verified — continue</Link></Button>
        ) : (
          <Button size="lg" className="w-full" loading={resending} onClick={resend}>Send a new verification email</Button>
        )
      ) : (
        <Button asChild size="lg" className="w-full"><Link href="/login?next=/verify-email">Sign in to resend the link</Link></Button>
      )}
    </div>
  );
}
