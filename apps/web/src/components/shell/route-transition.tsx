"use client";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/ui/tech";

/** Subtle per-route entrance (opacity + 6px rise). Keyed by pathname; query changes don't re-animate. */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <PageTransition routeKey={pathname}>{children}</PageTransition>;
}
