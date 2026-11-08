import type { DealDeadlineKind, PaymentReminderStep } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";

/** A deal with a deadline that may need a reminder, and the steps already sent for it. */
export type DealReminderCandidate = {
  dealId: string;
  reference: string;
  stage: PrivateSaleDealStage;
  kind: DealDeadlineKind;
  dueAt: Date;
  /** The buyer's account and the member acting for it. */
  buyerLegalEntityId: string;
  buyerUserId: string;
  workTitle: string;
  /** What the buyer owes, in pence: the price plus any buyer's fee. */
  amountDueMinor: number | null;
  sentSteps: PaymentReminderStep[];
};

export interface IPrivateSaleDealReminderStore {
  /** Deals whose payment (invoiced) or collection (paid) deadline is set, soonest first. */
  listCandidates(limit: number): Promise<DealReminderCandidate[]>;
  /** Takes a step before it is sent; `false` when another run already took it. */
  claim(dealId: string, kind: DealDeadlineKind, step: PaymentReminderStep): Promise<boolean>;
  /** Gives a step back after a failed send, so the next run tries again. */
  release(dealId: string, kind: DealDeadlineKind, step: PaymentReminderStep): Promise<void>;
}
