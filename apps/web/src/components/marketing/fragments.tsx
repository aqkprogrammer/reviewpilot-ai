import * as React from "react";
import { CheckCheck, Sparkles } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand/brand-icons";
import { cn } from "@/lib/utils";

/** Realistic UI fragments used as marketing visuals (not screenshots). */

export function ReviewCard({
  author,
  rating,
  text,
  when = "2 hours ago",
  source = "Google",
  reply,
  className,
}: {
  author: string;
  rating: number;
  text: string;
  when?: string;
  source?: string;
  reply?: string;
  className?: string;
}) {
  const initials = author.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-[#efeaff] text-[11px] font-semibold text-[#5234e6]">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{author}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Stars rating={rating} size={11} />
            <span>{when}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <GoogleIcon className="size-3" /> {source}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-foreground-soft">{text}</p>
      {reply && (
        <div className="mt-3 rounded-xl border border-primary/15 bg-primary-soft/50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary-soft-foreground">
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
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center gap-2.5 bg-[#075e54] px-4 py-3 text-white">
        <div className="flex size-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">{business[0]}</div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{business}</p>
          <p className="text-[10px] text-white/70">Business account</p>
        </div>
        <WhatsAppIcon className="ml-auto size-5" />
      </div>
      <div className="space-y-2 bg-[#efe7dd] p-4 dark:bg-[#0b141a]">
        <div className="max-w-[88%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[#111b21] shadow-xs dark:bg-[#202c33] dark:text-[#e9edef]">
          {message}
          <div className="mt-2 rounded-lg border border-[#e2e2e2] bg-[#f7f7f7] px-3 py-1.5 text-center text-[12px] font-medium text-[#027eb5] dark:border-white/10 dark:bg-white/5 dark:text-[#53bdeb]">
            Share feedback
          </div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
            7:42 pm <CheckCheck className="size-3 text-[#53bdeb]" />
          </div>
        </div>
        {showReply && (
          <div className="ml-auto max-w-[70%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[12.5px] text-[#111b21] shadow-xs dark:bg-[#005c4b] dark:text-[#e9edef]">
            Sure, done! Loved it.
            <div className="mt-0.5 text-right text-[10px] text-[#667781] dark:text-white/60">7:51 pm</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Decorative QR pattern (not a scannable code). */
export function QrPattern({ className, color = "#1d0b3a" }: { className?: string; color?: string }) {
  const size = 21;
  const cells: React.ReactNode[] = [];
  const finder = (x: number, y: number) => x < 7 && y < 7 ? [x, y] : x >= size - 7 && y < 7 ? [x - (size - 7), y] : x < 7 && y >= size - 7 ? [x, y - (size - 7)] : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      let on: boolean;
      if (f) {
        const [fx, fy] = f;
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
      } else {
        on = ((x * 7 + y * 13 + x * y) % 5) < 2;
      }
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx="0.15" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} fill={color} aria-hidden>
      {cells}
    </svg>
  );
}

export function QrCard({ business, className }: { business: string; className?: string }) {
  return (
    <div className={cn("w-56 rounded-2xl border border-border bg-card p-4 text-center shadow-md", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">How did we do?</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{business}</p>
      <div className="mx-auto mt-3 w-36 rounded-xl bg-white p-2.5 ring-1 ring-[#ece8f6]">
        <QrPattern className="w-full" color="#3b1d8f" />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">Scan to share your honest feedback or review us on Google</p>
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
  const tone = { positive: "bg-success", negative: "bg-danger", neutral: "bg-warning" };
  const label = { positive: "Positive", negative: "Needs attention", neutral: "Mixed" };
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-foreground">{i.label}</span>
            <span className="text-muted-foreground">
              {i.mentions} mentions · <span className={cn(i.tone === "negative" ? "text-danger-foreground" : i.tone === "positive" ? "text-success-foreground" : "text-warning-foreground")}>{label[i.tone]}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", tone[i.tone])} style={{ width: `${(i.mentions / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
