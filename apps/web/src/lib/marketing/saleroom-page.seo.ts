import type { DayGalleryVM, SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  saleDayGalleryJsonLd,
  saleEventJsonLd,
  salePressJsonLd,
  saleRecordingVideoJsonLd,
} from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Sale } from "@auction/types";
import { parseStreamEmbedUrl } from "@auction/validators";

export type BuildSaleroomPageSeoInput = {
  sale: Sale;
  basePath: string;
  lotVMs: SaleLotCardVM[];
  dayGalleryVM: DayGalleryVM | null;
  showPressSection: boolean;
};

export function buildSaleroomPageJsonLd(input: BuildSaleroomPageSeoInput): string {
  const base = getSiteUrl();
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/sales" },
    { name: input.sale.title, path: input.basePath },
  ]);

  const itemsLd =
    input.lotVMs.length > 0
      ? itemListJsonLd(
          input.lotVMs.map((lot) => ({
            name: lot.title,
            url: `${base}${lot.href}`,
          })),
        )
      : null;
  const eventLd = saleEventJsonLd(input.sale);
  const saleStreamCtx = resolveSaleStreamContext({
    streamUrl: input.sale.streamUrl,
    status: input.sale.status,
    deliveryMode: input.sale.deliveryMode,
    saleTitle: input.sale.title,
    endTime: input.sale.endTime,
  });
  const recordingEmbed =
    saleStreamCtx.phase === "recording" && input.sale.streamUrl
      ? parseStreamEmbedUrl(input.sale.streamUrl)
      : null;
  const videoLd = recordingEmbed
    ? saleRecordingVideoJsonLd(input.sale, recordingEmbed.src, input.sale.coverImages[0] ?? null)
    : null;
  const galleryLd =
    input.dayGalleryVM && input.sale.dayImageAssets && input.sale.dayImageAssets.length > 0
      ? saleDayGalleryJsonLd(input.sale, input.sale.dayImageAssets)
      : null;

  const pressLd =
    input.showPressSection && input.sale.pressCoverage && input.sale.pressCoverage.length > 0
      ? salePressJsonLd(input.sale, input.sale.pressCoverage)
      : null;

  return jsonLdScript(
    crumbs,
    eventLd,
    ...(videoLd ? [videoLd] : []),
    ...(itemsLd ? [itemsLd] : []),
    ...(galleryLd ? [galleryLd] : []),
    ...(pressLd ? [pressLd] : []),
  );
}
