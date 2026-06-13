import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { OG_BRAND } from "@/lib/brand/og-colors";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: OG_BRAND.background,
        color: OG_BRAND.foreground,
        padding: "72px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, textTransform: "uppercase" }}>
        LAX
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 84, lineHeight: 1.05, fontWeight: 600 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 30, color: OG_BRAND.muted, maxWidth: 980 }}>{SITE_TAGLINE}</div>
      </div>
    </div>,
    { ...size },
  );
}
