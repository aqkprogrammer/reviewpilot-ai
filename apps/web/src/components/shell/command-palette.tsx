"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { CornerDownLeft, Search, Star, User } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { api } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { ALL_NAV } from "./nav";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const router = useRouter();
  const { can } = useOrg();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reviews = useQuery({
    queryKey: ["search", "reviews", dq],
    queryFn: () => api.get<{ items: { id: string; reviewer_name: string | null; rating: number; comment: string | null }[] }>("/reviews", { q: dq, page_size: 5 }),
    enabled: open && dq.length >= 2 && can("reviews.read"),
  });
  const customers = useQuery({
    queryKey: ["search", "customers", dq],
    queryFn: () => api.get<{ items: { id: string; name: string | null; email: string | null; phone: string | null }[] }>("/customers", { q: dq, page_size: 5 }),
    enabled: open && dq.length >= 2 && can("customers.read"),
  });

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const nav = ALL_NAV.filter((i) => !i.permission || can(i.permission));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-border bg-background-subtle px-3 text-[13px] text-subtle-foreground transition hover:border-border-strong hover:bg-card md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search reviews, customers, pages…</span>
        <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="flex size-8 items-center justify-center rounded-lg text-foreground-soft hover:bg-muted md:hidden" aria-label="Search">
        <Search className="size-4" />
      </button>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[rgb(10_8_25/0.4)] backdrop-blur-[2px]" />
          <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg data-[state=open]:animate-[fade-up_0.18s_ease-out]">
            <D.Title className="sr-only">Search</D.Title>
            <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-subtle-foreground">
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="size-4 text-muted-foreground" />
                <Command.Input value={q} onValueChange={setQ} placeholder="Search reviews, customers or jump to a page" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground" />
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">No results for “{q}”.</Command.Empty>
                {!!reviews.data?.items.length && (
                  <Command.Group heading="Reviews">
                    {reviews.data.items.map((r) => (
                      <Item key={r.id} onSelect={() => go(`/app/reviews?review=${r.id}`)} icon={Star} title={`${r.reviewer_name ?? "Anonymous"} · ${r.rating}★`} sub={r.comment ?? "Rating only"} />
                    ))}
                  </Command.Group>
                )}
                {!!customers.data?.items.length && (
                  <Command.Group heading="Customers">
                    {customers.data.items.map((c) => (
                      <Item key={c.id} onSelect={() => go(`/app/customers/${c.id}`)} icon={User} title={c.name ?? "Unnamed customer"} sub={c.email ?? c.phone ?? ""} />
                    ))}
                  </Command.Group>
                )}
                <Command.Group heading="Pages">
                  {nav
                    .filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()))
                    .map((i) => <Item key={i.href} onSelect={() => go(i.href)} icon={i.icon} title={i.label} />)}
                </Command.Group>
              </Command.List>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}

function Item({ icon: Icon, title, sub, onSelect }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string; onSelect: () => void }) {
  return (
    <Command.Item onSelect={onSelect} className="group flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] data-[selected=true]:bg-muted">
      <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card"><Icon className="size-3.5 text-muted-foreground" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      <CornerDownLeft className="size-3.5 text-subtle-foreground opacity-0 group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
