"use client";

import type { LotTimerState } from "@/components/lot-timer";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import type { BidPanelSurface } from "@/components/sections/artwork/online/bid-panel-surface";
import type { usePlaceBid } from "@/hooks/lot-bid/use-place-bid";
import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { LotReserveContext } from "@/lib/lot/reserve-presentation";
import type { Lot, LotEndedNoSaleReason, PublicLotView } from "@auction/types";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export const FIGMA_PRIMARY =
  "rounded border border-outline bg-on-surface px-8 py-4 text-base font-semibold leading-6 tracking-wide text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-highest";

export type BidPanelStickyVM = {
  live: boolean;
  loginNextPath: string;
  lotId: string;
  userEmail: string | null;
  kycFeedback: KycStatusSummaryDto["feedback"] | null;
  saleRegistrationPath?: string | null;
  step: 1 | 2;
  currentPriceLabel: string;
  priceFlash: boolean;
  onScrollToBid: () => void;
  remainingLabel: string;
  msRemaining: number;
  timerState: LotTimerState;
  countdownClock: string;
  lifecycleKind: LotLifecycle["kind"];
  isOnBlock: boolean;
  compact: boolean;
  position: LotBidPosition;
  reserveContext: LotReserveContext;
  hasActiveAutoBid: boolean;
  onFocusManualBid: () => void;
  onFocusAutoBid: () => void;
  isLeading: boolean;
  upcomingSlot: ReactNode;
};

export type BidPanelContextValue = {
  surface: BidPanelSurface;
  decision: BidPolicyDecision;
  gateBlocked: (decision: BidPolicyDecision) => boolean;
  bidControlsDisabled: (decision: BidPolicyDecision) => boolean;
  sellerBlocked: boolean;
  connectivityScope: "hybrid" | "bidding";
  auction: Lot | PublicLotView;
  sessionUser: SessionUser | null;
  summarySeed: LotSummarySeedVM;
  initialWatching: boolean;
  omitPricingHeader: boolean;
  showPricingHeader: boolean;
  kycSummary: KycStatusSummaryDto | null;
  saleRegistrationBidGate: SaleRegistrationBidGateContext | null;
  currentPrice: string;
  history: BidHistoryEntry[];
  leadingBidderId: string | null;
  activeAutoBid: AutoBidSettings | null;
  lifecycle: LotLifecycle;
  countdownClock: string;
  timerState: LotTimerState;
  remainingLabel: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
  position: LotBidPosition;
  reserveContext: LotReserveContext;
  biddingLive: boolean;
  priceFlash: boolean;
  noSaleReason: LotEndedNoSaleReason | null;
  extendedByMs: number | null;
  msRemaining: number;
  startTimeMs: number;
  endTime: number;
  refreshFromServer: () => Promise<{ ok: boolean }>;
  biddingAllowed: boolean;
  realtimeHealthy: boolean;
  isLotOnBlock: boolean;
  panel: ReturnType<typeof usePlaceBid>;
  sticky: BidPanelStickyVM;
};

const BidPanelContext = createContext<BidPanelContextValue | null>(null);

type ProviderProps = {
  value: BidPanelContextValue;
  children: ReactNode;
};

export function BidPanelProvider({ value, children }: ProviderProps) {
  return <BidPanelContext.Provider value={value}>{children}</BidPanelContext.Provider>;
}

export function useBidPanelContext(): BidPanelContextValue {
  const ctx = useContext(BidPanelContext);
  if (!ctx) {
    throw new Error("useBidPanelContext must be used within BidPanelProvider");
  }
  return ctx;
}

export function useBidPanelStickyVM(): BidPanelStickyVM & { decision: BidPolicyDecision } {
  const { decision, sticky } = useBidPanelContext();
  return { ...sticky, decision };
}
