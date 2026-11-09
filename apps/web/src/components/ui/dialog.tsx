"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  hideClose,
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content> & { size?: "sm" | "md" | "lg" | "xl"; hideClose?: boolean }) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(2_5_8/0.72)] backdrop-blur-[3px] data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border-strong bg-popover p-6 hairline-top text-foreground shadow-lg outline-none scrollbar-thin data-[state=open]:animate-[fade-up_0.25s_var(--ease-out)]",
          widths[size],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <D.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5 space-y-1.5 pr-6", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Title>) {
  return <D.Title className={cn("text-[17px] font-semibold tracking-[-0.015em]", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof D.Description>) {
  return <D.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
