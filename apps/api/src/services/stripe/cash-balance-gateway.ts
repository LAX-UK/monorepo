import type { LedgerEntry, TransferSupply } from "@auction/domain";
import { supplyBehindApplication } from "@auction/domain";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import { type PaymentTransferDetails, transferDetailsOf } from "./transfer-intent.js";

/** Entries read per page of a buyer's ledger. */
export const CASH_BALANCE_LEDGER_PAGE = 25;
/** Pages read at most when looking for the source of one application. */
export const CASH_BALANCE_LEDGER_MAX_PAGES = 4;

export type { PaymentTransferDetails } from "./transfer-intent.js";

/** What was found behind an application. `windowExceeded` means the search stopped at its cap. */
export type SupplyLookup = { supply: TransferSupply | null; windowExceeded: boolean };

/**
 * Read-only view of a buyer's bank-transfer ledger at the payment provider.
 *
 * Fields used (Stripe API, confirmed against stripe@22 types and the customer-balance
 * reconciliation docs):
 * - customer cash balance transactions, listed newest first, `starting_after` an entry id giving
 *   the entries before it; `type: "funded"` carries `funded.bank_transfer.reference` (what the
 *   sender quoted, or null); `type: "unapplied_from_payment"` carries
 *   `unapplied_from_payment.payment_intent` (the payment the money was taken back from);
 * - an `applied_to_payment` entry carries `applied_to_payment.payment_intent`;
 * - a payment intent shows its own reference in
 *   `next_action.display_bank_transfer_instructions.reference` while it awaits funding.
 */
export interface ICashBalanceGateway {
  /** The source of one application, found by walking the ledger back from it (bounded). */
  findSupplyBehind(customerId: string, appliedTransactionId: string): Promise<SupplyLookup>;
  describePayment(paymentIntentId: string): Promise<PaymentTransferDetails>;
}

const idOf = (value: string | { id: string }): string =>
  typeof value === "string" ? value : value.id;

/**
 * Entries after which an older transfer may not be the source of what is applied next: money
 * refunded or returned into the balance, or moved to the account balance. The check stops there.
 */
const LEDGER_STOPS: ReadonlySet<string> = new Set([
  "refunded_from_payment",
  "transferred_to_balance",
  "return_canceled",
]);

function ledgerEntryOf(txn: Stripe.CustomerCashBalanceTransaction): LedgerEntry {
  if (txn.type === "funded" && txn.funded) {
    return { kind: "funded", id: txn.id, reference: txn.funded.bank_transfer.reference ?? null };
  }
  if (txn.type === "unapplied_from_payment" && txn.unapplied_from_payment) {
    return {
      kind: "unapplied",
      id: txn.id,
      paymentIntentId: idOf(txn.unapplied_from_payment.payment_intent),
    };
  }
  if (LEDGER_STOPS.has(txn.type)) return { kind: "stop", id: txn.id };
  return { kind: "other", id: txn.id };
}

export class StripeCashBalanceGateway implements ICashBalanceGateway {
  constructor(private readonly stripeFactory: IStripeClientFactory) {}

  async findSupplyBehind(customerId: string, appliedTransactionId: string): Promise<SupplyLookup> {
    const stripe = this.stripeFactory.require();
    let cursor = appliedTransactionId;
    for (let page = 0; page < CASH_BALANCE_LEDGER_MAX_PAGES; page += 1) {
      const result = await executeWithStripeRetries(() =>
        stripe.customers.listCashBalanceTransactions(customerId, {
          limit: CASH_BALANCE_LEDGER_PAGE,
          starting_after: cursor,
        }),
      );
      const supply = supplyBehindApplication(result.data.map(ledgerEntryOf));
      if (supply) return { supply, windowExceeded: false };
      const last = result.data[result.data.length - 1];
      if (!result.has_more || !last) return { supply: null, windowExceeded: false };
      cursor = last.id;
    }
    return { supply: null, windowExceeded: true };
  }

  async describePayment(paymentIntentId: string): Promise<PaymentTransferDetails> {
    const stripe = this.stripeFactory.require();
    const intent: Stripe.PaymentIntent = await executeWithStripeRetries(() =>
      stripe.paymentIntents.retrieve(paymentIntentId),
    );
    return transferDetailsOf(intent);
  }
}
