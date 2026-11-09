import { Tooltip } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

export const CONSENT_CHANNELS = [
  { key: "whatsapp", short: "WA", label: "WhatsApp" },
  { key: "email", short: "EM", label: "Email" },
  { key: "sms", short: "SMS", label: "SMS" },
] as const;

/**
 * Compact per-channel consent readout: three mono cells that light up (mint) when consent is
 * recorded. Opted-out customers collapse into a single danger readout.
 */
export function ConsentChips({ consents, optedOut }: { consents: Record<string, boolean>; optedOut?: boolean }) {
  if (optedOut) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-[color-mix(in_oklab,var(--danger)_28%,transparent)] bg-danger-soft px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger-foreground">
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        Opted out
      </span>
    );
  }
  const granted = CONSENT_CHANNELS.filter((c) => consents[c.key]).map((c) => c.label);
  return (
    <span
      className="inline-flex h-6 items-stretch overflow-hidden rounded-[5px] border border-border bg-background-subtle/70"
      role="img"
      aria-label={granted.length ? `Consent recorded for ${granted.join(", ")}` : "No messaging consent recorded"}
    >
      {CONSENT_CHANNELS.map((c, i) => {
        const on = !!consents[c.key];
        return (
          <Tooltip key={c.key} content={`${c.label}: ${on ? "consent recorded" : "no consent"}`}>
            <span
              className={cn(
                "flex items-center gap-1 px-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] transition-colors",
                i > 0 && "border-l border-border",
                on ? "bg-mint-soft text-mint" : "text-subtle-foreground/70",
              )}
            >
              <span className={cn("size-1 rounded-full", on ? "bg-current shadow-[0_0_6px_currentColor]" : "bg-border-strong")} aria-hidden />
              {c.short}
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
}
