"use client";
import { Accordion as A } from "radix-ui";
import { Plus } from "lucide-react";
import { FAQS } from "./faq-data";

export function FaqList({ items = FAQS }: { items?: { q: string; a: string }[] }) {
  return (
    <>
    <A.Root type="single" collapsible defaultValue="item-0" className="divide-y divide-border rounded-[22px] border border-border bg-card shadow-sm">
      {items.map((f, i) => (
        <A.Item key={f.q} value={`item-${i}`} className="group">
          <A.Header>
            <A.Trigger className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-[15px] font-semibold text-foreground outline-none transition hover:text-primary focus-visible:bg-muted/50">
              {f.q}
              <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-45" />
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_0.2s_ease-out] data-[state=open]:animate-[accordion-down_0.25s_ease-out]">
            <p className="px-6 pb-5 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
    <style>{`@keyframes accordion-down{from{height:0}to{height:var(--radix-accordion-content-height)}}@keyframes accordion-up{from{height:var(--radix-accordion-content-height)}to{height:0}}`}</style>
    </>
  );
}
