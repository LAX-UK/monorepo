import { dealPaymentBlockers, dealPaymentDueMinor } from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealReader,
} from "@auction/persistence/interfaces";
import { START_GRACE_MS } from "../payment-group/open-group-checkouts.js";
import type { IDealCheckoutGateway } from "./deal-payment-ports.js";
import type {
  DealPaymentSettlementService,
  RecordTransferResult,
} from "./deal-payment-settlement.service.js";

export type DealTransferDeps = {
  deals: Pick<IPrivateSaleDealReader, "findById">;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  checkout: Pick<IDealCheckoutGateway, "expireCheckout" | "checkoutStatus">;
  settlement: Pick<DealPaymentSettlementService, "recordTransferReceived">;
  now?: () => Date;
};

type Ended = "ended" | "checkout_completed" | "checkout_not_ended";

/**
 * Finance's record that a bank transfer for a deal has landed. A checkout the buyer left open is
 * ended first, but only once the deal is waiting for exactly this amount, so a wrong figure never
 * costs the buyer their checkout, and only if the provider confirms it ended: a checkout the
 * buyer has finished may still bring money in, so nothing is recorded over it. Whether the deal
 * then moves to paid is decided in one transaction by the settlement.
 */
export class DealTransferService {
  constructor(private readonly deps: DealTransferDeps) {}

  async record(input: {
    dealId: string;
    recordedByUserId: string;
    bankReference: string;
    amountMinor: number;
  }): Promise<RecordTransferResult> {
    const deal = await this.deps.deals.findById(input.dealId);
    if (
      deal &&
      dealPaymentBlockers(deal).length === 0 &&
      dealPaymentDueMinor(deal) === input.amountMinor
    ) {
      const payments = await this.deps.payments.listForDeal(deal.id);
      const now = (this.deps.now ?? (() => new Date()))().getTime();
      for (const open of payments.filter((p) => p.status === "open")) {
        if (!open.stripeCheckoutSessionId) {
          // The buyer's checkout is still being started: its session is not recorded yet, so it
          // could be paid a moment from now. Only one that has stayed unstarted past the grace
          // is a payment nobody is paying.
          if (now - open.createdAt.getTime() < START_GRACE_MS) {
            return { ok: false, error: "checkout_not_ended" };
          }
          continue;
        }
        const ended = await this.end(open.stripeCheckoutSessionId);
        if (ended !== "ended") return { ok: false, error: ended };
      }
    }
    return this.deps.settlement.recordTransferReceived(input);
  }

  /**
   * Ends the checkout and reads it back from the provider. Only one shown as expired may be
   * replaced; one that cannot be confirmed ended could yet be paid.
   */
  private async end(sessionId: string): Promise<Ended> {
    try {
      await this.deps.checkout.expireCheckout(sessionId);
      const status = await this.deps.checkout.checkoutStatus(sessionId);
      if (status === "complete") return "checkout_completed";
      return status === "expired" ? "ended" : "checkout_not_ended";
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "private_sale_checkout_end_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return "checkout_not_ended";
    }
  }
}
