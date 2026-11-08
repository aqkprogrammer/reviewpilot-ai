"use client";
import * as React from "react";
import { AlertDialog as A } from "radix-ui";
import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** When set, user must type this text to enable confirm (for high-impact destructive ops). */
  confirmText?: string;
}

export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", destructive, onConfirm, confirmText }: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const blocked = confirmText ? typed !== confirmText : false;

  return (
    <A.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTyped(""); }}>
      <A.Trigger asChild>{trigger}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-[rgb(10_8_25/0.45)] backdrop-blur-[2px]" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover p-6 shadow-lg data-[state=open]:animate-[fade-up_0.2s_ease-out]">
          <div className="flex gap-4">
            {destructive && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-foreground">
                <TriangleAlert className="size-5" />
              </div>
            )}
            <div className="space-y-1.5">
              <A.Title className="text-base font-semibold">{title}</A.Title>
              <A.Description className="text-sm leading-relaxed text-muted-foreground">{description}</A.Description>
            </div>
          </div>
          {confirmText && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm.
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                aria-label="Confirmation text"
              />
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </A.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={busy}
              disabled={blocked}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
