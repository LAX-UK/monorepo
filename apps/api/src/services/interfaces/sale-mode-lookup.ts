import type { SaleDeliveryMode } from "@auction/types";

/** Narrow port (ISP) for resolving the parent sale's delivery mode for a lot.
 * * BidService and other read paths only need to know which mode a lot's parent
 * sale is in (so they can apply `SaleModePolicy` rules). They should not depend
 * on a full `ISaleRepository` for this concern.
 */
export interface ISaleModeLookup {
  /** Returns the parent sale's delivery mode for the given lot, or `null` if the
   * lot is standalone (no sale) or the sale was not found.
   */
  findSaleModeForLot(lotId: string): Promise<SaleDeliveryMode | null>;
}
