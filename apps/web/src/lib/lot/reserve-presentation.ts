import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import { type NoSaleReason, deriveReserveStatus } from "@auction/domain";
import type { Lot, LotEndedNoSaleReason, PublicLotView } from "@auction/types";

export type LotReserveContext = {
  hasReserve: boolean;
  reserveMet: boolean | null;
};

export function resolveLotReserveContext(
  lot: Lot | PublicLotView,
  currentPrice: string,
): LotReserveContext {
  const staffLot = lot as Lot;
  if (staffLot.reservePrice != null && staffLot.reservePrice !== "") {
    const status = deriveReserveStatus(currentPrice, staffLot.reservePrice);
    return {
      hasReserve: status.kind !== "none",
      reserveMet: status.kind === "none" ? null : status.kind === "met",
    };
  }
  if ("hasReserve" in lot && typeof lot.hasReserve === "boolean") {
    return {
      hasReserve: lot.hasReserve,
      reserveMet: lot.reserveMet ?? null,
    };
  }
  return { hasReserve: false, reserveMet: null };
}

export function reserveBadgeLabel(reserveMet: boolean | null, hasReserve: boolean): string | null {
  if (!hasReserve || reserveMet === null) return null;
  return reserveMet ? "Reserve met" : "Below reserve";
}

export function resolveEndedBanner(params: {
  noSaleReason?: LotEndedNoSaleReason | NoSaleReason;
  isHighBidder?: boolean;
}): string {
  const { noSaleReason, isHighBidder } = params;
  if (isHighBidder) {
    if (noSaleReason === "clerk_passed") {
      return "You had the high bid, but this lot was passed by the auctioneer.";
    }
    if (noSaleReason === "no_bids") {
      return "This lot closed with no bids.";
    }
    return "You had the high bid, but this lot did not sell — the reserve was not met.";
  }
  switch (noSaleReason) {
    case "clerk_passed":
      return "This lot was passed — no sale.";
    case "no_bids":
      return "This lot closed with no bids.";
    case "reserve_not_met":
      return "This lot did not sell — the reserve was not met.";
    default:
      return "This lot did not sell.";
  }
}

export function resolveNoSaleSummaryCopy(params: {
  noSaleReason?: LotEndedNoSaleReason | NoSaleReason;
  isHighBidder?: boolean;
}): string {
  return resolveEndedBanner(params);
}

export function lotDetailsReserveLine(hasReserve: boolean): string {
  return hasReserve ? "Reserve may apply (amount not disclosed)" : "No reserve";
}

export function stickyPositionLabel(
  position: LotBidPosition,
  reserve: LotReserveContext,
): string | null {
  if (position.kind === "leadingBelowReserve") return "High bid";
  if (
    (position.kind === "winning" || position.kind === "winningByAuto") &&
    reserve.hasReserve &&
    reserve.reserveMet === false
  ) {
    return "High bid";
  }
  switch (position.kind) {
    case "winning":
    case "winningByAuto":
      return "Winning";
    case "outbid":
      return "Outbid";
    case "inRunning":
      return "Behind";
    case "won":
      return "Won";
    case "lost":
      return "Closed";
    default:
      return null;
  }
}

export function leadingBelowReserve(reserve: LotReserveContext, isLeading: boolean): boolean {
  return isLeading && reserve.hasReserve && reserve.reserveMet === false;
}
