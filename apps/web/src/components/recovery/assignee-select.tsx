"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn, initials } from "@/lib/utils";
import type { Assignee, CaseDetail } from "./types";

export function useAssignees(locationId?: string | null) {
  const { orgId, can } = useOrg();
  return useQuery({
    queryKey: ["recovery", "assignees", orgId, locationId ?? null],
    queryFn: () => api.get<Assignee[]>("/recovery/assignees", { location_id: locationId ?? undefined }),
    enabled: can("reviews.read"),
    staleTime: 60_000,
  });
}

const UNASSIGNED = "__none";

/** Inline assignee picker; read-only text for members who can't act. */
export function AssigneeSelect({
  caseId, locationId, assigneeId, assigneeName, canAct, size = "sm", className, onUpdated,
}: {
  caseId: string;
  locationId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  canAct: boolean;
  size?: "sm" | "md";
  className?: string;
  onUpdated?: (c: CaseDetail) => void;
}) {
  const qc = useQueryClient();
  const people = useAssignees(locationId);
  const update = useMutation({
    mutationFn: (v: string) => api.patch<CaseDetail>(`/recovery/${caseId}`, v === UNASSIGNED ? { unassign: true } : { assignee_id: v }),
    onSuccess: (c) => {
      onUpdated?.(c);
      qc.invalidateQueries({ queryKey: ["recovery"] });
      toast.success(c.assignee_name ? `Assigned to ${c.assignee_name}` : "Assignee removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canAct) {
    return <span className={cn("text-[12.5px]", assigneeName ? "text-foreground-soft" : "text-subtle-foreground")}>{assigneeName ?? "Unassigned"}</span>;
  }
  const options = people.data ?? [];
  const known = !assigneeId || options.some((p) => p.user_id === assigneeId);
  return (
    <Select value={assigneeId ?? UNASSIGNED} onValueChange={(v) => update.mutate(v)} disabled={update.isPending}>
      <SelectTrigger size={size} className={cn("w-full min-w-[150px]", className)} aria-label="Assignee" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-[5px] border font-mono text-[9px]", assigneeId ? "border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft text-primary-soft-foreground" : "border-dashed border-border-strong text-subtle-foreground")}>
            {assigneeId ? initials(assigneeName) : "–"}
          </span>
          <SelectValue placeholder="Unassigned" />
        </span>
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {!known && assigneeId && <SelectItem value={assigneeId}>{assigneeName ?? "Former member"}</SelectItem>}
        {options.map((p) => (
          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}{p.is_you ? " (you)" : ""}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
