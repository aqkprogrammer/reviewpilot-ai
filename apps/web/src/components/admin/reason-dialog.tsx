"use client";
import * as React from "react";
import { ScrollText, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

function Glyph({ destructive }: { destructive?: boolean }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", destructive ? "border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger-foreground" : "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft text-primary")}>
      {destructive ? <TriangleAlert className="size-4" /> : <ScrollText className="size-4" />}
    </span>
  );
}

/** Confirmation that captures an audit reason (and optionally a typed confirmation string). */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, destructive, confirmText, loading, onConfirm, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: React.ReactNode; confirmLabel: string; destructive?: boolean;
  confirmText?: string; loading?: boolean; onConfirm: (reason: string) => void; children?: React.ReactNode;
}) {
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => { if (open) { setReason(""); setTyped(""); } }, [open]);
  const valid = reason.trim().length >= 4 && (!confirmText || typed === confirmText);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Glyph destructive={destructive} />
            <div className="min-w-0 space-y-1">
              <p className="micro-label">Audited action</p>
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(reason.trim()); }} className="space-y-4">
          {children}
          <FormField label="Reason (recorded in the audit log)" htmlFor="reason" required hint="At least 4 characters.">
            <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
          </FormField>
          {confirmText && (
            <FormField label={`Type ${confirmText} to confirm`} htmlFor="confirm-text">
              <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} className="font-mono" autoComplete="off" placeholder={confirmText} />
            </FormField>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant={destructive ? "danger" : "primary"} disabled={!valid} loading={loading}>{confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Controlled yes/no confirmation (for actions launched from menus). */
export function ControlledConfirm({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: React.ReactNode; confirmLabel?: string; destructive?: boolean; onConfirm: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Glyph destructive={destructive} />
            <div className="min-w-0 space-y-1">
              <p className="micro-label">Confirm · audited</p>
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? "danger" : "primary"} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); } }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
