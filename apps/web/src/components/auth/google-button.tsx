"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleIcon } from "@/components/brand/brand-icons";
import { Tooltip } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Providers { google: boolean; google_mock: boolean; demo_mode: boolean }

export function useProviders() {
  return useQuery({ queryKey: ["auth", "providers"], queryFn: () => api.get<Providers>("/auth/providers", undefined, { orgId: null }), staleTime: 300_000 });
}

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const { data, isLoading } = useProviders();
  const enabled = !!data?.google;
  const href = `/api/v1/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const cls =
    "relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border-strong bg-card text-[14px] font-medium text-foreground shadow-xs transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      <GoogleIcon className="size-[18px]" />
      {label}
      {data?.google_mock && (
        <span className="absolute right-3 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">Dev mock</span>
      )}
    </>
  );
  if (isLoading || enabled) {
    return (
      <a href={href} className={cn(cls, isLoading && "pointer-events-none opacity-70")} aria-disabled={isLoading || undefined}>
        {content}
      </a>
    );
  }
  return (
    <Tooltip content="Google Sign-In isn't configured on this server yet">
      <span tabIndex={0} className={cn(cls, "cursor-not-allowed opacity-55 hover:bg-card")} aria-disabled="true" role="button">
        {content}
      </span>
    </Tooltip>
  );
}

export function OrDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center gap-3 text-[11.5px] uppercase tracking-[0.12em] text-subtle-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
