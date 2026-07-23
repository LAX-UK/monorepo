import type { LotAuctionType } from "@auction/types";
import type { LotAuctionTypeTagKey } from "@auction/ui";

export type LotAuctionTypePresentation = {
  label: string;
  mode: LotAuctionTypeTagKey;
};

export const LOT_AUCTION_TYPE_REGISTRY: Record<LotAuctionType, LotAuctionTypePresentation> = {
  english: { label: "English", mode: "english" },
  dutch: { label: "Dutch", mode: "dutch" },
  sealed: { label: "Sealed bid", mode: "sealed" },
  buy_it_now: { label: "Buy it now", mode: "buy_it_now" },
};

export function lotAuctionTypeLabel(auctionType: LotAuctionType): string {
  return LOT_AUCTION_TYPE_REGISTRY[auctionType].label;
}
