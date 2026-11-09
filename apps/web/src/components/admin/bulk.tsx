"use client";
/**
 * Bulk operations without a bulk endpoint: calls the existing audited per-row endpoint
 * sequentially with one shared reason, after a typed confirmation. Shows progress and
 * a per-row result so a partial failure is never silent.
 */
import * as React from "react";
import { CircleCheck, CircleSlash, CircleX, LoaderCircle, ScrollText, TriangleAlert } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/controls";

export interface BulkTarget { id: string; label: string; sub?: string; /** Reason this row will be skipped (not eligible). */ skip?: string | null }
type RowState = { state: "pending" | "running" | "ok" | "error" | "skipped"; message?: string };

export function BulkActionDialog({
  open, onOpenChange, title, description, targets, confirmLabel, destructive, phrase, run, onFinished, children, extraValid = true, verb = "Processing", requireReason = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  targets: BulkTarget[];
  confirmLabel: string;
  destructive?: boolean;
  /** Text the operator must type to arm the action, e.g. "SUSPEND 3". */
  phrase?: string;
  run: (id: string, reason: string) => Promise<unknown>;
  onFinished?: () => void;
  children?: React.ReactNode;
  extraValid?: boolean;
  verb?: string;
  /** Some endpoints (e.g. ticket updates) are audited without a free-text reason. */
  requireReason?: boolean;
}) {
  const [phase, setPhase] = React.useState<"compose" | "running" | "done">("compose");
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [rows, setRows] = React.useState<Record<string, RowState>>({});
  const stopRef = React.useRef(false);
  const frozen = React.useRef<BulkTarget[]>([]);

  React.useEffect(() => {
    if (open) {
      setPhase("compose"); setReason(""); setTyped(""); setRows({}); stopRef.current = false;
      frozen.current = targets;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = phase === "compose" ? targets : frozen.current;
  const eligible = list.filter((t) => !t.skip);
  const valid = (!requireReason || reason.trim().length >= 4) && (!phrase || typed.trim().toUpperCase() === phrase.toUpperCase()) && eligible.length > 0 && extraValid;
  const done = Object.values(rows).filter((r) => r.state !== "pending" && r.state !== "running").length;
  const ok = Object.values(rows).filter((r) => r.state === "ok").length;
  const failed = Object.values(rows).filter((r) => r.state === "error").length;
  const skipped = Object.values(rows).filter((r) => r.state === "skipped").length;

  const start = async () => {
    frozen.current = targets;
    const init: Record<string, RowState> = {};
    for (const t of targets) init[t.id] = t.skip ? { state: "skipped", message: t.skip } : { state: "pending" };
    setRows(init);
    setPhase("running");
    const r = reason.trim();
    for (const t of targets) {
      if (t.skip) continue;
      if (stopRef.current) { setRows((s) => ({ ...s, [t.id]: { state: "skipped", message: "Stopped by operator" } })); continue; }
      setRows((s) => ({ ...s, [t.id]: { state: "running" } }));
      try {
        await run(t.id, r);
        setRows((s) => ({ ...s, [t.id]: { state: "ok" } }));
      } catch (e) {
        setRows((s) => ({ ...s, [t.id]: { state: "error", message: errorMessage(e) } }));
      }
    }
    setPhase("done");
    onFinished?.();
  };

  const busy = phase === "running";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent size="md" hideClose={busy} onEscapeKeyDown={(e) => busy && e.preventDefault()} onInteractOutside={(e) => busy && e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", destructive ? "border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger-foreground" : "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft text-primary")}>
              {destructive ? <TriangleAlert className="size-4" /> : <ScrollText className="size-4" />}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="micro-label">Bulk operation · {eligible.length} of {list.length} eligible</p>
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {phase !== "compose" && (
          <div className="mb-4 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em]">
              <span className="text-muted-foreground">{phase === "running" ? `${verb}…` : "Complete"}</span>
              <span className="tabular text-foreground">{done} / {list.length}</span>
            </div>
            <Progress value={list.length ? (done / list.length) * 100 : 0} indicatorClassName={failed ? "bg-warning shadow-none" : undefined} />
            {phase === "done" && (
              <p className="font-mono text-[11px] tabular text-muted-foreground">
                <span className="text-success">{ok} succeeded</span> · <span className={failed ? "text-danger-foreground" : ""}>{failed} failed</span> · {skipped} skipped
              </p>
            )}
          </div>
        )}

        <ul className="mb-4 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background-subtle scrollbar-thin" aria-label="Targets">
          {list.map((t) => {
            const r = rows[t.id];
            const state = r?.state ?? (t.skip ? "skipped" : "pending");
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <span className="flex size-4 shrink-0 items-center justify-center" aria-label={state}>
                  {state === "running" ? <LoaderCircle className="size-3.5 animate-spin text-primary" />
                    : state === "ok" ? <CircleCheck className="size-3.5 text-success" />
                    : state === "error" ? <CircleX className="size-3.5 text-danger" />
                    : state === "skipped" ? <CircleSlash className="size-3.5 text-subtle-foreground" />
                    : <span className="size-1.5 rounded-full bg-border-strong" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", state === "skipped" ? "text-muted-foreground" : "text-foreground")}>{t.label}</span>
                  {(r?.message || t.skip || t.sub) && (
                    <span className={cn("block truncate font-mono text-[10.5px]", state === "error" ? "text-danger-foreground" : "text-subtle-foreground")}>{r?.message ?? t.skip ?? t.sub}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {phase === "compose" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) start(); }}>
            {children}
            {requireReason && (
              <FormField label="Reason (applied to every row, recorded in the audit log)" htmlFor="bulk-reason" required hint="At least 4 characters.">
                <Textarea id="bulk-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
              </FormField>
            )}
            {phrase && (
              <FormField label={`Type ${phrase} to arm this action`} htmlFor="bulk-phrase">
                <Input id="bulk-phrase" value={typed} onChange={(e) => setTyped(e.target.value)} className="font-mono uppercase" autoComplete="off" placeholder={phrase} />
              </FormField>
            )}
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant={destructive ? "danger" : "primary"} disabled={!valid}>{confirmLabel} · {eligible.length}</Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter className="mt-2">
            {phase === "running" ? (
              <Button variant="outline" onClick={() => { stopRef.current = true; }}>Stop after current</Button>
            ) : (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
