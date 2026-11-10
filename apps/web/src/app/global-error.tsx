"use client";

import * as React from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ErrorState } from "@/components/ui/states";
import { reportError } from "@/lib/report-error";
import "./globals.css";

// Replaces the root layout when it (or a provider) crashes, so it renders its own document,
// imports the global styles itself and does not rely on Providers / ThemeProvider.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const raw = error instanceof Error ? (error as Error & { digest?: unknown }).digest : undefined;
  const digest = typeof raw === "string" ? raw : undefined;

  React.useEffect(() => {
    reportError(error, { digest });
  }, [error, digest]);

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="dark min-h-dvh bg-background text-foreground">
        <title>Something went wrong · ReviewPilot AI</title>
        <main className="flex min-h-dvh items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card">
            <ErrorState
              title="ReviewPilot hit an unexpected error"
              message="The team has been notified. Try again, or reload the page if the problem persists."
              onRetry={retry}
            />
            {digest && <p className="-mt-8 pb-8 text-center font-mono text-[11px] text-subtle-foreground">Reference: {digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
