import type Stripe from "stripe";
import {
  type ICashBalanceGateway,
  StripeCashBalanceGateway,
} from "../services/stripe/cash-balance-gateway.js";

/**
 * Models the Stripe objects the cash-balance check reads, with their real field names, in the
 * order the real ledger lists them (newest first, paged with `starting_after`):
 * `funded` entries carry `funded.bank_transfer.reference`; `applied_to_payment` and
 * `unapplied_from_payment` entries name the payment intent; an intent shows its own reference in
 * `next_action.display_bank_transfer_instructions.reference` until it completes.
 * Entries are added in the order things happen, and may share one `created` second.
 */
export class FakeCashBalanceStripe {
  /** Newest first. */
  readonly ledger: Stripe.CustomerCashBalanceTransaction[] = [];
  private readonly intents = new Map<string, Stripe.PaymentIntent>();
  listCalls = 0;
  retrieveCalls = 0;
  private seq = 0;

  private add(
    customer: string,
    created: number,
    fields: Record<string, unknown>,
    id?: string,
  ): Stripe.CustomerCashBalanceTransaction {
    this.seq += 1;
    const txn = {
      id: id ?? `ccsbtxn_${this.seq}`,
      object: "customer_cash_balance_transaction",
      customer,
      created,
      currency: "gbp",
      ending_balance: 0,
      livemode: false,
      net_amount: 0,
      ...fields,
    } as unknown as Stripe.CustomerCashBalanceTransaction;
    this.ledger.unshift(txn);
    return txn;
  }

  fund(opts: { id?: string; customer: string; reference: string | null; created: number }) {
    return this.add(
      opts.customer,
      opts.created,
      {
        type: "funded",
        net_amount: 5_000,
        funded: { bank_transfer: { type: "gb_bank_transfer", reference: opts.reference } },
      },
      opts.id,
    );
  }

  unapply(opts: { customer: string; intentId: string; created: number; amountCents?: number }) {
    return this.add(opts.customer, opts.created, {
      type: "unapplied_from_payment",
      net_amount: opts.amountCents ?? 5_000,
      unapplied_from_payment: { payment_intent: opts.intentId },
    });
  }

  /** Money applied to an intent: the ledger entry, which is also the event's object. */
  apply(opts: {
    id?: string;
    customer: string;
    intentId: string;
    amountCents?: number;
    created: number;
  }) {
    return this.add(
      opts.customer,
      opts.created,
      {
        type: "applied_to_payment",
        net_amount: -(opts.amountCents ?? 5_000),
        applied_to_payment: { payment_intent: opts.intentId },
      },
      opts.id,
    );
  }

  addIntent(opts: {
    id: string;
    customer?: string;
    paymentId?: string;
    paymentGroupId?: string;
    privateSaleDealId?: string;
    privateSaleDealPaymentId?: string;
    ownReference: string | null;
  }) {
    this.intents.set(opts.id, {
      id: opts.id,
      object: "payment_intent",
      customer: opts.customer ?? null,
      metadata: {
        ...(opts.paymentId ? { paymentId: opts.paymentId } : {}),
        ...(opts.paymentGroupId ? { paymentGroupId: opts.paymentGroupId } : {}),
        ...(opts.privateSaleDealId ? { privateSaleDealId: opts.privateSaleDealId } : {}),
        ...(opts.privateSaleDealPaymentId
          ? { privateSaleDealPaymentId: opts.privateSaleDealPaymentId }
          : {}),
      },
      next_action: opts.ownReference
        ? {
            type: "display_bank_transfer_instructions",
            display_bank_transfer_instructions: { reference: opts.ownReference },
          }
        : null,
    } as unknown as Stripe.PaymentIntent);
  }

  /** The real gateway over this fake client, so the field mapping and paging are under test. */
  gateway(): ICashBalanceGateway {
    const client = {
      customers: {
        listCashBalanceTransactions: async (
          _customer: string,
          params: { limit: number; starting_after?: string },
        ) => {
          this.listCalls += 1;
          const from = params.starting_after
            ? this.ledger.findIndex((t) => t.id === params.starting_after) + 1
            : 0;
          const data = this.ledger.slice(from, from + params.limit);
          return { data, has_more: from + params.limit < this.ledger.length };
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
