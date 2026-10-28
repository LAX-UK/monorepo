import type { SellerIdentityReminderState } from "./consignment-after-sale.js";

/**
 * The consignment agreement for one submission: the specialist's estimate and terms, proposed
 * when the work is accepted, and the seller's acceptance of them under a versioned set of
 * seller conditions.
 */
export type ConsignmentAgreement = {
  id: string;
  submissionId: string;
  legalEntityId: string;
  /** Version of the seller conditions the seller reads and accepts. */
  termsVersion: string;
  estimateLow: string | null;
  estimateHigh: string | null;
  reservePrice: string | null;
  /** Seller's commission as a percentage, for example "15" or "12.5". */
  commissionPercent: string | null;
  currency: string;
  proposedAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  /** Display name of the person who accepted, when known. */
  acceptedByName?: string | null;
  /** The lowest reserve the specialist accepts if the lot is relisted unsold, when set. */
  relistReserveFloor?: string | null;
};

/** The specialist's proposal, made with the decision to accept the work. */
export type ConsignmentAgreementProposalInput = {
  estimateLow?: string | null | undefined;
  estimateHigh?: string | null | undefined;
  reservePrice?: string | null | undefined;
  commissionPercent?: string | null | undefined;
  currency?: string | undefined;
};

/** Agreement plus what the person reading it may do with it. */
export type ConsignmentAgreementView = {
  agreement: ConsignmentAgreement | null;
  /** The person may accept it for this account (owner or admin, or their own profile). */
  canAccept: boolean;
};

/** What staff see about the seller's side of a submission. */
export type StaffConsignmentView = {
  agreement: ConsignmentAgreement | null;
  /** The seller's identity (or organisation documents) is checked, so the work can be accepted. */
  sellerIdentityVerified: boolean;
  /** When the seller was last reminded to verify, while acceptance waits for it. */
  identityReminder?: SellerIdentityReminderState;
};
