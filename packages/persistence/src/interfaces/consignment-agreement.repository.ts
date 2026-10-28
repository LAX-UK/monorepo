import type { AgreementReminderDay } from "@auction/domain";
import type { ConsignmentAgreement } from "@auction/types";

export type ConsignmentAgreementProposalRow = {
  submissionId: string;
  legalEntityId: string;
  termsVersion: string;
  estimateLow: string | null;
  estimateHigh: string | null;
  reservePrice: string | null;
  commissionPercent: string | null;
  currency: string;
  proposedByUserId: string;
  proposedAt: Date;
};

/** An agreement still waiting for the seller, with the facts the reminder rule needs. */
export type AwaitingConsignmentAgreement = {
  id: string;
  submissionId: string;
  legalEntityId: string;
  submissionTitle: string;
  proposedAt: Date;
  acceptedAt: null;
  reminderDay3SentAt: Date | null;
  reminderDay7SentAt: Date | null;
};

/** Reads consignment agreements. */
export interface IConsignmentAgreementReader {
  findBySubmissionId(submissionId: string): Promise<ConsignmentAgreement | null>;
  listByLegalEntity(legalEntityId: string): Promise<ConsignmentAgreement[]>;
  /** Agreements proposed before `proposedBefore` that nobody has accepted, oldest first. */
  listAwaiting(proposedBefore: Date, limit: number): Promise<AwaitingConsignmentAgreement[]>;
}

/** Writes consignment agreements. Each write is conditional, so retries never double up. */
export interface IConsignmentAgreementWriter {
  /** Records (or replaces, while unaccepted) the specialist's proposal for a submission. */
  propose(row: ConsignmentAgreementProposalRow): Promise<ConsignmentAgreement>;
  /**
   * Records the acceptance if none exists yet. Returns the agreement as stored, so a second
   * caller sees the first acceptance.
   */
  accept(input: {
    submissionId: string;
    acceptedByUserId: string;
    acceptedAt: Date;
  }): Promise<ConsignmentAgreement | null>;
  /**
   * Marks a reminder as sent. Sending a later reminder also marks the earlier ones, which are
   * then never sent. Returns false when another run already marked it.
   */
  markReminderSent(id: string, day: AgreementReminderDay, sentAt: Date): Promise<boolean>;
}

export type IConsignmentAgreementRepository = IConsignmentAgreementReader &
  IConsignmentAgreementWriter;
