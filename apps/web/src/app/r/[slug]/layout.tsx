import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Share your feedback",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#f3f6f7" };

// Customer-facing pages always render in the neutral "Daylight" palette, whatever the visitor's app
// theme is. The business brand colour is applied on top as --primary (see brandVars).
const LIGHT = `.feedback-light{color-scheme:light;--background:#f3f6f7;--background-subtle:#eaeff1;--card:#ffffff;--card-elevated:#ffffff;--popover:#ffffff;--surface-hover:#eef3f5;--foreground:#0b1218;--foreground-soft:#26343e;--muted:#edf2f4;--muted-foreground:#52616c;--subtle-foreground:#7d8b95;--border:rgb(16 40 56 / 0.10);--border-strong:rgb(16 40 56 / 0.18);--input:rgb(16 40 56 / 0.16);--grid-line:rgb(16 40 56 / 0.055);--mint:#1f9e6e;--mint-soft:rgb(31 158 110 / 0.10);--amber:#b97a1f;--amber-soft:rgb(185 122 31 / 0.12);--success:#1f9e6e;--success-soft:rgb(31 158 110 / 0.10);--success-foreground:#137653;--danger:#d9534f;--danger-soft:rgb(217 83 79 / 0.10);--danger-foreground:#b03a36;--shadow-xs:0 1px 2px rgb(11 18 24 / 0.05);--shadow-sm:0 1px 2px rgb(11 18 24 / 0.05), 0 2px 8px -2px rgb(11 18 24 / 0.06);--shadow-md:0 1px 2px rgb(11 18 24 / 0.05), 0 10px 28px -10px rgb(11 18 24 / 0.14)}`;

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LIGHT }} />
      {children}
    </>
  );
}
