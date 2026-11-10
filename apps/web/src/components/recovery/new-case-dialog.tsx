"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { POLICY_HINT, policyIssue, type CaseDetail, type Severity } from "./types";

/** Manual case for an issue that arrived outside ReviewPilot (a call, a walk-in complaint). */
export function NewCaseDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { locations, locationId } = useOrg();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [loc, setLoc] = React.useState<string>(locationId ?? locations[0]?.id ?? "");
  const [severity, setSeverity] = React.useState<Severity>("high");
  const create = useMutation({
    mutationFn: () => api.post<CaseDetail>("/recovery", { title: title.trim(), summary: summary.trim() || null, location_id: loc || null, severity }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["recovery"] });
      toast.success("Recovery case opened");
      setTitle("");
      setSummary("");
      onOpenChange(false);
      onCreated(c.id);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bad = policyIssue(summary);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="micro-label">Recovery · Manual case</p>
          <DialogTitle>Open a recovery case</DialogTitle>
          <DialogDescription>For a complaint that reached you by phone, in person or another channel. To open one for a review or feedback, use the button in the Reviews inbox.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 3 && !bad) create.mutate(); }}>
          <FormField label="Title" htmlFor="nc-title" required>
            <Input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. Walk-in complaint about a cold order" autoFocus />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Location" htmlFor="nc-loc">
              <Select value={loc} onValueChange={setLoc}>
                <SelectTrigger id="nc-loc"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Severity" htmlFor="nc-sev">
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger id="nc-sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="What happened?" htmlFor="nc-sum" error={bad ? POLICY_HINT : undefined}>
            <Textarea id="nc-sum" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={2000} invalid={bad} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending} disabled={title.trim().length < 3 || bad}>Open case</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
