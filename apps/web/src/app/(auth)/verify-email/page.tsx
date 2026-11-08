import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-shell";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = { title: "Verify email", description: "Confirm your email address.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <VerifyEmail />
    </Suspense>
  );
}
