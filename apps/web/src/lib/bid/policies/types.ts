import type { SessionUser } from "@/lib/data/contracts";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import type { Lot } from "@auction/types";
import type { ReactNode } from "react";

export type BidPolicyContext = {
  user: SessionUser | null;
  lot: Lot;
  lotStatus: Lot["status"];
  /** Post-login return path for the sign-in CTA (e.g. `/lot/:slug/:id`). */
  loginNextPath: string;
  /** When true, bidding is blocked until identity verification threshold is met. */
  kycBidGate?: { requiresKyc: boolean } | null;
  /** When set, `not-live` policy uses lifecycle-specific block copy (aligned with `classifyLotLifecycle`). */
  biddingLifecycle?: { kind: LotLifecycleKind } | null;
};

export type BidPolicyDecision =
  | { kind: "allow" }
  | { kind: "block"; viewId: string; render: () => ReactNode };

export interface BidPolicy {
  readonly id: string;
  evaluate(ctx: BidPolicyContext): BidPolicyDecision;
}
