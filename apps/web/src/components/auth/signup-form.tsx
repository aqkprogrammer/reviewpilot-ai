"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Building2, Mail, Phone, ShieldAlert, UserRound } from "lucide-react";
import { INDUSTRIES } from "@reviewpilot/shared-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, api, setActiveOrgId } from "@/lib/api";
import { meQueryKey } from "@/lib/session";
import type { Me } from "@/lib/types";
import { AuthHeading } from "./auth-shell";
import { COUNTRIES, safeNext } from "./auth-utils";
import { GoogleButton, OrDivider } from "./google-button";
import { PasswordInput, StrengthMeter } from "./password-input";

const industryValues = INDUSTRIES.map((i) => i.value) as [string, ...string[]];

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(160),
    email: z.string().trim().min(1, "Enter your work email").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string().min(1, "Confirm your password"),
    business_name: z.string().trim().min(2, "Enter your business name").max(160),
    industry: z.enum(industryValues, { message: "Choose a category" }),
    country: z.string().length(2),
    phone: z
      .string()
      .trim()
      .max(32)
      .refine((v) => !v || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number")
      .optional(),
    accept_terms: z.boolean().refine((v) => v, "Please accept the Terms and Privacy Policy"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = params.get("next");
  const [formError, setFormError] = React.useState<{ code: string; message: string } | null>(null);
  const presetIndustry = INDUSTRIES.find((i) => i.value === params.get("industry"))?.value;

  React.useEffect(() => {
    const plan = params.get("plan");
    if (plan) {
      try {
        sessionStorage.setItem("rp_signup_plan", JSON.stringify({ plan, billing: params.get("billing") === "yearly" ? "yearly" : "monthly" }));
      } catch {}
    }
  }, [params]);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: params.get("email") ?? "", password: "", confirm: "", business_name: "",
      industry: (presetIndustry ?? undefined) as Values["industry"], country: "IN", phone: "", accept_terms: false,
    },
  });
  const country = COUNTRIES.find((c) => c.code === watch("country")) ?? COUNTRIES[0];

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      const phone = v.phone ? (v.phone.startsWith("+") ? v.phone : `${country.dial} ${v.phone}`) : null;
      const me = await api.post<Me>(
        "/auth/signup",
        { full_name: v.full_name, email: v.email.toLowerCase(), password: v.password, business_name: v.business_name, industry: v.industry, country: v.country, phone, accept_terms: v.accept_terms },
        { orgId: null },
      );
      if (me.memberships[0]) setActiveOrgId(me.memberships[0].organization.id);
      qc.setQueryData(meQueryKey, me);
      toast.success("Account created — let's set up your business");
      router.replace(next?.startsWith("/invite") ? safeNext(next) : "/onboarding");
    } catch (err) {
      if (err instanceof ApiError) setFormError({ code: err.code, message: err.message });
      else setFormError({ code: "network", message: "We couldn't reach the server. Please try again." });
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" description="Start a 14-day free trial. No card required." />
      <GoogleButton label="Sign up with Google" next={next ?? undefined} />
      <OrDivider label="or sign up with email" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && (
          <InlineAlert variant="danger" icon={ShieldAlert}>
            {formError.message}
            {formError.code === "email_taken" && (
              <> <Link href={`/login?email=${encodeURIComponent(watch("email"))}`} className="font-semibold underline">Sign in instead</Link></>
            )}
          </InlineAlert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
            <Input id="full_name" autoComplete="name" placeholder="Aarav Sharma" leading={<UserRound />} invalid={!!errors.full_name} {...register("full_name")} />
          </FormField>
          <FormField label="Business email" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@business.com" leading={<Mail />} invalid={!!errors.email} {...register("email")} />
          </FormField>
        </div>
        <FormField label="Password" htmlFor="password" error={errors.password?.message} required hint="At least 8 characters with letters and numbers.">
          <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" invalid={!!errors.password} {...register("password")} />
        </FormField>
        <StrengthMeter value={watch("password")} />
        <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm?.message} required>
          <PasswordInput id="confirm" autoComplete="new-password" placeholder="Repeat your password" invalid={!!errors.confirm} {...register("confirm")} />
        </FormField>

        <div className="pt-2">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">About your business</p>
          <div className="space-y-4">
            <FormField label="Business name" htmlFor="business_name" error={errors.business_name?.message} required>
              <Input id="business_name" autoComplete="organization" placeholder="Spice Route Kitchen" leading={<Building2 />} invalid={!!errors.business_name} {...register("business_name")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Business category" htmlFor="industry" error={errors.industry?.message} required>
                <Controller
                  control={control}
                  name="industry"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="industry" aria-invalid={!!errors.industry}><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Country" htmlFor="country">
                <Controller
                  control={control}
                  name="country"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="country"><SelectValue /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>
            <FormField label="Phone number" htmlFor="phone" error={errors.phone?.message} hint={`${country.dial} · ${country.hint}`}>
              <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder={`${country.dial} …`} leading={<Phone />} invalid={!!errors.phone} {...register("phone")} />
            </FormField>
          </div>
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-foreground-soft">
            <Controller control={control} name="accept_terms" render={({ field }) => <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} aria-invalid={!!errors.accept_terms} />} />
            <span>
              I agree to the <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">Terms of Service</Link> and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {errors.accept_terms && <p className="mt-1.5 text-xs font-medium text-danger-foreground" role="alert">{errors.accept_terms.message}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account {!isSubmitting && <ArrowRight />}
        </Button>
      </form>
      <p className="mt-8 text-center text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </>
  );
}
