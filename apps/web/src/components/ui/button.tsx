import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,border-color,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-primary-hover",
        gradient:
          "rounded-full text-white bg-[linear-gradient(100deg,var(--magenta),var(--purple)_55%,var(--primary))] shadow-glow-magenta hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
        secondary: "bg-foreground text-background hover:bg-foreground/85",
        outline:
          "border border-border-strong bg-card text-foreground shadow-xs hover:bg-muted hover:border-border-strong",
        soft: "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
        ghost: "text-foreground-soft hover:bg-muted hover:text-foreground",
        danger: "bg-danger text-white hover:bg-danger/90 shadow-xs",
        "danger-soft": "bg-danger-soft text-danger-foreground hover:bg-danger-soft/70",
        link: "text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        xs: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-lg px-3 text-[13px] [&_svg]:size-4",
        md: "h-9 rounded-lg px-4 text-sm [&_svg]:size-4",
        lg: "h-11 rounded-xl px-5 text-[15px] [&_svg]:size-4",
        xl: "h-12 rounded-xl px-7 text-base [&_svg]:size-5",
        icon: "size-9 rounded-lg [&_svg]:size-4",
        "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
        "icon-xs": "size-7 rounded-md [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <LoaderCircle className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
