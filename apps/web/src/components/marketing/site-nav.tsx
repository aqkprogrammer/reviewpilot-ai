"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ChevronDown, Menu, X, UtensilsCrossed, Stethoscope, Scissors, BedDouble, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const industries = [
  { href: "/solutions/restaurants", label: "Restaurants & cafés", icon: UtensilsCrossed },
  { href: "/solutions/clinics", label: "Dental & clinics", icon: Stethoscope },
  { href: "/solutions/salons", label: "Salons & spas", icon: Scissors },
  { href: "/solutions/hotels", label: "Hotels", icon: BedDouble },
];

const links = [
  { href: "/features", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Resources" },
  { href: "/about", label: "About" },
];

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
    <header className={cn("sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300", scrolled ? "bg-card/80 shadow-[0_1px_0_var(--border)] backdrop-blur-xl" : "bg-transparent")}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8 lg:h-[72px] lg:px-12" aria-label="Main">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="ReviewPilot AI home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <Link href={links[0].href} className={cn("rounded-lg px-3 py-2 text-[14px] font-medium transition-colors hover:text-foreground", active("/features") ? "text-foreground" : "text-foreground-soft")}>
            Product
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] font-medium outline-none transition-colors hover:text-foreground data-[state=open]:text-foreground", active("/solutions") ? "text-foreground" : "text-foreground-soft")}>
              Solutions <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-1.5">
              {industries.map((i) => (
                <DropdownMenuItem key={i.href} asChild>
                  <Link href={i.href} className="py-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft">
                      <i.icon className="!text-primary-soft-foreground" />
                    </span>
                    <span className="font-medium text-foreground">{i.label}</span>
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
            <Link key={l.href} href={l.href} className={cn("rounded-lg px-3 py-2 text-[14px] font-medium transition-colors hover:text-foreground", active(l.href) ? "text-foreground" : "text-foreground-soft")}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="md">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild variant="gradient" size="md" className="px-5">
            <Link href="/signup">Start Free</Link>
          </Button>
        </div>

        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-[rgb(10_8_25/0.35)] backdrop-blur-[2px] lg:hidden" />
            <D.Content className="fixed inset-x-3 top-3 z-50 rounded-2xl border border-border bg-popover p-5 shadow-lg outline-none data-[state=open]:animate-[fade-up_0.2s_ease-out] lg:hidden">
              <div className="flex items-center justify-between">
                <Logo />
                <D.Close className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close menu">
                  <X className="size-5" />
                </D.Close>
              </div>
              <D.Title className="sr-only">Navigation</D.Title>
              <D.Description className="sr-only">Site navigation links</D.Description>
              <div className="mt-5 grid gap-1">
                <MobileLink href="/features">Product</MobileLink>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Solutions</p>
                {industries.map((i) => (
                  <MobileLink key={i.href} href={i.href}>
                    <i.icon className="size-4 text-primary" /> {i.label}
                  </MobileLink>
                ))}
                <div className="my-2 h-px bg-border" />
                {links.slice(1).map((l) => (
                  <MobileLink key={l.href} href={l.href}>{l.label}</MobileLink>
                ))}
                <MobileLink href="/faq">FAQ</MobileLink>
                <MobileLink href="/contact">Contact</MobileLink>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="lg"><Link href="/login">Log in</Link></Button>
                <Button asChild variant="gradient" size="lg"><Link href="/signup">Start Free</Link></Button>
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
    <Link href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-muted">
      {children}
    </Link>
  );
}
