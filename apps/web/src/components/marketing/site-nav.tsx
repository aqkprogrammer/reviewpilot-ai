"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ChevronDown, Menu, X, UtensilsCrossed, Stethoscope, Scissors, BedDouble, ArrowRight, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const industries = [
  { href: "/solutions/restaurants", label: "Restaurants & cafés", code: "IND.01", icon: UtensilsCrossed },
  { href: "/solutions/clinics", label: "Dental & clinics", code: "IND.02", icon: Stethoscope },
  { href: "/solutions/salons", label: "Salons & spas", code: "IND.03", icon: Scissors },
  { href: "/solutions/hotels", label: "Hotels", code: "IND.04", icon: BedDouble },
];

const links = [
  { href: "/features", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Resources" },
  { href: "/about", label: "About" },
];

const linkCls = "relative rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring";

function ActiveRule({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-3 -bottom-[13px] h-px bg-primary shadow-[0_0_8px_var(--primary)] transition-opacity duration-200",
        on ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  React.useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b px-5 transition-[background-color,border-color,backdrop-filter] duration-300 sm:px-8 lg:px-12",
        scrolled ? "border-border bg-background/78 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6" aria-label="Main">
        <Link href="/" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring" aria-label="ReviewPilot AI home">
          <Logo size={26} />
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          <Link href="/features" className={cn(linkCls, active("/features") ? "text-foreground" : "text-muted-foreground")}>
            Product
            <ActiveRule on={active("/features")} />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkCls, "inline-flex items-center gap-1 outline-none data-[state=open]:text-foreground", active("/solutions") ? "text-foreground" : "text-muted-foreground")}
            >
              Solutions <ChevronDown className="size-3.5 opacity-60 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              <ActiveRule on={active("/solutions")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={14} className="w-80 p-1.5">
              <p className="micro-label px-2.5 pb-1.5 pt-2">Industries</p>
              {industries.map((i) => (
                <DropdownMenuItem key={i.href} asChild>
                  <Link href={i.href} className="group py-2.5">
                    <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background-subtle">
                      <i.icon className="!size-4 !text-primary" />
                    </span>
                    <span className="flex-1 font-medium text-foreground">{i.label}</span>
                    <span className="font-mono text-[10px] tracking-[0.1em] text-subtle-foreground">{i.code}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href="/solutions" className="mt-1 justify-between border-t border-border pt-2.5 text-primary">
                  All industries <ArrowRight className="!text-primary" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {links.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className={cn(linkCls, active(l.href) ? "text-foreground" : "text-muted-foreground")}>
              {l.label}
              <ActiveRule on={active(l.href)} />
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild variant="gradient" size="sm" className="px-4">
            <Link href="/signup">
              Start Free <ArrowUpRight />
            </Link>
          </Button>
        </div>

        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger asChild>
            <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="dark fixed inset-0 z-50 bg-[rgb(2_5_8/0.78)] backdrop-blur-[3px] lg:hidden" />
            <D.Content className="dark fixed inset-x-3 top-3 z-50 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-border-strong bg-popover p-5 text-foreground shadow-lg outline-none data-[state=open]:animate-[fade-up_0.2s_ease-out] lg:hidden">
              <div className="flex items-center justify-between">
                <Logo size={24} />
                <D.Close className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close menu">
                  <X className="size-5" />
                </D.Close>
              </div>
              <D.Title className="sr-only">Navigation</D.Title>
              <D.Description className="sr-only">Site navigation links</D.Description>
              <div className="mt-5 grid gap-0.5">
                <MobileLink href="/features">Product</MobileLink>
                <p className="micro-label px-3 pb-1 pt-4">Solutions</p>
                {industries.map((i) => (
                  <MobileLink key={i.href} href={i.href}>
                    <i.icon className="size-4 text-primary" /> {i.label}
                    <span className="ml-auto font-mono text-[10px] text-subtle-foreground">{i.code}</span>
                  </MobileLink>
                ))}
                <div className="my-3 h-px bg-border" />
                {links.slice(1).map((l) => (
                  <MobileLink key={l.href} href={l.href}>
                    {l.label}
                  </MobileLink>
                ))}
                <MobileLink href="/faq">FAQ</MobileLink>
                <MobileLink href="/contact">Contact</MobileLink>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="lg">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="gradient" size="lg">
                  <Link href="/signup">Start Free</Link>
                </Button>
              </div>
            </D.Content>
          </D.Portal>
        </D.Root>
      </nav>
    </header>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-muted">
      {children}
    </Link>
  );
}
