import { attributeGroupRefunds } from "@auction/domain";
import type { IPaymentReadRepository } from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { IBuyerRefundsReader } from "../organisation-buying/purchase-invoice-pdf.service.js";
import type { IPaymentGroupGateway } from "../payment-group/payment-group-ports.js";

/**
 * What the buyer was given back, read from the refunds on the Stripe charge that took their money
 * (the payment provider is where a refund is made, whoever made it). A payment settled through a
 * "Pay several" charge counts only the refunds that name it; refunds naming no invoice are never
 * spread. A payment with no Stripe charge (marked paid by staff) has nothing to read.
 */
export class StripeBuyerRefundsReader implements IBuyerRefundsReader {
  constructor(
    private readonly payments: Pick<IPaymentReadRepository, "findById">,
    private readonly gateway: Pick<IPaymentGroupGateway, "isConfigured" | "listChargeRefunds">,
  ) {}

  async refundedPence(paymentId: string): Promise<number> {
    const payment = await this.payments.findById(paymentId);
    if (!payment?.stripeChargeId || !this.gateway.isConfigured()) return 0;
    const refunds = await this.gateway.listChargeRefunds(payment.stripeChargeId);
    if (!payment.paymentGroupId) {
      return refunds.reduce((total, refund) => total + refund.amountPence, 0);
    }
    const { refundedPenceByPayment } = attributeGroupRefunds(
      [{ paymentId, amountPence: gbpAmountToPence(payment.amount) }],
      refunds,
    );
    return refundedPenceByPayment.get(paymentId) ?? 0;
  }
}
