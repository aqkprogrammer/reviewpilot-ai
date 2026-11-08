import { Mail, MessageSquare, Smartphone } from "lucide-react";
import { Tooltip } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: Smartphone },
] as const;

export function ConsentChips({ consents, optedOut }: { consents: Record<string, boolean>; optedOut?: boolean }) {
  if (optedOut) return <span className="inline-flex items-center rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger-foreground">Opted out</span>;
  return (
    <div className="flex items-center gap-1">
      {CHANNELS.map((c) => {
        const on = !!consents[c.key];
        return (
          <Tooltip key={c.key} content={`${c.label}: ${on ? "consent recorded" : "no consent"}`}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-md border transition",
                on ? "border-success/30 bg-success-soft text-success-foreground" : "border-border bg-muted/40 text-subtle-foreground/60",
              )}
              aria-label={`${c.label} ${on ? "consented" : "not consented"}`}
            >
              <c.icon className="size-3.5" />
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
