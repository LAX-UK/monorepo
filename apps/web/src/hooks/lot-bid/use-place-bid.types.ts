import type { UseLotBidStateResult } from "@/hooks/use-lot-bid-state";
import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import type { AutoBidSettings, BidWriter, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { Lot, PublicLotView, Sale } from "@auction/types";

export type BidAuctionContext = {
  auction: Lot | PublicLotView;
  sessionUser: SessionUser | null;
  isOwnLot?: boolean;
  loginNextPath?: string | undefined;
  kycSummary?: KycStatusSummaryDto | null;
  saleRegistrationBidGate?: SaleRegistrationBidGateContext | null;
  saleRegistrationPath?: string | null;
};

export type BidPricingContext = {
  currentPrice: string;
  leadingBidderId: string | null;
  activeAutoBid: AutoBidSettings | null;
};

export type BidLifecycleContext = {
  position: LotBidPosition;
  lifecycle: LotLifecycle;
  countdownClock: string;
  isLotOnBlock: boolean;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
};

export type BidConnectionContext = {
  biddingLive: boolean;
  biddingAllowed: boolean;
  realtimeHealthy: boolean;
};

export type BidPlacementCallbacks = {
  applyOwnBidResult: UseLotBidStateResult["applyOwnBidResult"];
  scrollToBid: () => void;
  scrollToAutoBid: () => void;
  handleAutoBidSaved: (settings: AutoBidSettings | null) => void;
  markLotEndedLocally: (banner: string) => void;
  setActiveAutoBid: (settings: AutoBidSettings | null) => void;
  refreshFromServer: () => Promise<{ ok: boolean }>;
  bidWriter: BidWriter;
};

export type BidPanelPreferences = {
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  omitPricingHeader?: boolean;
};

export type UsePlaceBidParams = BidAuctionContext &
  BidPricingContext &
  BidLifecycleContext &
  BidConnectionContext &
  BidPlacementCallbacks &
  BidPanelPreferences;
