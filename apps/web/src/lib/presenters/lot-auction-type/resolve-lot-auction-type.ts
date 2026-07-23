import type { LotAuctionType } from "@auction/types";
import {
  LOT_AUCTION_TYPE_REGISTRY,
  type LotAuctionTypePresentation,
} from "./lot-auction-type-registry";

/** Lot auction type → staff Tag-Review chip props. */
export function resolveLotAuctionTypePresentation(
  auctionType: LotAuctionType,
): LotAuctionTypePresentation {
  return LOT_AUCTION_TYPE_REGISTRY[auctionType];
}

export type { LotAuctionTypePresentation };
