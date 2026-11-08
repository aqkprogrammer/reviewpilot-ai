import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFallback } from "@/components/auth/auth-shell";
import { InviteView } from "@/components/auth/invite-view";

export const metadata: Metadata = { title: "Accept invitation", description: "Join your team on ReviewPilot AI.", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <InviteView />
    </Suspense>
  );
}
