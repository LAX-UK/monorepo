import { SITE_NAME } from "@/lib/brand";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Lot detail";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const reader = await getServerLotReader();
  let title = "Lot detail";
  let estimate = "";
  let imageUrl: string | null = null;
  try {
    const lot = await reader.getById(id);
    if (lot) {
      title = lot.title;
      estimate = lotEstimateLine(lot) ?? "";
      imageUrl = lot.images[0] ?? null;
    }
  } catch {
    /* fall through */
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#0d0d0f",
        color: "#f3efe6",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          width: "55%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1c",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 56, color: "#3b3b3f" }}>{SITE_NAME}</div>
        )}
      </div>
      <div
        style={{
          width: "45%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 56px",
        }}
      >
        <div
          style={{ display: "flex", fontSize: 22, letterSpacing: 6, textTransform: "uppercase" }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 56, lineHeight: 1.05, fontWeight: 600 }}>{title}</div>
          {estimate ? (
            <div style={{ display: "flex", fontSize: 26, color: "#c9c0ad" }}>Est. {estimate}</div>
          ) : null}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
