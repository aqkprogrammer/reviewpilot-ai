"use client";
import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;

export function TabsList({ className, variant = "segmented", ...props }: React.ComponentPropsWithoutRef<typeof T.List> & { variant?: "segmented" | "underline" }) {
  return (
    <T.List
      className={cn(
        variant === "segmented"
          ? "inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-background-subtle p-0.5"
          : "flex items-center gap-5 border-b border-border",
        className,
      )}
      data-variant={variant}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-muted-foreground transition-all outline-none hover:text-foreground disabled:opacity-50 [&_svg]:size-3.5",
        "[[data-variant=segmented]_&]:h-full [[data-variant=segmented]_&]:rounded-md [[data-variant=segmented]_&]:px-3 [[data-variant=segmented]_&]:data-[state=active]:bg-card-elevated [[data-variant=segmented]_&]:data-[state=active]:text-foreground [[data-variant=segmented]_&]:data-[state=active]:shadow-[inset_0_0_0_1px_var(--border-strong)]",
        "[[data-variant=underline]_&]:-mb-px [[data-variant=underline]_&]:border-b-2 [[data-variant=underline]_&]:border-transparent [[data-variant=underline]_&]:pb-3 [[data-variant=underline]_&]:data-[state=active]:border-primary [[data-variant=underline]_&]:data-[state=active]:[box-shadow:0_8px_12px_-10px_var(--primary)] [[data-variant=underline]_&]:data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Content>) {
  return <T.Content className={cn("outline-none data-[state=active]:animate-[fade-up_0.25s_ease-out]", className)} {...props} />;
}
