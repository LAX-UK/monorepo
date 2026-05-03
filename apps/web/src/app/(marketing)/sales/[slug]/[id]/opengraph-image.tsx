import { SITE_NAME } from "@/lib/brand";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Sale catalogue";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  let title = "Sale catalogue";
  let dateLabel = "";
  let lots = "";
  try {
    const bundle = await getServerSaleWithLots(id);
    if (bundle) {
      title = bundle.sale.title;
      dateLabel = bundle.sale.endTime.toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      });
      lots = `${bundle.lots.length} lot${bundle.lots.length === 1 ? "" : "s"}`;
    }
  } catch {
    /* fall through to defaults */
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#15110b",
        color: "#f3efe6",
        padding: "72px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase" }}>
        {SITE_NAME}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{ fontSize: 28, color: "#c9c0ad", textTransform: "uppercase", letterSpacing: 4 }}
        >
          Sale catalogue
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 600 }}>{title}</div>
        {dateLabel ? (
          <div style={{ display: "flex", fontSize: 28, color: "#c9c0ad" }}>{dateLabel}</div>
        ) : null}
        {lots ? (
          <div style={{ display: "flex", fontSize: 28, color: "#c9c0ad" }}>{lots}</div>
        ) : null}
      </div>
    </div>,
    { ...size },
  );
}
