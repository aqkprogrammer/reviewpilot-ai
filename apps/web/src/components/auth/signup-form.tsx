"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Building2, Check, Languages, Mail, Phone, ShieldAlert, UserRound } from "lucide-react";
import { INDUSTRIES } from "@reviewpilot/shared-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/states";
import { ApiError, api, setActiveOrgId } from "@/lib/api";
import { cn, titleCase } from "@/lib/utils";
import { meQueryKey } from "@/lib/session";
import type { Me } from "@/lib/types";
import { AuthHeading } from "./auth-shell";
import { COUNTRIES, safeNext } from "./auth-utils";
import { GoogleButton, OrDivider } from "./google-button";
import { PasswordInput, StrengthMeter } from "./password-input";
import { TerminalField } from "./terminal";

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

const SECTIONS = [
  { code: "01", short: "Account", title: "Account identity", fields: ["full_name", "email", "password", "confirm"] as const },
  { code: "02", short: "Business", title: "Business profile", fields: ["business_name", "industry", "country", "phone"] as const },
  { code: "03", short: "Workspace", title: "Workspace configuration", fields: ["accept_terms"] as const },
];

function SectionProgress({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Sign-up progress" className="mb-7">
      <ol className="grid grid-cols-3 gap-2">
        {SECTIONS.map((sec, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={sec.code}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(i)}
                aria-current={active ? "step" : undefined}
                className={cn("group w-full text-left focus-visible:outline-none", done && "cursor-pointer")}
              >
                <span className="relative block h-[3px] overflow-hidden rounded-[1px] bg-border-strong">
                  <motion.span
                    className="absolute inset-0 origin-left bg-primary shadow-[0_0_8px_var(--primary)]"
                    initial={false}
                    animate={{ scaleX: done || active ? 1 : 0, opacity: done ? 0.6 : 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className={cn("mt-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors", active ? "text-primary" : done ? "text-foreground-soft group-hover:text-primary group-focus-visible:text-primary" : "text-subtle-foreground")}>
                  {done ? <Check className="size-3" strokeWidth={3} /> : <span>{sec.code}</span>}
                  <span className="truncate max-sm:hidden">{sec.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const next = params.get("next");
  const [formError, setFormError] = React.useState<{ code: string; message: string } | null>(null);
  const [section, setSection] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const presetIndustry = INDUSTRIES.find((i) => i.value === params.get("industry"))?.value;
  const planCode = params.get("plan");
  const billing = params.get("billing") === "yearly" ? "yearly" : "monthly";

  React.useEffect(() => {
    const plan = params.get("plan");
    if (plan) {
      try {
        sessionStorage.setItem("rp_signup_plan", JSON.stringify({ plan, billing: params.get("billing") === "yearly" ? "yearly" : "monthly" }));
      } catch {}
    }
  }, [params]);

  const { register, handleSubmit, control, watch, trigger, setFocus, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: params.get("email") ?? "", password: "", confirm: "", business_name: "",
      industry: (presetIndustry ?? undefined) as Values["industry"], country: "IN", phone: "", accept_terms: false,
    },
  });
  const country = COUNTRIES.find((c) => c.code === watch("country")) ?? COUNTRIES[0];

  const go = (i: number) => {
    setDir(i > section ? 1 : -1);
    setSection(i);
  };

  const advance = async () => {
    const ok = await trigger([...SECTIONS[section].fields], { shouldFocus: true });
    if (ok) go(Math.min(section + 1, SECTIONS.length - 1));
  };

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
      if (err instanceof ApiError) {
        setFormError({ code: err.code, message: err.message });
        if (err.code === "email_taken") go(0);
      } else setFormError({ code: "network", message: "We couldn't reach the server. Please try again." });
    }
  };

  // If final validation finds an error in an earlier section, jump back to it.
  const onInvalid = (errs: Partial<Record<keyof Values, unknown>>) => {
    const idx = SECTIONS.findIndex((sec) => sec.fields.some((f) => f in errs));
    if (idx >= 0 && idx !== section) go(idx);
  };

  const submitForm = (e: React.FormEvent<HTMLFormElement>) => {
    if (section < SECTIONS.length - 1) {
      e.preventDefault();
      void advance();
      return;
    }
    void handleSubmit(onSubmit, onInvalid)(e);
  };

  React.useEffect(() => {
    const first = SECTIONS[section].fields[0];
    if (first !== "accept_terms") {
      const t = setTimeout(() => setFocus(first), 260);
      return () => clearTimeout(t);
    }
  }, [section, setFocus]);

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 18 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -18 }),
  };

  return (
    <>
      <AuthHeading eyebrow="New workspace · 14-day trial" title="Create your account" description="Start a 14-day free trial. No card required." />
      {section === 0 && (
        <>
          <GoogleButton label="Sign up with Google" next={next ?? undefined} />
          <OrDivider label="or sign up with email" />
        </>
      )}

      <SectionProgress current={section} onJump={go} />

      <form onSubmit={submitForm} noValidate>
        {formError && (
          <InlineAlert variant="danger" icon={ShieldAlert} className="mb-5">
            {formError.message}
            {formError.code === "email_taken" && (
              <> <Link href={`/login?email=${encodeURIComponent(watch("email"))}`} className="font-semibold underline">Sign in instead</Link></>
            )}
          </InlineAlert>
        )}

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.fieldset
            key={section}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <legend className="mb-5 flex w-full items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle-foreground">
              <span className="text-primary">{SECTIONS[section].code}</span> — {SECTIONS[section].title}
              <span className="h-px flex-1 bg-border" />
            </legend>

            {section === 0 && (
              <>
                <TerminalField>
                  <FormField label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
                    <Input id="full_name" autoComplete="name" placeholder="Aarav Sharma" leading={<UserRound />} invalid={!!errors.full_name} {...register("full_name")} />
                  </FormField>
                </TerminalField>
                <TerminalField>
                  <FormField label="Business email" htmlFor="email" error={errors.email?.message} required>
                    <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@business.com" leading={<Mail />} invalid={!!errors.email} {...register("email")} />
                  </FormField>
                </TerminalField>
                <TerminalField>
                  <FormField label="Password" htmlFor="password" error={errors.password?.message} required hint="At least 8 characters with letters and numbers.">
                    <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" invalid={!!errors.password} {...register("password")} />
                  </FormField>
                  <div className="mt-3">
                    <StrengthMeter value={watch("password")} />
                  </div>
                </TerminalField>
                <TerminalField>
                  <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm?.message} required>
                    <PasswordInput id="confirm" autoComplete="new-password" placeholder="Repeat your password" invalid={!!errors.confirm} {...register("confirm")} />
                  </FormField>
                </TerminalField>
              </>
            )}

            {section === 1 && (
              <>
                <TerminalField>
                  <FormField label="Business name" htmlFor="business_name" error={errors.business_name?.message} required>
                    <Input id="business_name" autoComplete="organization" placeholder="Spice Route Kitchen" leading={<Building2 />} invalid={!!errors.business_name} {...register("business_name")} />
                  </FormField>
                </TerminalField>
                <TerminalField>
                  <div className="grid gap-5 sm:grid-cols-2">
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
                </TerminalField>
                <TerminalField>
                  <FormField label="Phone number" htmlFor="phone" error={errors.phone?.message} hint={`${country.dial} · ${country.hint}`}>
                    <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder={`${country.dial} …`} leading={<Phone />} invalid={!!errors.phone} {...register("phone")} />
                  </FormField>
                </TerminalField>
              </>
            )}

            {section === 2 && (
              <>
                <dl className="overflow-hidden rounded-lg border border-border bg-background-subtle/60">
                  {[
                    { k: "Account", v: watch("email") || "—" },
                    { k: "Business", v: watch("business_name") || "—" },
                    {
                      k: "Plan",
                      v: planCode ? `${titleCase(planCode)} · ${billing === "yearly" ? "Annual" : "Monthly"} billing` : "Free trial · choose a plan later",
                      accent: true,
                    },
                    { k: "Trial", v: "14 days · no card required" },
                  ].map((r, i) => (
                    <div key={r.k} className={cn("grid grid-cols-[96px_1fr] items-baseline gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}>
                      <dt className="micro-label">{r.k}</dt>
                      <dd className={cn("truncate font-mono text-[12px]", r.accent ? "text-primary" : "text-foreground-soft")}>{r.v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  <Languages className="mt-0.5 size-4 shrink-0 text-primary" />
                  AI replies and feedback pages work in English, हिंदी and Hinglish — you can set the default language for each location during setup.
                </p>
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
              </>
            )}
          </motion.fieldset>
        </AnimatePresence>

        <div className="mt-7 flex items-center gap-3">
          {section > 0 && (
            <Button type="button" variant="ghost" size="lg" onClick={() => go(section - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          {section < SECTIONS.length - 1 ? (
            <Button type="button" size="lg" className="flex-1" onClick={() => void advance()}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" variant="gradient" size="lg" className="flex-1" loading={isSubmitting}>
              Create account {!isSubmitting && <ArrowRight />}
            </Button>
          )}
        </div>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-center text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
