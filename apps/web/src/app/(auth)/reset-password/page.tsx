import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/recovery";

export const metadata: Metadata = { title: "Reset password", description: "Choose a new password.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
