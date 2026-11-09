import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/btn relative inline-flex shrink-0 select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-medium tracking-[-0.005em] transition-[background-color,box-shadow,color,border-color,transform,filter] duration-200 ease-out focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Signal action: solid cyan/ice with a restrained glow on hover. */
        primary:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.35)] hover:bg-primary-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.35),var(--glow)]",
        /* Hero / marketing CTA: cyan → ice signal gradient with a light sweep on hover. */
        gradient:
          "rounded-lg text-[#031417] bg-[linear-gradient(100deg,var(--cyan),color-mix(in_oklab,var(--cyan)_45%,var(--ice))_60%,var(--ice))] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_10px_30px_-10px_color-mix(in_oklab,var(--cyan)_70%,transparent)] hover:brightness-110 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:skew-x-[-20deg] before:bg-white/35 before:opacity-0 before:transition-all before:duration-700 hover:before:left-[120%] hover:before:opacity-100",
        secondary: "bg-foreground text-background hover:bg-foreground/88",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--border-strong))] hover:bg-surface-hover",
        soft: "border border-[color-mix(in_oklab,var(--primary)_22%,transparent)] bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_oklab,var(--primary)_16%,transparent)]",
        ghost: "text-foreground-soft hover:bg-surface-hover hover:text-foreground",
        danger: "bg-danger text-white hover:brightness-110 shadow-xs",
        "danger-soft": "border border-[color-mix(in_oklab,var(--danger)_25%,transparent)] bg-danger-soft text-danger-foreground hover:bg-[color-mix(in_oklab,var(--danger)_18%,transparent)]",
        link: "px-0 text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        xs: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-md px-3 text-[13px] [&_svg]:size-4",
        md: "h-9 rounded-lg px-4 text-sm [&_svg]:size-4",
        lg: "h-11 rounded-lg px-5 text-[15px] [&_svg]:size-4",
        xl: "h-12 rounded-lg px-7 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 rounded-lg [&_svg]:size-4",
        "icon-sm": "size-8 rounded-md [&_svg]:size-4",
        "icon-xs": "size-7 rounded-md [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
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
