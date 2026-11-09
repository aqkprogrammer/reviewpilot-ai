"use client";
import * as React from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Public feedback URL readout with copy + open controls. */
export function PublicLink({ slug, compact }: { slug: string; compact?: boolean }) {
  const [origin, setOrigin] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/r/${slug}`;
  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border bg-background-subtle/70 pl-2.5 pr-1", compact ? "h-8" : "h-10")}>
      <Globe className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
      <code className="min-w-0 flex-1 truncate px-1 font-mono text-[11.5px] text-foreground-soft" title={url}>{url.replace(/^https?:\/\//, "")}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Copy feedback link"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Feedback link copied"); setTimeout(() => setCopied(false), 1400); } catch { toast.error("Couldn't copy"); }
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
      <Button variant="ghost" size="icon-xs" asChild aria-label="Open feedback page">
        <a href={`/r/${slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink /></a>
      </Button>
    </div>
  );
}
