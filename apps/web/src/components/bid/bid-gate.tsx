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
  /** Aligns gate copy with `classifyLotLifecycle` (preview, scheduled, terminal, etc.). */
  biddingLifecycle?: BidPolicyContext["biddingLifecycle"];
  orgModuleEnabled?: boolean;
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
  biddingLifecycle = null,
  orgModuleEnabled = true,
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
      biddingLifecycle,
      orgModuleEnabled,
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
      biddingLifecycle,
      orgModuleEnabled,
    ],
  );

  const decision = useMemo(() => evaluateBidPolicies(policies, ctx), [policies, ctx]);

  return <>{children({ decision })}</>;
}
