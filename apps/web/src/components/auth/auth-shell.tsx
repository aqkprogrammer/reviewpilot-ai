import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { BrandPanel } from "./brand-panel";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f1fb] p-0 dark:bg-background lg:p-4">
      <div className="mx-auto grid min-h-dvh max-w-[1400px] gap-4 lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="relative flex flex-col bg-card px-6 py-6 sm:px-10 lg:rounded-[28px] lg:border lg:border-border lg:shadow-sm">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="ReviewPilot AI home"><Logo /></Link>
            <ThemeToggle />
          </div>
          <main className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[420px]">{children}</div>
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-subtle-foreground">
            <span>© {new Date().getFullYear()} ReviewPilot AI</span>
            <span className="flex gap-4">
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/contact" className="hover:text-foreground">Help</Link>
            </span>
          </footer>
        </div>
        <BrandPanel />
      </div>
    </div>
  );
}

export function AuthHeading({ title, description, eyebrow }: { title: string; description?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <div className="mb-4">{eyebrow}</div>}
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-[#1d0b3a] dark:text-foreground">{title}</h1>
      {description && <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

export function AuthFallback() {
  return <div className="h-80 animate-pulse rounded-2xl bg-muted/60" aria-hidden />;
}
