"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content> & { side?: "right" | "left" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(10_8_25/0.35)] backdrop-blur-[1px]" />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col border-border bg-popover text-foreground shadow-lg outline-none sm:max-w-xl",
          side === "right" ? "right-0 border-l data-[state=open]:animate-[sheet-in-right_0.3s_var(--ease-out)]" : "left-0 border-r data-[state=open]:animate-[sheet-in-left_0.3s_var(--ease-out)]",
          className,
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-border px-6 py-5 pr-12", className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5 scrollbar-thin", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-border px-6 py-4", className)} {...props} />;
}
export const SheetTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Title>) => (
  <D.Title className={cn("text-base font-semibold tracking-tight", className)} {...props} />
);
export const SheetDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Description>) => (
  <D.Description className={cn("mt-1 text-[13px] text-muted-foreground", className)} {...props} />
);
