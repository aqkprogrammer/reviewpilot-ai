"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpgradePrompt } from "@/components/billing/plan-gate";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LocationPicker } from "./location-picker";
import { ROLE_INFO, assignableRoles } from "./roles";

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { membership } = useOrg();
  const qc = useQueryClient();
  const roles = assignableRoles(membership.role);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("manager");
  const [restrict, setRestrict] = React.useState(false);
  const [locs, setLocs] = React.useState<string[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setEmail(""); setRole(roles.includes("manager") ? "manager" : roles[0]); setRestrict(false); setLocs([]); setErr(null); setLimit(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = useMutation({
    mutationFn: () => api.post("/team/invitations", { email, role, location_ids: restrict ? locs : [] }),
    onSuccess: () => { toast.success(`Invitation sent to ${email}`); qc.invalidateQueries({ queryKey: ["team"] }); onOpenChange(false); },
    onError: (e) => { if (e instanceof ApiError && e.status === 402) setLimit(e.message); else toast.error(errorMessage(e)); },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Enter a valid email address");
    if (restrict && !locs.length) return setErr("Pick at least one location or turn off the restriction");
    setErr(null);
    invite.mutate();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Invite a team member</DialogTitle><DialogDescription>They&apos;ll get an email with a link valid for 7 days.</DialogDescription></DialogHeader>
        {limit ? <UpgradePrompt compact message={limit} /> : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <FormField label="Email address" htmlFor="inv-email" error={err?.includes("email") ? err : undefined}>
              <Input id="inv-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@business.com" />
            </FormField>
            <fieldset>
              <legend className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Role</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    aria-pressed={role === r}
                    className={cn("relative rounded-lg border p-3 text-left transition", role === r ? "border-primary bg-primary-soft shadow-[0_0_0_1px_var(--primary),0_0_18px_-8px_var(--primary)]" : "border-border bg-background-subtle/50 hover:border-border-strong hover:bg-surface-hover")}
                  >
                    <p className="flex items-center justify-between text-[13px] font-semibold">{ROLE_INFO[r].label}<span className={cn("size-1.5 rounded-full", role === r ? "bg-primary shadow-[0_0_6px_var(--primary)]" : "bg-border-strong")} aria-hidden /></p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ROLE_INFO[r].description}</p>
                  </button>
                ))}
              </div>
            </fieldset>
            {!["owner", "admin"].includes(role) && (
              <div className="space-y-3 rounded-lg border border-border bg-background-subtle p-4">
                <label className="flex items-center justify-between gap-3 text-[13px]">
                  <span><span className="font-medium">Limit to specific locations</span><span className="block text-xs text-muted-foreground">Otherwise they can work with every location</span></span>
                  <Switch checked={restrict} onCheckedChange={setRestrict} />
                </label>
                {restrict && <LocationPicker value={locs} onChange={setLocs} />}
              </div>
            )}
            {err && !err.includes("email") && <p className="text-xs font-medium text-danger-foreground">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={invite.isPending}>Send invitation</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
