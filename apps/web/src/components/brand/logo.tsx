import { cn } from "@/lib/utils";

/** ReviewPilot mark: a speech bubble whose tail doubles as a navigation chevron. */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="rp-g" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6a4cff" />
          <stop offset="1" stopColor="#2563ff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rp-g)" />
      <path d="M9 10.5C9 9.12 10.12 8 11.5 8h9C21.88 8 23 9.12 23 10.5v7c0 1.38-1.12 2.5-2.5 2.5H15l-4.2 3.6c-.5.43-1.3.07-1.3-.6V20.4A2.5 2.5 0 0 1 9 17.5v-7Z" fill="white" fillOpacity="0.95" />
      <path d="m13.2 14.2 2 1.9 3.8-4" stroke="#6a4cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, size = 28, wordmarkClassName }: { className?: string; size?: number; wordmarkClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className={cn("text-[17px] font-semibold tracking-[-0.03em] text-foreground", wordmarkClassName)}>
        ReviewPilot<span className="ml-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold tracking-normal text-primary-soft-foreground align-middle">AI</span>
      </span>
    </span>
  );
}
