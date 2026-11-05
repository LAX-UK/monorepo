import type {
  IPaymentCheckoutSessionStore,
  IPaymentWriteRepository,
  IStalePaymentCanceller,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "../decimal-money.js";
import type { IStalePaymentStore } from "./stale-payment-expiry.js";

/** The expiry job's view of invoices, over the payment and checkout session repositories. */
export class StalePaymentStore implements IStalePaymentStore {
  constructor(
    private readonly payments: Pick<
      IPaymentWriteRepository,
      | "listStalePendingBefore"
      | "listStaleAuthorizedBefore"
      | "findById"
      | "applyAuthorizedInTransaction"
    >,
    private readonly sessions: Pick<IPaymentCheckoutSessionStore, "listSessionIds">,
    private readonly canceller: IStalePaymentCanceller,
    private readonly transactionRunner: ITransactionRunner,
  ) {}

  listStalePendingBefore(cutoff: Date) {
    return this.payments.listStalePendingBefore(cutoff);
  }

  listStaleAuthorizedBefore(cutoff: Date) {
    return this.payments.listStaleAuthorizedBefore(cutoff);
  }

  async findForExpiry(paymentId: string) {
    const row = await this.payments.findById(paymentId);
    if (!row) return null;
    return {
      status: row.status,
      amountPence: gbpAmountToPence(row.amount),
      stripePaymentIntentId: row.stripePaymentIntentId ?? null,
      paymentGroupId: row.paymentGroupId ?? null,
      buyerLegalEntityId: row.buyerLegalEntityId ?? null,
    };
  }

  checkoutSessionIds(paymentId: string) {
    return this.sessions.listSessionIds(paymentId);
  }

  cancelIfUnpaid(paymentId: string, checkStartedAt: Date) {
    return this.canceller.cancelIfUntouchedSince(paymentId, checkStartedAt);
  }

  markAuthorizedIfPending(paymentId: string) {
    return this.transactionRunner.runInTransaction((tx) =>
      this.payments.applyAuthorizedInTransaction(tx, paymentId),
    );
  }
}
