import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <OnboardingWizard />
    </Suspense>
  );
}
