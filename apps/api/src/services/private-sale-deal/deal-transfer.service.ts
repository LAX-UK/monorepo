import { dealPaymentBlockers, dealPaymentDueMinor } from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealReader,
} from "@auction/persistence/interfaces";
import type { IDealCheckoutGateway } from "./deal-payment-ports.js";
import type {
  DealPaymentSettlementService,
  RecordTransferResult,
} from "./deal-payment-settlement.service.js";

export type DealTransferDeps = {
  deals: Pick<IPrivateSaleDealReader, "findById">;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  checkout: Pick<IDealCheckoutGateway, "expireCheckout">;
  settlement: Pick<DealPaymentSettlementService, "recordTransferReceived">;
};

/**
 * Finance's record that a bank transfer for a deal has landed. A checkout the buyer left open is
 * ended first, but only once the deal is waiting for exactly this amount, so a wrong figure never
 * costs the buyer their checkout. Whether the deal then moves to paid is decided in one
 * transaction by the settlement.
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
      for (const open of payments.filter((p) => p.status === "open")) {
        if (open.stripeCheckoutSessionId) {
          await this.deps.checkout.expireCheckout(open.stripeCheckoutSessionId);
        }
      }
    }
    return this.deps.settlement.recordTransferReceived(input);
  }
}
