import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account", description: "Start your free ReviewPilot AI trial.", robots: { index: true, follow: true } };

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <SignupForm />
    </Suspense>
  );
}
