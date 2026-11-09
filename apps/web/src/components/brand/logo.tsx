import { cn } from "@/lib/utils";

/**
 * ReviewPilot mark: a beacon — an open ring (the customer voice) with a precision
 * signal notch, rendered as an instrument glyph rather than a gradient blob.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#080d12" stroke="rgba(180,205,220,0.22)" />
      <path d="M16 7.5a8.5 8.5 0 1 0 8.5 8.5" stroke="#45e5ea" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 11.5a4.5 4.5 0 1 0 4.5 4.5" stroke="#80bdff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <circle cx="16" cy="16" r="1.6" fill="#f4f7fa" />
      <path d="m20.5 11.5 4-4" stroke="#76f0c1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="7" r="1.4" fill="#76f0c1" />
    </svg>
  );
}

export function Logo({ className, size = 28, wordmarkClassName }: { className?: string; size?: number; wordmarkClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className={cn("text-[16px] font-semibold tracking-[-0.03em] text-foreground", wordmarkClassName)}>
        ReviewPilot
        <span className="ml-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] px-1 py-px align-middle font-mono text-[9.5px] font-medium tracking-[0.12em] text-primary">AI</span>
      </span>
    </span>
  );
}
