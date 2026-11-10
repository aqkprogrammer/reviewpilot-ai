"use client";

import * as React from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

function digestOf(error: unknown): string | undefined {
  const d = error instanceof Error ? (error as Error & { digest?: unknown }).digest : undefined;
  return typeof d === "string" ? d : undefined;
}

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = digestOf(error);

  React.useEffect(() => {
    reportError(error, { digest });
  }, [error, digest]);

  return (
    <main className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card">
        <ErrorState
          title="Something went wrong"
          message="This page hit an unexpected error. The team has been notified — try again, or head back to safety."
          onRetry={retry}
        />
        <div className="-mt-8 flex flex-col items-center gap-3 pb-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Go to home</Link>
          </Button>
          {digest && <p className="font-mono text-[11px] text-subtle-foreground">Reference: {digest}</p>}
        </div>
      </div>
    </main>
  );
}
