import { ImageResponse } from "next/og";

export const alt = "ReviewPilot AI — Your Reputation Is Your Next Growth Engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(160deg, #f6f1ff 0%, #ece4fb 55%, #f3e3fb 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#8b5cf6,#6a4cff,#2563ff)", display: "flex" }} />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#1d0b3a", letterSpacing: -1 }}>ReviewPilot AI</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, fontWeight: 800, color: "#1d0b3a", letterSpacing: -3, lineHeight: 1.02, maxWidth: 980 }}>
            Your Reputation Is Your Next Growth Engine.
          </div>
          <div style={{ marginTop: 26, fontSize: 28, color: "#4a4566" }}>WhatsApp-first review collection · AI replies in English, Hindi & Hinglish</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["No review gating", "Google Business Profile", "Made for India"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: "white", color: "#5234e6", fontSize: 22, fontWeight: 600 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
