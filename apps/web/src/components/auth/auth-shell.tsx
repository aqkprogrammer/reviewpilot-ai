import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ForceDark } from "@/components/marketing/force-dark";
import { BrandPanel } from "./brand-panel";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <ForceDark />
      <div className="mx-auto grid min-h-dvh max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="relative flex flex-col overflow-hidden px-5 py-5 sm:px-10 lg:px-14">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-[360px] bg-tech-grid opacity-60 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
            <div className="absolute -left-40 -top-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--cyan)_10%,transparent),transparent)]" />
          </div>
          <div className="relative flex items-center justify-between gap-4">
            <Link href="/" aria-label="ReviewPilot AI home" className="rounded-md focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring">
              <Logo size={26} />
            </Link>
            <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle-foreground transition-colors hover:text-primary">
              <ArrowLeft className="size-3.5" /> Back to site
            </Link>
          </div>
          <main className="relative flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[420px]">{children}</div>
          </main>
          <footer className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle-foreground">
            <span>© {new Date().getFullYear()} ReviewPilot AI</span>
            <span className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">Help</Link>
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
      {eyebrow && (
        <p className="mb-4 inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" aria-hidden />
          {eyebrow}
        </p>
      )}
      <h1 className="text-balance text-[30px] font-semibold leading-[1.08] tracking-[-0.04em] text-foreground">{title}</h1>
      {description && <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

export function AuthFallback() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="skeleton h-3 w-28 rounded-sm" />
      <div className="skeleton h-8 w-56 rounded-md" />
      <div className="skeleton mt-6 h-11 w-full rounded-lg" />
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-10 w-full rounded-lg" />
    </div>
  );
}
