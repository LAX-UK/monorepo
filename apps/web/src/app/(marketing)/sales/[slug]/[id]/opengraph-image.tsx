import { SITE_NAME } from "@/lib/brand";
import { OG_BRAND } from "@/lib/brand/og-colors";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { formatOgDateTime } from "@/lib/seo/og-date-format";
import { renderOgJpeg } from "@/lib/seo/og-image-response";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  let alt = "Sale catalogue";
  try {
    const bundle = await getServerSaleWithLots(id);
    if (bundle?.sale.title) alt = bundle.sale.title;
  } catch {
    /* fall through */
  }
  return [{ id: "default", alt, size, contentType }];
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  let title = "Sale catalogue";
  let dateLabel = "";
  let lots = "";
  try {
    const bundle = await getServerSaleWithLots(id);
    if (bundle) {
      title = bundle.sale.title;
      dateLabel = formatOgDateTime(bundle.sale.endTime);
      lots = `${bundle.lots.length} lot${bundle.lots.length === 1 ? "" : "s"}`;
    }
  } catch {
    /* fall through to defaults */
  }
  return renderOgJpeg(
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
        {SITE_NAME}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontSize: 28,
            color: OG_BRAND.muted,
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          Sale catalogue
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 600 }}>{title}</div>
        {dateLabel ? (
          <div style={{ display: "flex", fontSize: 28, color: OG_BRAND.muted }}>{dateLabel}</div>
        ) : null}
        {lots ? (
          <div style={{ display: "flex", fontSize: 28, color: OG_BRAND.muted }}>{lots}</div>
        ) : null}
      </div>
    </div>,
  );
}
