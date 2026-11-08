import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
  labelAction,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  labelAction?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </Label>
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-foreground" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
