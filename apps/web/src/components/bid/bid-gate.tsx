"use client";

import { evaluateBidPolicies } from "@/lib/bid/evaluate-bid-policies";
import { defaultBidPolicies } from "@/lib/bid/policies";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import type { SessionUser } from "@/lib/data/contracts";
import type { Lot } from "@auction/types";
import { type ReactNode, useMemo } from "react";

type Props = {
  user: SessionUser | null;
  lot: Lot;
  lotStatus: Lot["status"];
  loginNextPath: string;
  kycBidGate?: BidPolicyContext["kycBidGate"];
  policies?: readonly BidPolicy[];
  children: (ctx: { decision: BidPolicyDecision }) => ReactNode;
};

export function BidGate({
  user,
  lot,
  lotStatus,
  loginNextPath,
  kycBidGate = null,
  policies = defaultBidPolicies,
  children,
}: Props) {
  const ctx: BidPolicyContext = useMemo(
    () => ({ user, lot, lotStatus, loginNextPath, kycBidGate }),
    [user, lot, lotStatus, loginNextPath, kycBidGate],
  );

  const decision = useMemo(() => evaluateBidPolicies(policies, ctx), [policies, ctx]);

  return <>{children({ decision })}</>;
}
