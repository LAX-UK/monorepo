import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import type { AutoBidSettings } from "@/lib/data/contracts";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { Lot, PublicLotView, Sale } from "@auction/types";

export type DeriveBidPanelFlagsInput = {
  auction: Lot | PublicLotView;
  position: LotBidPosition;
  lifecycle: LotLifecycle;
  countdownClock: string;
  isLotOnBlock: boolean;
  biddingLive: boolean;
  biddingAllowed: boolean;
  activeAutoBid: AutoBidSettings | null;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
  switchEntryMode: (mode: "manual" | "auto", opts?: { userInitiated?: boolean }) => void;
};

export type BidPanelFlags = {
  englishOnlySurfaceLock: boolean;
  supportsAutoBid: boolean;
  autoBidEligible: boolean;
  showAutoBidExplainer: boolean;
  autoBidExplainerText: string;
  connectionBlocked: boolean;
  isWinning: boolean;
  includeAutoBidOnManualBid: boolean;
  activeAutoBidNote: {
    max: string;
    onChangeAutoBid: () => void;
  } | null;
};

export function deriveBidPanelFlags(input: DeriveBidPanelFlagsInput): BidPanelFlags {
  const includeAutoBidOnManualBid = Boolean(input.activeAutoBid?.isActive);
  const isWinning =
    input.position.kind === "winning" ||
    input.position.kind === "winningByAuto" ||
    input.position.kind === "leadingBelowReserve";

  const englishOnlySurfaceLock =
    isEnglishOnlyAuctionsLocked() &&
    input.auction.auctionType !== "english" &&
    input.auction.auctionType !== "buy_it_now";

  const supportsAutoBid =
    input.auction.auctionType === "english" || input.auction.auctionType === "buy_it_now";
  const autoBidEligible =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    (input.lifecycle.kind === "live" ||
      input.lifecycle.kind === "extended" ||
      (input.lifecycle.kind === "liveSaleroom" && input.isLotOnBlock));
  const showAutoBidExplainer =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    !autoBidEligible &&
    (input.lifecycle.kind === "scheduled" ||
      input.lifecycle.kind === "preLaunch" ||
      (input.lifecycle.kind === "liveSaleroom" && !input.isLotOnBlock));
  const isHybridSale = input.saleForLifecycle?.deliveryMode === "hybrid";
  const autoBidExplainerText =
    input.lifecycle.kind === "liveSaleroom" && !input.isLotOnBlock
      ? "Auto-bid opens when the auctioneer calls this lot on the block."
      : isHybridSale && input.lifecycle.kind === "scheduled"
        ? `Auto-bid opens when the auctioneer starts the sale${input.countdownClock ? ` (${input.countdownClock} until sale start)` : ""}.`
        : `Auto-bid opens when this lot goes live${input.countdownClock ? ` in ${input.countdownClock}` : ""}.`;

  const connectionBlocked = input.biddingLive && !input.biddingAllowed;

  const activeAutoBidNote =
    includeAutoBidOnManualBid && input.activeAutoBid?.maxAutoBidAmount
      ? {
          max: input.activeAutoBid.maxAutoBidAmount,
          onChangeAutoBid: () => input.switchEntryMode("auto", { userInitiated: true }),
        }
      : null;

  return {
    englishOnlySurfaceLock,
    supportsAutoBid,
    autoBidEligible,
    showAutoBidExplainer,
    autoBidExplainerText,
    connectionBlocked,
    isWinning,
    includeAutoBidOnManualBid,
    activeAutoBidNote,
  };
}
