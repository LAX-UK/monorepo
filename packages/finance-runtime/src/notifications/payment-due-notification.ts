import { formatMoneyMajor } from "@auction/email";
import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

export type PaymentDueNotificationInput = {
  paymentId: string;
  amount: string;
  checkoutUrl: string | null;
  dueDate?: string;
};

/**
 * The "payment due" notice for a newly raised invoice. One builder for the API and the worker, so
 * the invoice email carries the same invoice number and lot title whichever process raised it.
 */
export function paymentDueNotification(
  lot: Lot,
  buyerId: string,
  input: PaymentDueNotificationInput,
): CreateNotificationRow {
  const dueSuffix = input.dueDate ? ` Payment due by ${input.dueDate}.` : "";
  return {
    userId: buyerId,
    type: "payment_due",
    title: `Payment due — ${lot.title}`,
    message: `Complete payment of ${formatMoneyMajor(input.amount) ?? input.amount} for this lot.${dueSuffix}`,
    lotId: lot.id,
    legalEntityId: lot.buyerLegalEntityId ?? null,
    meta: {
      paymentId: input.paymentId,
      amount: input.amount,
      invoiceUrl: input.checkoutUrl,
      invoiceNumber: `PAY-${input.paymentId.slice(0, 8).toUpperCase()}`,
      lotTitle: lot.title,
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    },
  };
}
