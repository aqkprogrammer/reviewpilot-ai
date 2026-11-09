import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

export function Pagination({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
      <span className="tabular">
        Showing <span className="font-medium text-foreground">{formatNumber(start)}–{formatNumber(end)}</span> of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="px-2 font-mono text-[11.5px] tabular">{String(page).padStart(2, "0")} / {String(pages).padStart(2, "0")}</span>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}
