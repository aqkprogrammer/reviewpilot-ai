"use client";
import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { passwordScore } from "./auth-utils";

export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing" | "leading">>((props, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={show ? "text" : "password"}
      leading={<Lock />}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-md p-1.5 text-subtle-foreground transition hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = "PasswordInput";

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["bg-danger", "bg-danger", "bg-amber", "bg-ice", "bg-mint"];
const TEXT = ["text-danger-foreground", "text-danger-foreground", "text-amber", "text-ice", "text-mint"];

export function StrengthMeter({ value }: { value: string }) {
  const score = value ? passwordScore(value) : -1;
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle-foreground">Strength</span>
      <div className="flex flex-1 gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-[3px] flex-1 rounded-[1px] bg-border-strong transition-colors duration-300", score > i && COLORS[score], score > i && "shadow-[0_0_6px_-1px_currentColor]", score > i && TEXT[score])} />
        ))}
      </div>
      <span className={cn("w-16 text-right font-mono text-[10px] uppercase tracking-[0.1em]", score >= 0 ? TEXT[score] : "text-subtle-foreground")}>{score >= 0 ? LABELS[score] : ""}</span>
    </div>
  );
}
