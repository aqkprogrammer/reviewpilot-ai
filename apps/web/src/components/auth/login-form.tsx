"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, api, setActiveOrgId } from "@/lib/api";
import { meQueryKey } from "@/lib/session";
import { useServerWaking } from "@/lib/use-server-waking";
import type { Me } from "@/lib/types";
import { AuthHeading } from "./auth-shell";
import { OAUTH_ERRORS, postAuthRoute, safeNext } from "./auth-utils";
import { GoogleButton, OrDivider } from "./google-button";
import { PasswordInput } from "./password-input";
import { TerminalField, TerminalPanel } from "./terminal";
import { StatusDot } from "@/components/ui/tech";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember_me: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = params.get("next");
  const oauthError = params.get("error");
  const [formError, setFormError] = React.useState<{ code: string; message: string } | null>(null);
  const waking = useServerWaking({ warmUp: true });

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "", password: "", remember_me: true },
  });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const me = await api.post<Me>("/auth/login", { ...values, email: values.email.toLowerCase() }, { orgId: null });
      if (me.memberships[0]) setActiveOrgId(me.memberships[0].organization.id);
      qc.setQueryData(meQueryKey, me);
      toast.success(`Welcome back, ${me.user.full_name.split(" ")[0]}`);
      router.replace(postAuthRoute(me, next));
    } catch (err) {
      if (err instanceof ApiError) setFormError({ code: err.code, message: err.message });
      else setFormError({ code: "network", message: "We couldn't reach the server. Check your connection and try again." });
    }
  };

  const oauth = oauthError ? OAUTH_ERRORS[oauthError] ?? { title: "Sign-in didn't complete", body: "Please try again." } : null;

  return (
    <>
      <AuthHeading eyebrow="Sign in" title="Welcome back" description="Sign in to manage reviews, campaigns and customer feedback." />
      {oauth && <InlineAlert variant="warning" icon={ShieldAlert} title={oauth.title} className="mb-6">{oauth.body}</InlineAlert>}

      <TerminalPanel
        label="Workspace access"
        status={
          <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
            {waking ? <><StatusDot tone="warn" pulse /> Starting server</> : <><StatusDot tone="signal" /> Ready</>}
          </span>
        }
      >
        <GoogleButton next={safeNext(next, "")} />
        <OrDivider />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {formError && (
            <InlineAlert variant="danger" icon={ShieldAlert}>
              {formError.message}
              {formError.code === "login_locked" && (
                <> <Link href="/forgot-password" className="font-semibold underline">Reset your password</Link></>
              )}
            </InlineAlert>
          )}
          <TerminalField index="01">
            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@business.com" leading={<Mail />} invalid={!!errors.email} {...register("email")} />
            </FormField>
          </TerminalField>
          <TerminalField index="02">
            <FormField
              label="Password"
              htmlFor="password"
              error={errors.password?.message}
              labelAction={<Link href="/forgot-password" className="text-[12.5px] font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>}
            >
              <PasswordInput id="password" autoComplete="current-password" placeholder="Your password" invalid={!!errors.password} {...register("password")} />
            </FormField>
          </TerminalField>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground-soft">
            <Checkbox checked={watch("remember_me")} onCheckedChange={(v) => setValue("remember_me", v === true)} />
            Keep me signed in for 30 days
          </label>
          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>
            Sign in {!isSubmitting && <ArrowRight />}
          </Button>
          {waking && <WakingNote />}
        </form>
      </TerminalPanel>

      <p className="mt-8 border-t border-border pt-6 text-center text-[13.5px] text-muted-foreground">
        New to ReviewPilot?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary underline-offset-4 hover:underline">Create an account</Link>
      </p>
    </>
  );
}

/** Shown while a request waits for the hosted API to boot after idling. */
export function WakingNote() {
  return (
    <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground" role="status">
      Waking the server after a quiet spell. This can take up to a minute on the first request. You don&apos;t need to resubmit.
    </p>
  );
}
