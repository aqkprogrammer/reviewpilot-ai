import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ReviewPilot AI — Turn Customer Experiences Into Business Growth",
    template: "%s · ReviewPilot AI",
  },
  description:
    "AI-powered reputation management for local businesses. Collect genuine Google reviews over WhatsApp, QR and email, reply with AI, and understand customer sentiment.",
  applicationName: "ReviewPilot AI",
  openGraph: {
    type: "website",
    siteName: "ReviewPilot AI",
    title: "ReviewPilot AI — Turn Customer Experiences Into Business Growth",
    description: "WhatsApp-first review collection and AI customer-feedback intelligence for local businesses.",
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: "ReviewPilot AI" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a12" },
  ],
};

// Applies the persisted theme before paint to avoid a light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('rp_theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
