import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn(i <= Math.round(rating) ? "fill-[#f5a524] text-[#f5a524]" : "fill-border text-border")}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}
