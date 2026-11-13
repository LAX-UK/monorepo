import type { DetailBoardFilter } from "@/lib/admin/detail-board/types";
import {
  type LotCatalogSaleContext,
  formatLotCurrentValue,
  formatLotEstimate,
  formatLotEstimateDisplay,
  formatLotHammerForTable,
  isLotCatalogComplete,
  lotStatusLabel,
  lotStatusTone,
} from "@/lib/admin/lots/lot-catalog-presenters";
import type { LotStatus, SaleStatus } from "@auction/types";

export type SaleLotsBoardMode = "catalog" | "live";

export type SaleLotsCatalogLens = "all" | "complete" | "incomplete";
export type SaleLotsLiveLens = "all" | "live" | "withdraw" | "sold";
/** Unsold lots that charge their own premium, not the sale's (the overview warning links here). */
export type SaleLotsPremiumLens = "own-premium";
export type SaleLotsLens = SaleLotsCatalogLens | SaleLotsLiveLens | SaleLotsPremiumLens;

export const OWN_PREMIUM_FILTER: DetailBoardFilter = { id: "own-premium", label: "Own premium" };

/** The lens a lots tab address asks for: `?premium=own` opens the "Own premium" filter. */
export function saleLotsLensFromQuery(premium: string | string[] | undefined): SaleLotsLens {
  return premium === "own" ? "own-premium" : "all";
}

export type SaleLotsFilterContext = LotCatalogSaleContext;

export {
  isLotCatalogComplete,
  formatLotEstimate,
  formatLotEstimateDisplay,
  formatLotCurrentValue,
  formatLotHammerForTable,
  lotStatusTone,
  lotStatusLabel,
};

export function resolveSaleLotsBoardMode(saleStatus: SaleStatus): SaleLotsBoardMode {
  return saleStatus === "draft" || saleStatus === "scheduled" ? "catalog" : "live";
}

/**
 * The filters above the sale's lots. "Own premium" is offered only while some unsold lot charges
 * its own premium, so it never opens on an empty list.
 */
export function saleLotsBoardFilters(
  mode: SaleLotsBoardMode,
  options: { ownPremium?: boolean } = {},
): DetailBoardFilter[] {
  const premium = options.ownPremium ? [OWN_PREMIUM_FILTER] : [];
  if (mode === "live") {
    return [
      { id: "all", label: "All" },
      { id: "live", label: "Live" },
      { id: "withdraw", label: "Withdraw" },
      { id: "sold", label: "Sold" },
      ...premium,
    ];
  }
  return [
    { id: "all", label: "All" },
    { id: "complete", label: "Complete" },
    { id: "incomplete", label: "Incomplete" },
    ...premium,
  ];
}

function isLotLive(status: LotStatus): boolean {
  return status === "active";
}

function isLotWithdrawn(status: LotStatus): boolean {
  return status === "cancelled" || status === "voided";
}

function isLotSold(lot: { status: LotStatus; winnerId?: string | null }): boolean {
  return lot.status === "ended" && Boolean(lot.winnerId);
}

export function filterSaleLotsByLens<T extends Parameters<typeof isLotCatalogComplete>[0]>(
  lots: readonly T[],
  lens: SaleLotsLens,
  sale: SaleLotsFilterContext,
  mode: SaleLotsBoardMode,
  /** Whether a lot charges its own premium; the "Own premium" lens keeps those lots. */
  chargesOwnPremium: (lot: T) => boolean = () => false,
): T[] {
  if (lens === "own-premium") return lots.filter(chargesOwnPremium);
  if (mode === "live") {
    switch (lens) {
      case "live":
        return lots.filter((lot) => isLotLive(lot.status));
      case "withdraw":
        return lots.filter((lot) => isLotWithdrawn(lot.status));
      case "sold":
        return lots.filter((lot) => isLotSold(lot));
      default:
        return [...lots];
    }
  }
  switch (lens) {
    case "complete":
      return lots.filter((lot) => isLotCatalogComplete(lot, sale));
    case "incomplete":
      return lots.filter((lot) => !isLotCatalogComplete(lot, sale));
    default:
      return [...lots];
  }
}

export function matchesSaleLotSearch<T extends { title: string; lotNumber: number | null }>(
  lot: T,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const num = lot.lotNumber != null ? String(lot.lotNumber) : "";
  return lot.title.toLowerCase().includes(q) || num.includes(q);
}

/** @deprecated Use lotStatusTone from lot-catalog-presenters */
export const lotLiveStatusTone = lotStatusTone;

/** @deprecated Use lotStatusLabel from lot-catalog-presenters */
export const lotLiveStatusLabel = lotStatusLabel;
