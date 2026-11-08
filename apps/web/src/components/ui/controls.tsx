"use client";
import * as React from "react";
import { Checkbox as C, Switch as Sw, RadioGroup as R, Progress as P, Separator as Sep, Avatar as Av, Tooltip as T, Popover as Po } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export const Checkbox = React.forwardRef<React.ComponentRef<typeof C.Root>, React.ComponentPropsWithoutRef<typeof C.Root>>(
  ({ className, ...props }, ref) => (
    <C.Root
      ref={ref}
      className={cn(
        "peer flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-card shadow-xs transition focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=checked]:text-white data-[state=indeterminate]:text-white disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </C.Indicator>
    </C.Root>
  ),
);
Checkbox.displayName = "Checkbox";

export const Switch = React.forwardRef<React.ComponentRef<typeof Sw.Root>, React.ComponentPropsWithoutRef<typeof Sw.Root>>(
  ({ className, ...props }, ref) => (
    <Sw.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-border-strong transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </Sw.Root>
  ),
);
Switch.displayName = "Switch";

export const RadioGroup = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof R.Root>) => (
  <R.Root className={cn("grid gap-2", className)} {...props} />
);
export const RadioGroupItem = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof R.Item>) => (
  <R.Item
    className={cn("flex size-4 items-center justify-center rounded-full border border-border-strong bg-card data-[state=checked]:border-primary", className)}
    {...props}
  >
    <R.Indicator className="size-2 rounded-full bg-primary" />
  </R.Item>
);

export function Progress({ value = 0, className, indicatorClassName }: { value?: number; className?: string; indicatorClassName?: string }) {
  return (
    <P.Root className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} value={value}>
      <P.Indicator
        className={cn("h-full rounded-full bg-primary transition-transform duration-500 ease-out", indicatorClassName)}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </P.Root>
  );
}

export function Separator({ className, orientation = "horizontal", ...props }: React.ComponentPropsWithoutRef<typeof Sep.Root>) {
  return (
    <Sep.Root
      orientation={orientation}
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
}

const avatarPalette = [
  "bg-[#efeaff] text-[#5234e6]",
  "bg-[#e6f0ff] text-[#1d4ed8]",
  "bg-[#fde8f6] text-[#a21caf]",
  "bg-[#e3f8f1] text-[#047857]",
  "bg-[#fff1e0] text-[#b45309]",
  "bg-[#e5f6fb] text-[#0e7490]",
];

export function Avatar({ name, src, size = 32, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const hash = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <Av.Root
      className={cn("relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full", className)}
      style={{ width: size, height: size }}
    >
      {src && <Av.Image src={src} alt={name ?? ""} className="size-full object-cover" />}
      <Av.Fallback
        className={cn("flex size-full items-center justify-center font-semibold", avatarPalette[hash % avatarPalette.length])}
        style={{ fontSize: Math.max(10, size * 0.36) }}
      >
        {initials(name)}
      </Av.Fallback>
    </Av.Root>
  );
}

export const TooltipProvider = T.Provider;
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md data-[state=delayed-open]:animate-[fade-up_0.15s_ease-out]"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const Popover = Po.Root;
export const PopoverTrigger = Po.Trigger;
export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof Po.Content>) {
  return (
    <Po.Portal>
      <Po.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 rounded-xl border border-border bg-popover p-3 text-foreground shadow-lg outline-none data-[state=open]:animate-[fade-up_0.15s_ease-out]", className)}
        {...props}
      />
    </Po.Portal>
  );
}
