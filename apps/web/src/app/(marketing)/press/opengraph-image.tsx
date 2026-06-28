import { SITE_NAME } from "@/lib/brand";
import { OG_BRAND } from "@/lib/brand/og-colors";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = `${SITE_NAME} press & media`;
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
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase" }}>
        Press &amp; media
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, lineHeight: 1.05, fontWeight: 600 }}>Press centre</div>
        <div style={{ fontSize: 28, color: OG_BRAND.muted, maxWidth: 900 }}>
          Coverage archive, auction-day photography, and media resources for journalists.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 22, color: OG_BRAND.muted }}>{SITE_NAME}</div>
    </div>,
    { ...size },
  );
}
