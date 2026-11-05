import type { PaymentEligibility } from "@auction/domain";
import type { IPaymentProviderCloser } from "./provider-money-state.js";
import type { IStalePaymentStore } from "./stale-payment-expiry.js";

/** The account rule both ways of paying use (closed, held or payable). */
export interface IHeldEligibility {
  check(input: { payerUserId: string; buyerLegalEntityId: string }): Promise<PaymentEligibility>;
}

/** Closes what a held invoice still has open in Stripe. */
export interface IHeldInvoiceCheckouts {
  close(paymentId: string): Promise<void>;
  sweep(limit?: number): Promise<{ checked: number; closed: number }>;
}

export type HeldInvoiceCheckoutsDeps = {
  payments: Pick<IStalePaymentStore, "findForExpiry" | "checkoutSessionIds">;
  provider: IPaymentProviderCloser;
  eligibility: IHeldEligibility;
  listUnpaidWithCheckout: (
    limit: number,
  ) => Promise<{ id: string; payerUserId: string; buyerLegalEntityId: string }[]>;
};

/**
 * A held invoice (its account cannot pay yet) must not stay payable through a checkout opened
 * before the hold: its open Checkout sessions are closed and unfunded intents cancelled. A bank
 * transfer that has already received money is left alone; money that still arrives for a held
 * invoice goes to manual review, never straight to capture.
 */
export class HeldInvoiceCheckouts implements IHeldInvoiceCheckouts {
  constructor(private readonly deps: HeldInvoiceCheckoutsDeps) {}

  /** Closes what Stripe holds open for one invoice. */
  async close(paymentId: string): Promise<void> {
    const current = await this.deps.payments.findForExpiry(paymentId);
    if (!current) return;
    await this.deps.provider.closeAndRead({
      paymentId,
      paymentIntentId: current.stripePaymentIntentId,
      checkoutSessionIds: await this.deps.payments.checkoutSessionIds(paymentId),
    });
  }

  /**
   * Closes the checkouts of every held invoice that still has one. Safe to run at any time and
   * as often as needed (closing a closed session does nothing); run at deploy and with expiry.
   */
  async sweep(limit = 500): Promise<{ checked: number; closed: number }> {
    const candidates = await this.deps.listUnpaidWithCheckout(limit);
    let closed = 0;
    for (const invoice of candidates) {
      const eligibility = await this.deps.eligibility.check({
        payerUserId: invoice.payerUserId,
        buyerLegalEntityId: invoice.buyerLegalEntityId,
      });
      if (eligibility.kind !== "held") continue;
      await this.close(invoice.id);
      closed += 1;
    }
    return { checked: candidates.length, closed };
  }
}
