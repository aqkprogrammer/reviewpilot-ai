"use client";
import { Accordion as A } from "radix-ui";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQS } from "./faq-data";

export function FaqList({ items = FAQS, className }: { items?: { q: string; a: string }[]; className?: string }) {
  return (
    <A.Root type="single" collapsible defaultValue="item-0" className={cn("border-t border-border", className)}>
      {items.map((f, i) => (
        <A.Item key={f.q} value={`item-${i}`} className="group border-b border-border">
          <A.Header>
            <A.Trigger className="relative flex w-full items-start gap-5 py-5 text-left outline-none transition-colors focus-visible:bg-surface-hover/50">
              <span aria-hidden className="absolute -left-px inset-y-[-1px] w-px bg-primary opacity-0 shadow-[0_0_10px_var(--primary)] transition-opacity group-data-[state=open]:opacity-100" />
              <span className="w-10 shrink-0 pl-3 pt-0.5 font-mono text-[10.5px] text-subtle-foreground transition-colors group-data-[state=open]:text-primary">Q.{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-[15.5px] font-medium leading-snug text-foreground-soft transition-colors group-hover:text-foreground group-data-[state=open]:text-foreground">{f.q}</span>
              <span className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-all duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:border-[color-mix(in_oklab,var(--primary)_40%,transparent)] group-data-[state=open]:text-primary">
                <Plus className="size-3.5" />
              </span>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_0.2s_ease-out] data-[state=open]:animate-[accordion-down_0.25s_ease-out]">
            <p className="max-w-2xl pb-6 pl-[60px] pr-10 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}
