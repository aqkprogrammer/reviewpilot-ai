"use client";
import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PublicLink({ slug, compact }: { slug: string; compact?: boolean }) {
  const [origin, setOrigin] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/r/${slug}`;
  return (
    <div className="flex items-center gap-1.5">
      <code className={`min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground-soft ${compact ? "" : "py-1.5"}`}>{url.replace(/^https?:\/\//, "")}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Copy feedback link"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { toast.error("Couldn't copy"); }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button variant="ghost" size="icon-xs" asChild aria-label="Open feedback page">
        <a href={`/r/${slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink /></a>
      </Button>
    </div>
  );
}
