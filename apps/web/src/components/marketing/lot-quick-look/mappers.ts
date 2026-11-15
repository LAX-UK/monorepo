import type { LotRailCardVM } from "@/components/sections/artwork/artwork-view-models";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import type { LiveCardFields } from "@/lib/marketing/saleroom/card-live-state";
import type { CatalogLotVM } from "@auction/types";
import { normalizeAuctionTime } from "@auction/validators";
import type { LotQuickLookVM } from "./types";

export function lotQuickLookFromLotCardVM(item: LotCardVM): LotQuickLookVM {
  const rows = item.endingSoonPriceRows;
  const base: LotQuickLookVM = {
    id: item.id,
    href: item.href,
    title: item.title,
    subtitle: item.artistName,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    status: item.status,
    ...(item.startTime ? { startTime: item.startTime } : {}),
    ...(item.endTime ? { endTime: item.endTime } : {}),
    lotLabel: item.lotLabel,
  };
  if (rows) {
    return {
      ...base,
      estimateLabel: rows.estimate.label,
      estimateValue: rows.estimate.value,
      currentBidLabel: rows.current.label,
      currentBidValue: rows.current.value,
    };
  }
  return {
    ...base,
    estimateLabel: item.priceLabel,
    estimateValue: item.priceFormatted,
  };
}

/** The rail card's quick look. Bid state comes from the live read; until it lands there is none. */
export function lotQuickLookFromRailCard(
  card: LotRailCardVM,
  live?: LiveCardFields | null,
): LotQuickLookVM {
  const endTime = normalizeAuctionTime(live?.endTime);
  return {
    id: card.id,
    href: card.href,
    title: card.title,
    subtitle: card.artistName ?? "",
    imageUrl: card.imageUrl,
    imageAlt: card.title,
    status: live?.status ?? "scheduled",
    ...(endTime ? { endTime } : {}),
    lotLabel: card.lotNumber != null ? `Lot ${card.lotNumber}` : null,
    ...(live
      ? { currentBidLabel: live.currentBidLabel, currentBidValue: live.currentBidValue }
      : {}),
    ...(card.estimateLine ? { estimateLabel: "Estimate", estimateValue: card.estimateLine } : {}),
  };
}

export function lotQuickLookFromLot(
  lot: CatalogLotVM,
  catalogLinkParams?: CatalogLinkParams,
): LotQuickLookVM {
  const price = lotPriceDisplay(lot);
  const est = lotEstimateLine(lot);
  const subtitle = lot.medium?.trim() || "Contemporary";
  return {
    id: lot.id,
    href: lotCatalogHref(lot, catalogLinkParams),
    title: lot.title,
    subtitle,
    imageUrl: lot.images[0] ?? null,
    imageAlt: lot.title,
    status: lot.status,
    ...(lot.startTime ? { startTime: lot.startTime } : {}),
    ...(lot.endTime ? { endTime: lot.endTime } : {}),
    medium: lot.medium,
    images: lot.images,
    ...(est
      ? { estimateLabel: "Estimate", estimateValue: est }
      : { estimateLabel: price.label, estimateValue: price.value }),
    ...(lot.status === "active"
      ? { currentBidLabel: price.label, currentBidValue: price.value }
      : {}),
  };
}

export function lotQuickLookFromSaleLotCard(lot: SaleLotCardVM): LotQuickLookVM {
  return {
    id: lot.id,
    href: lot.href,
    title: lot.title,
    subtitle: lot.artistOrMedium ?? "",
    imageUrl: lot.imageUrl,
    imageAlt: lot.imageAlt,
    status: lot.status,
    ...(lot.startTime ? { startTime: lot.startTime } : {}),
    ...(lot.endTime ? { endTime: lot.endTime } : {}),
    lotLabel: lot.lotLabel,
    estimateLabel: "Estimate",
    ...(lot.estimateValue ? { estimateValue: lot.estimateValue } : {}),
    currentBidLabel: lot.currentBidLabel,
    currentBidValue: lot.currentBidValue,
  };
}

export function lotQuickLookRailDeck(
  cards: LotRailCardVM[],
  live?: ReadonlyMap<string, LiveCardFields> | null,
): LotQuickLookVM[] {
  return cards.map((card) => lotQuickLookFromRailCard(card, live?.get(card.id)));
}
