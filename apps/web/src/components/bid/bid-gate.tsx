"use client";

import { evaluateBidPolicies } from "@/lib/bid/evaluate-bid-policies";
import { defaultBidPolicies } from "@/lib/bid/policies";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import type { SessionUser } from "@/lib/data/contracts";
import type { Lot, PublicLotView } from "@auction/types";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser | null;
  lot: Lot | PublicLotView;
  lotStatus: Lot["status"];
  loginNextPath: string;
  isOwnLot?: boolean;
  actingLegalEntityId?: string | null;
  kycBidGate?: BidPolicyContext["kycBidGate"];
  saleRegistrationBidGate?: BidPolicyContext["saleRegistrationBidGate"];
  strictBidEligibilityEnabled?: boolean;
  /** Aligns gate copy with `classifyLotLifecycle` (preview, scheduled, terminal, etc.). */
  biddingLifecycle?: BidPolicyContext["biddingLifecycle"];
  orgModuleEnabled?: boolean;
  unsupportedAuctionMode?: boolean;
  connectionBlocked?: boolean;
  connectionState?: BidPolicyContext["connectionState"];
  connectionMessage?: string | null;
  policies?: readonly BidPolicy[];
  children: (ctx: { decision: BidPolicyDecision }) => ReactNode;
};

export function BidGate({
  user,
  lot,
  lotStatus,
  loginNextPath,
  isOwnLot = false,
  actingLegalEntityId = null,
  kycBidGate = null,
  saleRegistrationBidGate = null,
  strictBidEligibilityEnabled = false,
  biddingLifecycle = null,
  orgModuleEnabled = true,
  unsupportedAuctionMode = false,
  connectionBlocked = false,
  connectionState,
  connectionMessage = null,
  policies = defaultBidPolicies,
  children,
}: Props) {
  const ctx: BidPolicyContext = useMemo(
    () => ({
      user,
      lot,
      lotStatus,
      loginNextPath,
      isOwnLot,
      actingLegalEntityId,
      kycBidGate,
      saleRegistrationBidGate,
      strictBidEligibilityEnabled,
      biddingLifecycle,
      orgModuleEnabled,
      unsupportedAuctionMode,
      connectionBlocked,
      ...(connectionState ? { connectionState } : {}),
      connectionMessage,
    }),
    [
      user,
      lot,
      lotStatus,
      loginNextPath,
      isOwnLot,
      actingLegalEntityId,
      kycBidGate,
      saleRegistrationBidGate,
      strictBidEligibilityEnabled,
      biddingLifecycle,
      orgModuleEnabled,
      unsupportedAuctionMode,
      connectionBlocked,
      connectionState,
      connectionMessage,
    ],
  );

  const decision = useMemo(() => evaluateBidPolicies(policies, ctx), [policies, ctx]);

  return <>{children({ decision })}</>;
}
