import type { StillToSend } from "@auction/domain";
import type { IPaymentGroupFactsReader } from "@auction/persistence/interfaces";
import { stillToSendOfPayments } from "../../lib/still-to-send.js";

/** An invoice's deciding payment, as a list of invoices shows it. */
export type InvoicePayment = {
  id: string;
  lotId: string;
  status: string;
  /** The invoice total, a decimal string in pounds. */
  amount: string;
};

/** What a part-funded bank transfer still has to send, for the invoices a screen lists. */
export interface IStillToSendService {
  /**
   * The share each listed invoice still has to send, by lot. A transfer's remainder is shared
   * across the whole group, so a lot's share is the same whichever invoices are listed with it.
   */
  forPayments(payments: readonly InvoicePayment[]): Promise<Map<string, StillToSend>>;
}

export class StillToSendService implements IStillToSendService {
  constructor(private readonly groups: IPaymentGroupFactsReader) {}

  async forPayments(payments: readonly InvoicePayment[]): Promise<Map<string, StillToSend>> {
    // Only a payment that is on its way (`authorized`) can sit inside a transfer that is under way.
    const onItsWay = payments.filter((payment) => payment.status === "authorized");
    const groups = await this.groups.processingForPayments(onItsWay.map((payment) => payment.id));
    return stillToSendOfPayments(
      onItsWay.map((payment) => ({ lotId: payment.lotId, group: groups.get(payment.id) ?? null })),
    );
  }
}
