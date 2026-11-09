import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

const fieldBase =
  "w-full rounded-lg border border-input bg-[color-mix(in_oklab,var(--background-subtle)_70%,var(--card))] text-sm text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)] transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-[color-mix(in_oklab,var(--primary)_70%,transparent)] focus-visible:bg-card focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_14%,transparent)]";

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, leading, trailing, invalid, type = "text", ...props }, ref) => {
  const input = (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(fieldBase, "h-10 px-3", leading && "pl-9", trailing && "pr-10", className)}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle-foreground [&_svg]:size-4">{leading}</span>}
      {input}
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </div>
  );
});
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea, fieldBase };
