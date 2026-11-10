"use client";
/**
 * Small "Recovery case" affordance for the review drawer and the private-feedback list:
 * links to the existing case, or (for members who can act) opens one manually.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/tech";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useOrg } from "@/lib/session";
import { cn } from "@/lib/utils";
import { STATUS, type CaseDetail, type CaseRef } from "./types";

type Lookup = { reviews: Record<string, CaseRef>; feedback: Record<string, CaseRef> };

/** One request for a whole page of reviews / feedback. */
export function useRecoveryLookup({ reviewIds, feedbackIds }: { reviewIds?: string[]; feedbackIds?: string[] }) {
  const { orgId, can } = useOrg();
  const r = reviewIds ?? [];
  const f = feedbackIds ?? [];
  return useQuery({
    queryKey: ["recovery", "lookup", orgId, r, f],
    queryFn: () => api.get<Lookup>("/recovery/lookup", { review_id: r, feedback_id: f }),
    enabled: can("reviews.read") && (r.length > 0 || f.length > 0),
    staleTime: 15_000,
  });
}

export function RecoveryCaseLink({
  reviewId, feedbackId, existing, offer = true, size = "sm", className,
}: {
  reviewId?: string;
  feedbackId?: string;
  /** Pass a lookup result to skip the per-item request (lists). `null` = known to have no case. */
  existing?: CaseRef | null;
  /** Offer "Open recovery case" when none exists (callers pass false for happy customers). */
  offer?: boolean;
  size?: "xs" | "sm";
  className?: string;
}) {
  const { can } = useOrg();
  const router = useRouter();
  const qc = useQueryClient();
  const own = useRecoveryLookup({ reviewIds: existing === undefined && reviewId ? [reviewId] : [], feedbackIds: existing === undefined && feedbackId ? [feedbackId] : [] });
  const ref = existing !== undefined ? existing : reviewId ? own.data?.reviews[reviewId] : feedbackId ? own.data?.feedback[feedbackId] : undefined;
  const open = useMutation({
    mutationFn: () => api.post<CaseDetail>("/recovery", reviewId ? { review_id: reviewId } : { feedback_id: feedbackId }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["recovery"] });
      toast.success("Recovery case opened", { action: { label: "View", onClick: () => router.push(`/app/recovery?case=${c.id}`) } });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "case_exists") {
        qc.invalidateQueries({ queryKey: ["recovery"] });
        const id = (e.details as { case_id?: string } | undefined)?.case_id;
        if (id) router.push(`/app/recovery?case=${id}`);
        return;
      }
      toast.error(errorMessage(e));
    },
  });

  if (!can("reviews.read")) return null;
  if (existing === undefined && own.isLoading) return null;
  if (ref) {
    const s = STATUS[ref.status];
    return (
      <Button asChild variant="outline" size={size} className={cn("gap-1.5", className)}>
        <Link href={`/app/recovery?case=${ref.id}`} aria-label={`Recovery case, ${s.label}${ref.breached ? ", SLA breached" : ""}`}>
          <HeartHandshake />
          {size === "xs" ? "Recovery" : "Recovery case"}
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <StatusDot tone={ref.breached ? "error" : s.dot} className="size-1.5" />
            {ref.breached ? "Breached" : s.label}
          </span>
        </Link>
      </Button>
    );
  }
  if (!offer || !can("reviews.reply")) return null;
  return (
    <Button variant="ghost" size={size} className={className} onClick={() => open.mutate()} loading={open.isPending}>
      <HeartHandshake /> Open recovery case
    </Button>
  );
}
