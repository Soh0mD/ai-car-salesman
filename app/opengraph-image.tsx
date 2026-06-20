import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "dascar — find your next car without the tab chaos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social share card (Joyride teal). Generated at request time by next/og.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "#10363e",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "44px" }}>
          <div style={{ display: "flex", fontSize: "48px", fontWeight: 800, color: "#ffffff" }}>
            das<span style={{ color: "#7dd4e1" }}>car</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#ffffff" }}>
          <div style={{ fontSize: "74px", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-2px" }}>
            Find your next car
          </div>
          <div style={{ display: "flex", fontSize: "74px", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-2px" }}>
            without the <span style={{ color: "#7dd4e1", marginLeft: "18px" }}>tab chaos.</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "40px", fontSize: "30px", color: "#bcd2d8", maxWidth: "860px" }}>
          One search across every lot · reliability flagged on every car · honest, master-mechanic advice.
        </div>
        <div style={{ display: "flex", marginTop: "44px", width: "180px", height: "8px", borderRadius: "999px", background: "#e0a877" }} />
      </div>
    ),
    { ...size },
  );
}
