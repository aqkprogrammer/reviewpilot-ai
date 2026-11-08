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
          className="rounded-md p-1.5 text-subtle-foreground transition hover:bg-muted hover:text-foreground"
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
const COLORS = ["bg-danger", "bg-danger", "bg-warning", "bg-blue", "bg-success"];

export function StrengthMeter({ value }: { value: string }) {
  const score = value ? passwordScore(value) : -1;
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors duration-300", score > i && COLORS[score])} />
        ))}
      </div>
      <span className="w-14 text-right text-[11px] font-medium text-muted-foreground">{score >= 0 ? LABELS[score] : ""}</span>
    </div>
  );
}
