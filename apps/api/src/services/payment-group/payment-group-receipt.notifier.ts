import type { PaymentGroupMember, PaymentGroupRecord } from "@auction/persistence/interfaces";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { IPaymentGroupReceipt } from "./payment-group-settlement.service.js";

/**
 * The one receipt for a payment that settled several invoices: sent to the member who paid, as a
 * "payment received" notice listing each invoice, the total and how it was paid. The invoices'
 * own per-invoice receipts are not sent for a group, so the payer gets this one only.
 */
export class PaymentGroupReceiptNotifier implements IPaymentGroupReceipt {
  constructor(private readonly dispatcher: Pick<NotificationDispatcher, "dispatch"> | null) {}

  async send(group: PaymentGroupRecord, members: readonly PaymentGroupMember[]): Promise<void> {
    if (!this.dispatcher || !group.createdByUserId) return;
    const count = members.length;
    await this.dispatcher.dispatch(
      group.createdByUserId,
      notificationRowToPayload({
        userId: group.createdByUserId,
        type: "payment_received",
        title: "Payment received",
        message: `Your payment for ${count} invoices was recorded.`,
        legalEntityId: group.buyerLegalEntityId,
        meta: {
          audience: "buyer",
          amount: group.totalAmount,
          currency: group.currency,
          lotTitle: `${count} invoices`,
          paymentMethod: group.checkoutRail === "card" ? "card" : "bank_transfer",
          receiptLines: members.map((m) => ({
            lotTitle: m.lotTitle,
            lotNumber: m.lotNumber,
            amount: m.amount,
          })),
          emailIdempotencyKey: `payment_group_receipt:${group.id}`,
        },
      }),
    );
  }
}
