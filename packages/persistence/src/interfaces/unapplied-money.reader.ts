import type { UnappliedMoneyPayload } from "@auction/domain";

/** A finance task for money we could not apply, still open. */
export type OpenUnappliedMoney = UnappliedMoneyPayload & {
  eventId: number;
  receivedAt: Date;
};

export interface IUnappliedMoneyReader {
  /** Whether this money was already reported (any state), so it is never reported twice. */
  exists(dedupeKey: string): Promise<boolean>;
  /** Open tasks for one Stripe charge, so a full refund of that charge can close them. */
  listOpenByChargeId(chargeId: string): Promise<OpenUnappliedMoney[]>;
  listOpen(input: { limit: number }): Promise<OpenUnappliedMoney[]>;
}
