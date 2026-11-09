import { minorUnitsToMoneyString } from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealQueryReader,
  IPrivateSaleDealReader,
} from "@auction/persistence/interfaces";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { IDealReceipt } from "./deal-payment-settlement.service.js";

export type DealReceiptDeps = {
  payments: Pick<IPrivateSaleDealPaymentReader, "findById">;
  deals: Pick<IPrivateSaleDealReader, "findById">;
  works: Pick<IPrivateSaleDealQueryReader, "findWorkSummary">;
  dispatcher: Pick<NotificationDispatcher, "dispatch"> | null;
};

/**
 * The buyer's receipt for a deal's payment, sent through the same "payment received" notice as a
 * lot payment. It goes to the member who paid, or to the person acting for the buyer when finance
 * recorded a bank transfer, and carries the amount, the work and how it was paid. One receipt per
 * payment: the email is keyed on the payment, so a repeat is not sent twice.
 */
export class DealReceiptNotifier implements IDealReceipt {
  constructor(private readonly deps: DealReceiptDeps) {}

  async send(input: { paymentId: string }): Promise<void> {
    if (!this.deps.dispatcher) return;
    const payment = await this.deps.payments.findById(input.paymentId);
    if (!payment || payment.status !== "paid") return;
    const deal = await this.deps.deals.findById(payment.dealId);
    if (!deal) return;
    const recipient = payment.createdByUserId ?? deal.buyer?.actingUserId ?? null;
    if (!recipient) return;
    const work = await this.deps.works.findWorkSummary(deal.itemSubmissionId);
    const title = work?.title ?? deal.reference;
    await this.deps.dispatcher.dispatch(
      recipient,
      notificationRowToPayload({
        userId: recipient,
        type: "payment_received",
        title: "Payment received",
        message: `Your payment for "${title}" was recorded.`,
        legalEntityId: payment.buyerLegalEntityId,
        meta: {
          audience: "buyer",
          amount: minorUnitsToMoneyString(BigInt(payment.amountMinor)),
          currency: payment.currency,
          lotTitle: title,
          paymentMethod: payment.rail === "card" ? "card" : "bank_transfer",
          emailIdempotencyKey: `private_sale_receipt:${payment.id}`,
        },
      }),
    );
  }
}
