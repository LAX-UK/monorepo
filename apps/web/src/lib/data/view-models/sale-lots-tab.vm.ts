import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
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
export type SaleLotsLens = SaleLotsCatalogLens | SaleLotsLiveLens;

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

export function saleLotsBoardFilters(mode: SaleLotsBoardMode): DetailBoardFilter[] {
  if (mode === "live") {
    return [
      { id: "all", label: "All" },
      { id: "live", label: "Live" },
      { id: "withdraw", label: "Withdraw" },
      { id: "sold", label: "Sold" },
    ];
  }
  return [
    { id: "all", label: "All" },
    { id: "complete", label: "Complete" },
    { id: "incomplete", label: "Incomplete" },
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

export function buildSaleLotsKpiTiles(
  lots: Parameters<typeof isLotCatalogComplete>[0][],
  sale: SaleLotsFilterContext,
  mode: SaleLotsBoardMode,
): DetailBoardKpiTile[] {
  if (mode === "live") {
    const liveNow = lots.filter((l) => isLotLive(l.status)).length;
    const withdrawn = lots.filter((l) => isLotWithdrawn(l.status)).length;
    return [
      { id: "total", label: "Total lots", value: String(lots.length), compareHint: "In this sale" },
      { id: "live", label: "Live now", value: String(liveNow), compareHint: "Accepting bids" },
      {
        id: "withdraw",
        label: "Withdraw",
        value: String(withdrawn),
        compareHint: "Removed from sale",
      },
    ];
  }
  const complete = lots.filter((lot) => isLotCatalogComplete(lot, sale)).length;
  const incomplete = lots.length - complete;
  return [
    { id: "total", label: "Total lots", value: String(lots.length), compareHint: "In this sale" },
    { id: "complete", label: "Complete", value: String(complete), compareHint: "Ready to publish" },
    {
      id: "incomplete",
      label: "Incomplete",
      value: String(incomplete),
      compareHint: "Needs catalog work",
    },
  ];
}

export function filterSaleLotsByLens<T extends Parameters<typeof isLotCatalogComplete>[0]>(
  lots: readonly T[],
  lens: SaleLotsLens,
  sale: SaleLotsFilterContext,
  mode: SaleLotsBoardMode,
): T[] {
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
