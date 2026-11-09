"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = S.Root;
export const SelectValue = S.Value;
export const SelectGroup = S.Group;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof S.Trigger>,
  React.ComponentPropsWithoutRef<typeof S.Trigger> & { size?: "sm" | "md" }
>(({ className, children, size = "md", ...props }, ref) => (
  <S.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-[color-mix(in_oklab,var(--background-subtle)_70%,var(--card))] px-3 text-left text-sm outline-none transition hover:border-border-strong focus-visible:border-[color-mix(in_oklab,var(--primary)_70%,transparent)] focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent)] disabled:opacity-60 data-[placeholder]:text-subtle-foreground aria-[invalid=true]:border-danger [&>span]:truncate",
      size === "md" ? "h-10" : "h-8 text-[13px]",
      className,
    )}
    {...props}
  >
    {children}
    <S.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </S.Icon>
  </S.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export function SelectContent({ className, children, position = "popper", ...props }: React.ComponentPropsWithoutRef<typeof S.Content>) {
  return (
    <S.Portal>
      <S.Content
        position={position}
        sideOffset={6}
        className={cn(
          "relative z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-lg border border-border-strong bg-popover text-foreground shadow-lg data-[state=open]:animate-[fade-up_0.15s_ease-out]",
          position === "popper" && "w-[var(--radix-select-trigger-width)]",
          className,
        )}
        {...props}
      >
        <S.Viewport className="p-1">{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof S.Item>) {
  return (
    <S.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-md py-2 pl-2.5 pr-8 text-[13px] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <S.ItemText>{children}</S.ItemText>
      <span className="absolute right-2.5 flex size-4 items-center justify-center">
        <S.ItemIndicator>
          <Check className="size-3.5 text-primary" />
        </S.ItemIndicator>
      </span>
    </S.Item>
  );
}
