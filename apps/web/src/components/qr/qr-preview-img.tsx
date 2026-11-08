"use client";
import * as React from "react";
import { QrCode } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Loads the org-scoped preview SVG with auth + X-Organization-Id headers, rendered via an object URL. */
export function QRPreviewImg({ id, version, alt, className }: { id: string; version: string; alt: string; className?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    api
      .raw(`/qr-codes/${id}/preview.svg`)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, version]);
  if (failed) return <div className={cn("flex items-center justify-center text-subtle-foreground", className)}><QrCode className="size-8" /></div>;
  if (!url) return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
