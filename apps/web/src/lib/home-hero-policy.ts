import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { toHeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
import { salePath } from "@/lib/seo/url";
import type { Sale, SaleStatus } from "@auction/types";
import { parseStreamEmbedUrl } from "@auction/validators";

export type HomeHeroSaleInput = Pick<
  Sale,
  | "id"
  | "title"
  | "status"
  | "deliveryMode"
  | "heroPresentation"
  | "heroVideoUrl"
  | "coverImages"
  | "startTime"
  | "endTime"
>;

export function isHomeHeroEligibleStatus(status: SaleStatus): boolean {
  return status === "scheduled" || status === "active";
}

/** Marketing video hero for homepage `/` — never reads live `streamUrl`. */
export function resolveHomeHeroLiveFromSale(
  sale: HomeHeroSaleInput,
): Extract<HeroStateVM, { kind: "live" }> | null {
  if (!isHomeHeroEligibleStatus(sale.status)) return null;
  if (sale.heroPresentation !== "video") return null;
  if (!sale.heroVideoUrl?.trim()) return null;

  const embed = parseStreamEmbedUrl(sale.heroVideoUrl);
  if (!embed) return null;

  const modeLabel = getSaleDeliveryModeLabel(sale.deliveryMode);
  return {
    kind: "live",
    saleId: sale.id,
    saleTitle: sale.title,
    embedSrc: embed.src,
    provider: embed.provider,
    modeLabel,
    saleroomHref: salePath(sale),
    ...(embed.provider === "youtube" && embed.videoId
      ? {
          videoId: embed.videoId,
          ...(embed.startSeconds !== undefined ? { startSeconds: embed.startSeconds } : {}),
        }
      : {}),
    posterImageUrl: sale.coverImages[0] ?? null,
    posterImageMobileUrl: sale.coverImages[1] ?? null,
    posterImageDesktopWideUrl: sale.coverImages[2] ?? null,
  };
}

export function resolveHomeHeroRotatorFromSales(
  sales: HomeHeroSaleInput[],
): Extract<HeroStateVM, { kind: "rotator" }> | null {
  const eligible = sales.filter((sale) => isHomeHeroEligibleStatus(sale.status));
  if (eligible.length === 0) return null;
  return {
    kind: "rotator",
    slides: eligible.map((sale) => toHeroSaleSlideVM(sale)),
  };
}
