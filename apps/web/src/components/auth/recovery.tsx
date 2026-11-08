"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CircleCheck, KeyRound, Mail, MailCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { AuthHeading } from "./auth-shell";
import { PasswordInput, StrengthMeter } from "./password-input";

export function StatusIcon({ icon: Icon, tone = "primary" }: { icon: React.ComponentType<{ className?: string }>; tone?: "primary" | "success" | "danger" }) {
  const t = { primary: "bg-primary-soft text-primary", success: "bg-success-soft text-success-foreground", danger: "bg-danger-soft text-danger-foreground" }[tone];
  return <span className={`mb-6 flex size-12 items-center justify-center rounded-2xl ${t}`}><Icon className="size-6" /></span>;
}

function BackToLogin() {
  return (
    <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to sign in
    </Link>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address") });

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const onSubmit = async ({ email }: { email: string }) => {
    try {
      await api.post("/auth/forgot-password", { email: email.toLowerCase() }, { orgId: null });
    } catch (err) {
      // Rate limits are the only error worth surfacing; never reveal whether an account exists.
      if (err instanceof Error && /too many/i.test(err.message)) return void toast.error(err.message);
    }
    setSentTo(email);
  };
  if (sentTo) {
    return (
      <div>
        <StatusIcon icon={MailCheck} />
        <AuthHeading title="Check your inbox" description={<>If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a link to reset your password. It expires in 60 minutes.</>} />
        <InlineAlert variant="info" icon={Mail}>Didn&apos;t get it? Check spam, or try again in a few minutes.</InlineAlert>
        <BackToLogin />
      </div>
    );
  }
  return (
    <div>
      <StatusIcon icon={KeyRound} />
      <AuthHeading title="Forgot your password?" description="Enter the email you sign in with and we'll send you a reset link." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@business.com" leading={<Mail />} invalid={!!errors.email} {...register("email")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
      <BackToLogin />
    </div>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").regex(/[A-Za-z]/, "Include at least one letter").regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });

  if (!token) {
    return (
      <div>
        <StatusIcon icon={ShieldAlert} tone="danger" />
        <AuthHeading title="Reset link missing" description="Open the link from your email again, or request a new one." />
        <Button asChild size="lg" className="w-full"><Link href="/forgot-password">Request a new link</Link></Button>
        <BackToLogin />
      </div>
    );
  }
  if (done) {
    return (
      <div>
        <StatusIcon icon={CircleCheck} tone="success" />
        <AuthHeading title="Password updated" description="For your security we've signed you out of every device. Sign in with your new password." />
        <Button size="lg" className="w-full" onClick={() => router.push("/login")}>Continue to sign in</Button>
      </div>
    );
  }
  const onSubmit = async (v: { password: string }) => {
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password: v.password }, { orgId: null });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <div>
      <StatusIcon icon={KeyRound} />
      <AuthHeading title="Choose a new password" description="Make it at least 8 characters with letters and numbers." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && (
          <InlineAlert variant="danger" icon={ShieldAlert}>
            {error} <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>
          </InlineAlert>
        )}
        <FormField label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </FormField>
        <StrengthMeter value={watch("password")} />
        <FormField label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </div>
  );
}
