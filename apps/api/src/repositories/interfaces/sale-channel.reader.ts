import type { AtgLotChannelState, AtgSaleOwnershipSnapshot } from "@auction/types";

/** Narrow port for one-platform-per-sale guards (implemented by {@link DrizzleAtgLinkReader}). */
export interface ISaleChannelReader {
  getSaleOwnership(saleId: string): Promise<AtgSaleOwnershipSnapshot | null>;
  getLotAtgState(lotId: string): Promise<AtgLotChannelState>;
}
