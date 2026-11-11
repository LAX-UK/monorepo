import type Stripe from "stripe";
import type { ICashBalanceGateway } from "../services/stripe/cash-balance-gateway.js";
import { StripeCashBalanceGateway } from "../services/stripe/cash-balance-gateway.js";

/**
 * Models the Stripe objects the cash-balance check reads, with their real field names:
 * `funded` entries carry `funded.bank_transfer.reference`; `applied_to_payment` entries name the
 * payment intent and carry a negative `net_amount`; an intent shows its own reference in
 * `next_action.display_bank_transfer_instructions.reference` until it completes.
 */
export class FakeCashBalanceStripe {
  readonly ledger: Stripe.CustomerCashBalanceTransaction[] = [];
  private readonly intents = new Map<string, Stripe.PaymentIntent>();
  listCalls = 0;
  retrieveCalls = 0;

  fund(opts: { id: string; customer: string; reference: string | null; created: number }) {
    this.ledger.unshift({
      id: opts.id,
      object: "customer_cash_balance_transaction",
      type: "funded",
      customer: opts.customer,
      created: opts.created,
      currency: "gbp",
      net_amount: 5_000,
      ending_balance: 5_000,
      livemode: false,
      funded: {
        bank_transfer: { type: "gb_bank_transfer", reference: opts.reference },
      },
    } as unknown as Stripe.CustomerCashBalanceTransaction);
  }

  addIntent(opts: {
    id: string;
    paymentId?: string;
    paymentGroupId?: string;
    ownReference: string | null;
  }) {
    this.intents.set(opts.id, {
      id: opts.id,
      object: "payment_intent",
      metadata: {
        ...(opts.paymentId ? { paymentId: opts.paymentId } : {}),
        ...(opts.paymentGroupId ? { paymentGroupId: opts.paymentGroupId } : {}),
      },
      next_action: opts.ownReference
        ? {
            type: "display_bank_transfer_instructions",
            display_bank_transfer_instructions: { reference: opts.ownReference },
          }
        : null,
    } as unknown as Stripe.PaymentIntent);
  }

  /** The `customer_cash_balance_transaction.created` object for money applied to an intent. */
  applied(opts: {
    id: string;
    customer: string;
    intentId: string;
    amountCents: number;
    created: number;
  }): Stripe.CustomerCashBalanceTransaction {
    return {
      id: opts.id,
      object: "customer_cash_balance_transaction",
      type: "applied_to_payment",
      customer: opts.customer,
      created: opts.created,
      currency: "gbp",
      net_amount: -opts.amountCents,
      ending_balance: 0,
      livemode: false,
      applied_to_payment: { payment_intent: opts.intentId },
    } as unknown as Stripe.CustomerCashBalanceTransaction;
  }

  /** The real gateway over this fake client, so the field mapping itself is under test. */
  gateway(): ICashBalanceGateway {
    const client = {
      customers: {
        listCashBalanceTransactions: async () => {
          this.listCalls += 1;
          return { data: this.ledger };
        },
      },
      paymentIntents: {
        retrieve: async (id: string) => {
          this.retrieveCalls += 1;
          const intent = this.intents.get(id);
          if (!intent) throw new Error(`No such payment intent: ${id}`);
          return intent;
        },
      },
    };
    return new StripeCashBalanceGateway({
      get: () => client as unknown as Stripe,
      require: () => client as unknown as Stripe,
    });
  }
}
