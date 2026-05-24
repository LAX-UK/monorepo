import type { SessionUser } from "@/lib/data/contracts";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import type { LegalEntityMemberRole, Lot } from "@auction/types";
import type { ReactNode } from "react";

export type KycBidGateContext = {
  requiresKyc: boolean;
  feedback?: KycUserFeedbackDto | null;
};

export type SaleRegistrationBidGateContext = {
  saleId: string;
  /** When true, user is acting as buyer_agent and must be approved for this sale. */
  requiresRegistration: boolean;
  /** Acting legal entity id (buyer_agent org). */
  actingEntityId: string | null;
  /** `approved` | `pending` | `rejected` | `withdrawn` | missing */
  registrationStatus: string | null;
  /** Parsed approved registration cap for the acting entity, when set. */
  approvedBidLimit: number | null;
  buyerEntities: { id: string; displayName: string; memberRole: LegalEntityMemberRole }[];
  myRegistrations: { buyerLegalEntityId: string; status: string; bidLimit?: string | null }[];
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
};

export type BidPolicyContext = {
  user: SessionUser | null;
  lot: Lot;
  lotStatus: Lot["status"];
  /** Post-login return path for the sign-in CTA (e.g. `/lot/:slug/:id`). */
  loginNextPath: string;
  /** When set, bidding is blocked until identity verification threshold is met. */
  kycBidGate?: KycBidGateContext | null;
  /** When set, buyer_agent acting context must have approved sale registration. */
  saleRegistrationBidGate?: SaleRegistrationBidGateContext | null;
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
