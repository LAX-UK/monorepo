"use client";

import type { AutoBidPlacedBid, AutoBidSettings } from "@/lib/data/contracts";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { getArtworkAuctionTypeProfile } from "@/lib/marketing/artwork/auction-type-profile";
import type { clientBidError } from "@/lib/ui/bid-error";
import type { LotAuctionType } from "@auction/types";
import type { ReactNode } from "react";
import { AutoBidUnavailableCard } from "./lot-auto-bid/auto-bid-unavailable-card";
import { LotAutoBidPanelContent } from "./lot-auto-bid/lot-auto-bid-panel-content";
import {
  type LotAutoBidPanelProps,
  useLotAutoBidPanel,
} from "./lot-auto-bid/use-lot-auto-bid-panel";

type Props = LotAutoBidPanelProps & {
  auctionType: LotAuctionType;
  kycFeedback?: KycUserFeedbackDto | null;
  onFeedbackError?: (error: ReturnType<typeof clientBidError> | null) => void;
  initialSettings: AutoBidSettings | null;
  onSettingsSaved?: (settings: AutoBidSettings | null, placedBid?: AutoBidPlacedBid) => void;
  /** Names the account the auto-bid is for, shown beside the save action. */
  biddingAs?: ReactNode;
};

export function LotAutoBidPanel({ lot, auctionType, biddingAs, ...panelProps }: Props) {
  const view = useLotAutoBidPanel({ lot, ...panelProps });

  if (!getArtworkAuctionTypeProfile(auctionType).showAutoBidPanel) return null;

  if (lot.autoBidEnabled === false) {
    return <AutoBidUnavailableCard />;
  }

  return <LotAutoBidPanelContent {...view} biddingAs={biddingAs} />;
}
