import type { LotRailCardVM } from "@/components/sections/artwork/artwork-view-models";
import type { EditorsPickLotCardVM, LotCardVM } from "@/components/sections/home/home-view-models";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
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
    startTime: item.startTime,
    endTime: item.endTime,
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

export function lotQuickLookFromEditorsPick(item: EditorsPickLotCardVM): LotQuickLookVM {
  return {
    id: item.id,
    href: item.href,
    title: item.title,
    subtitle: item.artistName,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    status: "scheduled",
    estimateLabel: item.estimateLabel,
    estimateValue: item.estimateValue,
  };
}

export function lotQuickLookFromRailCard(card: LotRailCardVM): LotQuickLookVM {
  return {
    id: card.id,
    href: card.href,
    title: card.title,
    subtitle: card.artistOrSellerName,
    imageUrl: card.imageUrl,
    imageAlt: card.title,
    status: card.status,
    endTime: card.endTime.toISOString(),
    lotLabel: card.lotNumber != null ? `LOT ${card.lotNumber}` : null,
    currentBidLabel: "Current bid",
    currentBidValue: card.currentPrice,
    ...(card.estimateLine ? { estimateLabel: "Estimate", estimateValue: card.estimateLine } : {}),
  };
}

export function lotQuickLookFromLot(lot: Lot): LotQuickLookVM {
  const price = lotPriceDisplay(lot);
  const est = lotEstimateLine(lot);
  const startTime =
    lot.startTime instanceof Date ? lot.startTime.toISOString() : String(lot.startTime);
  const endTime = lot.endTime instanceof Date ? lot.endTime.toISOString() : String(lot.endTime);
  const subtitle = lot.medium?.trim() || "Contemporary";
  return {
    id: lot.id,
    href: lotPath(lot),
    title: lot.title,
    subtitle,
    imageUrl: lot.images[0] ?? null,
    imageAlt: lot.title,
    status: lot.status,
    startTime,
    endTime,
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
    startTime: lot.startTime,
    endTime: lot.endTime,
    lotLabel: lot.lotLabel,
    estimateLabel: "Estimate",
    ...(lot.estimateValue ? { estimateValue: lot.estimateValue } : {}),
    currentBidLabel: lot.currentBidLabel,
    currentBidValue: lot.currentBidValue,
  };
}

export function lotQuickLookRailDeck(cards: LotRailCardVM[]): LotQuickLookVM[] {
  return cards.map(lotQuickLookFromRailCard);
}
