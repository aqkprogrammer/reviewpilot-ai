"use client";
import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Controlled confirmation dialog — usable from dropdown menu items (which unmount on close). */
export function ControlledConfirm({
  open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, confirmText, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => { if (!open) setTyped(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" hideClose>
        <div className="flex gap-4">
          {destructive && <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-foreground"><TriangleAlert className="size-5" /></div>}
          <div className="space-y-1.5">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="leading-relaxed">{description}</DialogDescription>
          </div>
        </div>
        {confirmText && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm.</p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation text" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            disabled={!!confirmText && typed !== confirmText}
            onClick={async () => { setBusy(true); try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); } }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
