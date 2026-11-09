import { Badge, type BadgeProps } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const MAP: Record<string, BadgeProps["variant"]> = {
  active: "success", connected: "success", delivered: "success", succeeded: "success", published: "success", responded: "success", resolved: "success", paid: "success", read: "success", live: "success",
  completed: "primary", clicked: "mint", simulated: "mint",
  trialing: "info", scheduled: "info", sent: "info", in_progress: "info", new: "primary",
  queued: "neutral", draft: "neutral", handled: "neutral", archived: "neutral", skipped: "neutral", not_connected: "neutral", not_configured: "neutral",
  pending: "warning", paused: "warning", past_due: "warning", grace_period: "warning", pending_authorization: "warning", pending_publish: "warning", token_expired: "warning",
  failed: "danger", error: "danger", canceled: "danger", expired: "danger", suspended: "danger", bounced: "danger", disabled: "danger",
};

const LABELS: Record<string, string> = { pending_authorization: "Pending auth", not_connected: "Not connected", not_configured: "Not configured", grace_period: "Grace period", past_due: "Past due", token_expired: "Token expired", pending_publish: "Publishing" };

/** Status readout: mono, uppercase, glowing dot. */
export function StatusBadge({ status, size = "sm", dot = true }: { status: string | null | undefined; size?: "sm" | "md"; dot?: boolean }) {
  if (!status) return null;
  return <Badge variant={MAP[status] ?? "neutral"} size={size} dot={dot} mono>{LABELS[status] ?? titleCase(status)}</Badge>;
}
