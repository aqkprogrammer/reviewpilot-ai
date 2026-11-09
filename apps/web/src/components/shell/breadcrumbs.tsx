"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ALL_NAV } from "./nav";

const EXTRA: Record<string, string> = { new: "New", checkout: "Checkout" };

/** Route-derived breadcrumbs for the business app: Workspace / Section / Detail. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["app", "campaigns", "123"]
  if (parts[0] !== "app") return null;
  const section = ALL_NAV.find((n) => n.href !== "/app" && pathname.startsWith(n.href));
  const crumbs: { label: string; href?: string }[] = [{ label: "Workspace", href: "/app" }];
  if (!section) crumbs.push({ label: "Overview" });
  else {
    crumbs.push({ label: section.label, href: parts.length > 2 ? section.href : undefined });
    if (parts.length > 2) crumbs.push({ label: EXTRA[parts[2]] ?? "Detail" });
  }
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-subtle-foreground lg:flex">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" />}
          {c.href ? (
            <Link href={c.href} className="truncate transition hover:text-foreground">{c.label}</Link>
          ) : (
            <span className="truncate text-foreground-soft" aria-current="page">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
