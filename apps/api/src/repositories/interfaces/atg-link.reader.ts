import type { AtgSaleSyncView } from "@auction/types";

export interface IAtgLinkReader {
  /** Null when the sale does not exist (or is deleted). Unlinked sales return `linked: false`. */
  getSaleView(saleId: string): Promise<AtgSaleSyncView | null>;
  /** ATG lot id for a linked lot, or null when the lot was never sent to ATG. */
  findAtgLotId(lotId: string): Promise<string | null>;
}
