import type { TransferFunding } from "@auction/domain";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";

/** How many of a buyer's latest ledger entries are read to find the transfer behind an application. */
export const CASH_BALANCE_LEDGER_WINDOW = 25;

/** What a payment shows of itself: the reference a sender is told to quote, and who it belongs to here. */
export type PaymentTransferDetails = {
  /** Null once the provider no longer shows transfer instructions (the payment has completed). */
  ownReference: string | null;
  paymentId: string | null;
  paymentGroupId: string | null;
};

/**
 * Read-only view of a buyer's bank-transfer ledger at the payment provider.
 *
 * Fields used (Stripe API, confirmed against stripe@22 types and the customer-balance
 * reconciliation docs):
 * - customer cash balance transaction `type: "funded"` carries `funded.bank_transfer.reference`
 *   (the reference the sender quoted, or null) and `created` (unix seconds);
 * - `type: "applied_to_payment"` carries `applied_to_payment.payment_intent`, `net_amount`
 *   (negative: money leaving the balance), `currency`, `customer` and `created`;
 * - a payment intent shows its own reference in
 *   `next_action.display_bank_transfer_instructions.reference` while it awaits funding.
 */
export interface ICashBalanceGateway {
  /** The buyer's newest transfers received, newest first, bounded to a fixed window. */
  listRecentFundings(customerId: string): Promise<TransferFunding[]>;
  describePayment(paymentIntentId: string): Promise<PaymentTransferDetails>;
}

export class StripeCashBalanceGateway implements ICashBalanceGateway {
  constructor(private readonly stripeFactory: IStripeClientFactory) {}

  async listRecentFundings(customerId: string): Promise<TransferFunding[]> {
    const stripe = this.stripeFactory.require();
    const page = await executeWithStripeRetries(() =>
      stripe.customers.listCashBalanceTransactions(customerId, {
        limit: CASH_BALANCE_LEDGER_WINDOW,
      }),
    );
    return page.data
      .filter((txn) => txn.type === "funded" && txn.funded)
      .map((txn) => ({
        id: txn.id,
        createdAt: txn.created,
        reference: txn.funded?.bank_transfer.reference ?? null,
      }));
  }

  async describePayment(paymentIntentId: string): Promise<PaymentTransferDetails> {
    const stripe = this.stripeFactory.require();
    const intent: Stripe.PaymentIntent = await executeWithStripeRetries(() =>
      stripe.paymentIntents.retrieve(paymentIntentId),
    );
    return {
      ownReference: intent.next_action?.display_bank_transfer_instructions?.reference ?? null,
      paymentId: intent.metadata?.paymentId ?? null,
      paymentGroupId: intent.metadata?.paymentGroupId ?? null,
    };
  }
}
