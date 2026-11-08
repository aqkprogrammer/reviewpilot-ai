"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ErrorState } from "@/components/ui/states";
import { ApiError, api, errorMessage, getActiveOrgId, setActiveOrgId } from "@/lib/api";
import { useMe } from "@/lib/session";
import type { Location } from "@/lib/types";
import { BusinessStep, GoogleStep, LocationStep, WelcomeStep } from "./steps-a";
import { CollectionStep, FinishStep, PlanStep, TeamStep } from "./steps-b";
import type { OnboardingState, OrgFull, WizardCtx } from "./types";
import { MobileProgress, Rail, TopActions } from "./ui";

const STEP_COMPONENTS = [WelcomeStep, BusinessStep, LocationStep, GoogleStep, CollectionStep, TeamStep, PlanStep, FinishStep];

function Loading({ label = "Preparing your workspace…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <LogoMark size={40} className="animate-pulse" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> {label}</p>
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const isNew = params.get("new") === "1";
  const me = useMe();
  const [org, setOrg] = React.useState<OrgFull | null>(null);
  const [orgResolved, setOrgResolved] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [maxReached, setMaxReached] = React.useState(1);
  const [data, setData] = React.useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/login?next=/onboarding");
  }, [me.error, router]);

  // Resolve which organization we're onboarding.
  React.useEffect(() => {
    const m = me.data;
    if (!m || orgResolved) return;
    if (isNew || m.memberships.length === 0) {
      setOrgResolved(true);
      return;
    }
    const stored = getActiveOrgId();
    const membership = m.memberships.find((x) => x.organization.id === stored) ?? m.memberships[0];
    if (!membership.permissions.includes("settings.manage")) {
      router.replace("/app");
      return;
    }
    setActiveOrgId(membership.organization.id);
    api
      .get<OnboardingState>("/onboarding", undefined, { orgId: membership.organization.id })
      .then((s) => {
        if (s.completed) {
          router.replace("/app");
          return;
        }
        setOrg(s.organization);
        setData(s.data ?? {});
        const resume = Math.min(Math.max(s.step, 1), 8);
        setStep(resume);
        setMaxReached(resume);
        setOrgResolved(true);
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [me.data, isNew, orgResolved, router]);

  const locations = useQuery({
    queryKey: ["onboarding", "locations", org?.id],
    queryFn: () => api.get<Location[]>("/locations", undefined, { orgId: org!.id }),
    enabled: !!org,
  });

  const go = React.useCallback((n: number) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const next = React.useCallback(
    async (patch?: Record<string, unknown>) => {
      const target = Math.min(step + 1, 8);
      const merged = { ...data, ...(patch ?? {}) };
      setData(merged);
      // Organization doesn't exist yet before step 2 for brand-new (Google) users.
      const orgId = org?.id ?? getActiveOrgId();
      if (orgId && (org || step >= 2)) {
        try {
          await api.put("/onboarding", { step: target, data: patch ?? {} }, { orgId });
        } catch {
          /* progress save is best-effort; the step itself already succeeded */
        }
      }
      go(target);
    },
    [step, data, org, go],
  );

  if (loadError) return <div className="flex min-h-dvh items-center justify-center"><ErrorState message={loadError} onRetry={() => location.reload()} /></div>;
  if (!me.data || !orgResolved) return <Loading />;

  const ctx: WizardCtx = {
    me: me.data,
    org,
    data,
    locations: locations.data ?? [],
    refreshLocations: () => locations.refetch(),
    next,
    back: () => go(Math.max(1, step - 1)),
    setOrg,
    step,
  };
  // Steps after "Business details" need an organization.
  const effectiveStep = !org && step > 2 ? 2 : step;
  const Step = STEP_COMPONENTS[effectiveStep - 1];

  return (
    <div className="flex min-h-dvh bg-background">
      <Rail step={effectiveStep} maxReached={org ? maxReached : Math.min(maxReached, 2)} onJump={go} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-10">
          <div className="flex-1"><MobileProgress step={effectiveStep} /></div>
          <TopActions />
        </div>
        <main className="mx-auto w-full max-w-[760px] flex-1 px-5 pb-16 pt-8 sm:px-10 lg:pt-14">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={effectiveStep}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Step ctx={ctx} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
