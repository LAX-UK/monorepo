import type { Lot } from "@auction/types";

/** Hide running high bid for active sealed lots from non-admins (REST + cache consumers). */
export function maskLotForPublicView(lot: Lot, role: string | undefined): Lot {
  if (lot.auctionType === "sealed" && lot.status === "active" && role !== "admin") {
    return { ...lot, currentPrice: lot.startingPrice };
  }
  return lot;
}
