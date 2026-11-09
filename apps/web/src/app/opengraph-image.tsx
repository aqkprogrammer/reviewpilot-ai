import { ImageResponse } from "next/og";

export const alt = "ReviewPilot AI — Your Reputation Is Your Next Growth Engine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// "Instrument" palette: graphite surfaces, cyan / ice / mint signal.
const BG = "#080b0f";
const FG = "#f2f6f8";
const MUTED = "#a0adb8";
const SUBTLE = "#687783";
const CYAN = "#52e3e8";
const ICE = "#83bfff";
const MINT = "#8cf0c5";
const LINE = "rgba(180,205,220,0.10)";
const LINE_STRONG = "rgba(180,205,220,0.20)";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          fontFamily: "sans-serif",
          backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      >
        {/* signal light */}
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -120,
            width: 820,
            height: 820,
            borderRadius: 9999,
            background: "radial-gradient(closest-side, rgba(82,227,232,0.28), rgba(131,191,255,0.08) 55%, rgba(8,11,15,0) 75%)",
            display: "flex",
          }}
        />
        {/* beacon rings */}
        {[150, 230, 310].map((r, i) => (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 930 - r,
              top: 300 - r,
              width: r * 2,
              height: r * 2,
              borderRadius: 9999,
              border: `1px ${i === 1 ? "dashed" : "solid"} ${LINE_STRONG}`,
              display: "flex",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 930 - 62,
            top: 300 - 62,
            width: 124,
            height: 124,
            borderRadius: 9999,
            background: "radial-gradient(circle at 36% 30%, #e8feff 0%, #8ff3f6 16%, #23b9c3 42%, #0b4b55 74%, #061e25 100%)",
            boxShadow: `0 0 80px rgba(82,227,232,0.45)`,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: "100%", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "#0d1218",
                border: `1px solid ${LINE_STRONG}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9999, border: `3px solid ${CYAN}`, borderRightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: 9999, background: FG, display: "flex" }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: FG, letterSpacing: -1, display: "flex", alignItems: "center", gap: 12 }}>
              ReviewPilot
              <span style={{ fontSize: 15, color: CYAN, border: `1px solid rgba(82,227,232,0.45)`, borderRadius: 6, padding: "3px 7px", letterSpacing: 2 }}>AI</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 16, color: CYAN, letterSpacing: 4, textTransform: "uppercase", display: "flex" }}>Reputation intelligence</div>
            <div style={{ marginTop: 22, fontSize: 74, fontWeight: 700, color: FG, letterSpacing: -3, lineHeight: 1.02, maxWidth: 760, display: "flex", flexWrap: "wrap" }}>
              Your Reputation Is Your Next&nbsp;<span style={{ color: CYAN }}>Growth Engine.</span>
            </div>
            <div style={{ marginTop: 24, fontSize: 25, color: MUTED, display: "flex" }}>WhatsApp-first review collection · AI replies in English, Hindi &amp; Hinglish</div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {[
              { t: "No review gating", c: MINT },
              { t: "Google Business Profile", c: ICE },
              { t: "Made for India", c: CYAN },
            ].map((x) => (
              <div
                key={x.t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: `1px solid ${LINE_STRONG}`,
                  background: "rgba(16,24,32,0.85)",
                  color: SUBTLE,
                  fontSize: 18,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 9999, background: x.c, display: "flex" }} />
                <span style={{ color: "#c9d3da" }}>{x.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
