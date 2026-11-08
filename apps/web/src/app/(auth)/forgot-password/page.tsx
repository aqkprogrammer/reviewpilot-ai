import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/recovery";

export const metadata: Metadata = { title: "Forgot password", description: "Reset your ReviewPilot AI password.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
