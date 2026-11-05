import type { PartyAmlStatus, PartyKycStatus, SourceOfFundsStatus } from "@auction/types";

/** The checks on one party, as the existing identity and screening records report them. */
export type PartyClearance = { kyc: PartyKycStatus; aml: PartyAmlStatus };

/** Everything the gates read, taken at one moment. The state machine never reads records itself. */
export type DealClearanceSnapshot = {
  /** `null` when the party has no legal entity yet. */
  seller: PartyClearance | null;
  buyer: PartyClearance | null;
  buyerSourceOfFunds: SourceOfFundsStatus;
  /** What the buyer has open elsewhere (lots won, other deals), counted towards source of funds. */
  buyerOtherOpenExposureMinor: number;
};

/**
 * Reads the checks for a deal's parties. Implemented over the existing KYC, AML and
 * source-of-funds services, so staff here never decide a check: Compliance does.
 */
export interface DealClearancePort {
  snapshot(deal: {
    dealId: string;
    seller: DealPartyRef;
    /** `null` while the buyer is not named. */
    buyer: DealPartyRef | null;
  }): Promise<DealClearanceSnapshot>;
}

/**
 * A party as the checks know them: identity and screening are recorded for the person acting for
 * the legal entity, so the entity alone is not enough to read them.
 */
export type DealPartyRef = { legalEntityId: string; actingUserId: string | null };

export const partyIsClear = (party: PartyClearance): boolean =>
  party.kyc === "clear" && party.aml === "clear";

/** Source of funds is needed when the price, with what the buyer already has open, reaches the threshold. */
export function sourceOfFundsRequired(input: {
  priceMinor: number;
  buyerOtherOpenExposureMinor: number;
  thresholdMinor: number;
}): boolean {
  return input.priceMinor + input.buyerOtherOpenExposureMinor >= input.thresholdMinor;
}

/** Whether a price reaches the AML threshold, which is when screening is expected to have started. */
export const meetsAmlThreshold = (priceMinor: number, thresholdMinor: number): boolean =>
  priceMinor >= thresholdMinor;
