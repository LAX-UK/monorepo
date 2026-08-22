import type { SelfServiceActorKycStatus } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "./bid-error.js";

export type BidEligibilityCheckInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  amount: number;
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  placedVia?: string | null;
  telephoneBookingId?: string | null;
  saleId?: string | null;
  paddleNumber?: number | null;
};

export interface IBidEligibility {
  assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>>;
}

export interface IKycThresholdGate {
  enforceThreshold(userId: string): Promise<void>;
}

export interface IAmlHoldReader {
  getHold(userId: string): Promise<{ status: string } | null>;
}

export type BidActorEligibilityRow = {
  emailVerified: boolean;
  kycStatus: SelfServiceActorKycStatus;
};

export interface IBidActorEligibilityReader {
  findBidActorEligibility(userId: string): Promise<BidActorEligibilityRow | null>;
}

export type BidLotRulesRow = {
  saleId: string | null;
  autoBidEnabled: boolean | null;
  minBidIncrement: string;
  autoBidStepMin: string | null;
  autoBidStepMax: string | null;
  autoBidStepPresets: number[] | null;
};

export interface IBidLotRulesReader {
  findLotBidRules(lotId: string): Promise<BidLotRulesRow | null>;
}

export interface IBidMembershipReader {
  findBuyerEntityMembership(
    userId: string,
    legalEntityId: string,
  ): Promise<{
    entityExists: boolean;
    memberRole: LegalEntityMemberRole | null;
  }>;
}

export interface IOperatorPlacementReader {
  findTelephoneBookingPlacement(bookingId: string): Promise<{
    saleId: string;
    status: string;
    userId: string;
    buyerLegalEntityId: string;
  } | null>;
  findTelephoneBookingCap(bookingId: string): Promise<{ reserveAltMax: string | null } | null>;
  findPaddleRegistration(
    saleId: string,
    paddleNumber: number,
  ): Promise<{ bidLimit: string | null; status: string } | null>;
}

export interface ISaleRegistrationBidReader {
  findRegistration(
    saleId: string,
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<{ status: string; bidLimit: string | null } | null>;
}

export interface IBuyerAgentAuthorisationReader {
  findActiveAuthorisations(input: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }): Promise<Array<{ saleId: string | null; bidLimit: string | null }>>;
}
