import type { AtgLotChannelState, AtgSaleOwnershipSnapshot } from "@auction/types";

/** Narrow port for one-platform-per-sale guards (implemented by {@link DrizzleAtgLinkReader}). */
export interface ISaleChannelReader {
  getSaleOwnership(saleId: string): Promise<AtgSaleOwnershipSnapshot | null>;
  /** Batch form for public lists; deleted or unknown sales are absent from the map. */
  getSaleOwnerships(saleIds: string[]): Promise<Map<string, AtgSaleOwnershipSnapshot>>;
  getLotAtgState(lotId: string): Promise<AtgLotChannelState>;
  /** LAX lot ids that sold on ATG for the sale's auction. */
  getSoldLotIds(saleId: string): Promise<Set<string>>;
}
