import type { Database } from "@auction/db";
import type { UnappliedMoneyPayload, UnappliedMoneyReason } from "@auction/domain";

/** A finance task for money we could not apply, still open. */
export type OpenUnappliedMoney = UnappliedMoneyPayload & {
  eventId: number;
  receivedAt: Date;
};

/** Narrows open tasks: by the Stripe money (intent or charge, either matches), reason or key. */
export type OpenUnappliedMoneyFilter = {
  paymentIntentId?: string | null;
  chargeId?: string | null;
  reasons?: readonly UnappliedMoneyReason[];
  excludeReasons?: readonly UnappliedMoneyReason[];
  dedupeKey?: string;
  /** Balance money: one Stripe customer's open tasks. */
  stripeCustomerId?: string;
};

export interface IUnappliedMoneyReader {
  /** Whether this money was already reported (any state), so it is never reported twice. */
  exists(dedupeKey: string, tx?: Database): Promise<boolean>;
  /** Open tasks for one Stripe charge, so a full refund of that charge can close them. */
  listOpenByChargeId(chargeId: string): Promise<OpenUnappliedMoney[]>;
  /** One open task, by its key (what staff close by hand). */
  findOpen(dedupeKey: string): Promise<OpenUnappliedMoney | null>;
  /** Whether the charge pays a captured (or since refunded) invoice: it is that invoice's money. */
  isChargeOfPaidInvoice(chargeId: string): Promise<boolean>;
  /**
   * Whether the charge was ever reported as unapplied money, open or closed. Such a charge is
   * never an invoice's own money, so its refund never claws back a seller.
   */
  wasEverUnapplied(chargeId: string): Promise<boolean>;
  /**
   * Serialises reports of one piece of money inside the caller's transaction, so two deliveries
   * at once cannot both open a task. Released when the transaction ends.
   */
  lockKey(tx: Database, dedupeKey: string): Promise<void>;
  listOpen(input: OpenUnappliedMoneyFilter & { limit: number }): Promise<OpenUnappliedMoney[]>;
}
