import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Share your feedback",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#f6f5fb" };

// Customer-facing pages always render light, whatever the visitor's app theme is.
const LIGHT = `.feedback-light{color-scheme:light;--background:#f6f5fb;--card:#fff;--popover:#fff;--foreground:#16112b;--foreground-soft:#3a3555;--muted:#f3f2f9;--muted-foreground:#6e6a86;--subtle-foreground:#9a97b0;--border:#e9e7f3;--border-strong:#d8d5e8;--input:#e2dfef;--danger-soft:#feecef;--danger-foreground:#be123c;--success-soft:#e6f8f0;--success-foreground:#047857}`;

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LIGHT }} />
      {children}
    </>
  );
}
