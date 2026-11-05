import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";

/** Who is told about an invoice: its payment-due notice and every reminder. */
export interface IInvoiceRecipients {
  forInvoice(input: { buyerLegalEntityId: string | null; winnerUserId: string }): Promise<string[]>;
}

/**
 * The winner and everyone who can pay for the account (its owners, admins and finance members).
 * An organisation's buyer agent wins a lot but cannot pay it, so the people who can are told too.
 * For a personal account this is just the buyer. The billing email gets its own copy at delivery.
 */
export class InvoiceRecipients implements IInvoiceRecipients {
  constructor(
    private readonly payers: Pick<
      ILegalEntityNotificationRecipientReader,
      "listUserIdsForAudience"
    >,
  ) {}

  async forInvoice(input: {
    buyerLegalEntityId: string | null;
    winnerUserId: string;
  }): Promise<string[]> {
    const payers = input.buyerLegalEntityId
      ? await this.payers.listUserIdsForAudience(input.buyerLegalEntityId, "finance")
      : [];
    return [...new Set([input.winnerUserId, ...payers])];
  }
}

/** The notice key for one recipient. The winner keeps the key the notice always had. */
export function paymentDueNoticeKey(paymentId: string, recipientId: string, winnerUserId: string) {
  return recipientId === winnerUserId
    ? `payment_due:${paymentId}`
    : `payment_due:${paymentId}:${recipientId}`;
}
