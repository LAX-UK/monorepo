import type { AtgLotSellingSummary, AtgSaleSellingSummary, AtgSaleSyncView } from "@auction/types";
import type { ISaleChannelReader } from "./sale-channel.reader.js";

export interface IAtgLinkReader extends ISaleChannelReader {
  /** Null when the sale does not exist (or is deleted). Unlinked sales return `linked: false`. */
  getSaleView(saleId: string): Promise<AtgSaleSyncView | null>;
  /** ATG lot id for a linked lot, or null when the lot was never sent to ATG. */
  findAtgLotId(lotId: string): Promise<string | null>;
  /** Batched header and list summaries; deleted or unknown sales are absent from the map. */
  getSaleSellingSummaries(saleIds: string[]): Promise<Map<string, AtgSaleSellingSummary>>;
  /** Batched lot summaries with each lot's sale summary; deleted lots are absent. */
  getLotSellingSummaries(lotIds: string[]): Promise<Map<string, AtgLotSellingSummary>>;
}
