import * as React from "react";
import { CheckCheck, Sparkles } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { cn } from "@/lib/utils";

/** Code-built UI fragments used as marketing visuals (illustrative, never screenshots of real data). */

export function ReviewCard({
  author,
  rating,
  text,
  when = "2 hours ago",
  source = "Google",
  reply,
  className,
  sample,
}: {
  sample?: boolean;
  author: string;
  rating: number;
  text: string;
  when?: string;
  source?: string;
  reply?: string;
  className?: string;
}) {
  const initials = author
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm hairline-top", className)}>
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-background-subtle font-mono text-[11px] font-medium text-foreground-soft">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{author}</p>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-subtle-foreground">
            <Stars rating={rating} size={11} />
            <span>{when}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
          <GoogleIcon className="size-3" /> {source}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-foreground-soft">{text}</p>
      {sample && <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">Sample review</p>}
      {reply && (
        <div className="relative mt-3 overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--primary)_24%,transparent)] bg-primary-soft p-3 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-primary">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-primary">
            <Sparkles className="size-3" /> AI draft · awaiting your approval
          </p>
          <p className="text-[12.5px] leading-relaxed text-foreground-soft">{reply}</p>
        </div>
      )}
    </div>
  );
}

export function WhatsAppThread({ business, message, className, showReply = true }: { business: string; message: string; className?: string; showReply?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border-strong bg-[#0b141a] shadow-md", className)}>
      <div className="flex items-center gap-2.5 border-b border-white/5 bg-[#1f2c34] px-4 py-3 text-[#e9edef]">
        <div className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">{business[0]}</div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{business}</p>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8696a0]">Business account · template approved</p>
        </div>
        <WhatsAppIcon className="ml-auto size-5" />
      </div>
      <div className="space-y-2 p-4 [background-image:radial-gradient(rgb(255_255_255/0.03)_1px,transparent_1px)] [background-size:14px_14px]">
        <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-[#202c33] px-3 py-2 text-[12.5px] leading-relaxed text-[#e9edef]">
          {message}
          <div className="mt-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center text-[12px] font-medium text-[#53bdeb]">Share feedback</div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
            7:42 pm <CheckCheck className="size-3 text-[#53bdeb]" />
          </div>
        </div>
        {showReply && (
          <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[12.5px] text-[#e9edef]">
            Sure, done! Loved it.
            <div className="mt-0.5 text-right text-[10px] text-white/60">7:51 pm</div>
          </div>
        )}
        <div className="mx-auto w-fit rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8696a0]">Reply STOP to opt out</div>
      </div>
    </div>
  );
}

/** Decorative QR pattern (not a scannable code). */
export function QrPattern({ className, color = "currentColor" }: { className?: string; color?: string }) {
  const size = 21;
  const cells: React.ReactNode[] = [];
  const finder = (x: number, y: number) =>
    x < 7 && y < 7 ? [x, y] : x >= size - 7 && y < 7 ? [x - (size - 7), y] : x < 7 && y >= size - 7 ? [x, y - (size - 7)] : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      let on: boolean;
      if (f) {
        const [fx, fy] = f;
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else {
        on = (x * 7 + y * 13 + x * y) % 5 < 2;
      }
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx="0.12" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} fill={color} aria-hidden>
      {cells}
    </svg>
  );
}

/** Printed table-card mock-up: paper-white object in a dark scene. */
export function QrCard({ business, className, code = "QR-0142" }: { business: string; className?: string; code?: string }) {
  return (
    <div className={cn("w-52 rounded-lg bg-foreground p-4 text-center text-background shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9)]", className)}>
      <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.14em] text-background/55">
        <span>Table card</span>
        <span>{code}</span>
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-background/60">How did we do?</p>
      <p className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em]">{business}</p>
      <div className="mx-auto mt-3 w-32 rounded-md border border-background/10 p-2">
        <QrPattern className="w-full" color="#080b0f" />
      </div>
      <p className="mt-3 text-[10.5px] leading-snug text-background/60">Scan to share honest feedback or review us on Google</p>
    </div>
  );
}

export function SentimentBars({
  items,
  className,
}: {
  items: { label: string; mentions: number; tone: "positive" | "negative" | "neutral" }[];
  className?: string;
}) {
  const max = Math.max(...items.map((i) => i.mentions));
  const tone = { positive: "bg-mint", negative: "bg-danger", neutral: "bg-amber" };
  const text = { positive: "text-mint", negative: "text-danger-foreground", neutral: "text-amber" };
  const label = { positive: "Positive", negative: "Needs attention", neutral: "Mixed" };
  return (
    <ul className={cn("space-y-4", className)}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-foreground">{i.label}</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
              <span className="tabular text-foreground-soft">{i.mentions}</span> mentions · <span className={text[i.tone]}>{label[i.tone]}</span>
            </span>
          </div>
          <div className="relative h-[3px] rounded-full bg-muted">
            <div className={cn("absolute inset-y-0 left-0 rounded-full shadow-[0_0_8px_-1px_currentColor]", tone[i.tone], text[i.tone])} style={{ width: `${(i.mentions / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
