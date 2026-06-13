import { SITE_NAME } from "@/lib/brand";
import { OG_BRAND } from "@/lib/brand/og-colors";
import { getServerLotById } from "@/lib/data/http/lots.server";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { renderOgJpeg } from "@/lib/seo/og-image-response";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  let alt = "Lot detail";
  try {
    const lot = await getServerLotById(id);
    if (lot?.title) alt = lot.title;
  } catch {
    /* fall through */
  }
  return [{ id: "default", alt, size, contentType }];
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  let title = "Lot detail";
  let estimate = "";
  let imageUrl: string | null = null;
  try {
    const lot = await getServerLotById(id);
    if (lot) {
      title = lot.title;
      estimate = lotEstimateLine(lot) ?? "";
      imageUrl = lot.images[0] ?? null;
    }
  } catch {
    /* fall through */
  }
  return renderOgJpeg(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: OG_BRAND.background,
        color: OG_BRAND.foreground,
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
          backgroundColor: OG_BRAND.panel,
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
          <div style={{ display: "flex", fontSize: 56, color: OG_BRAND.muted }}>{SITE_NAME}</div>
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
            <div style={{ display: "flex", fontSize: 26, color: OG_BRAND.muted }}>
              Est. {estimate}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
  );
}
