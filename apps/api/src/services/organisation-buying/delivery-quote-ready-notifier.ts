import type { DeliveryQuoteRow, ILotRepository } from "@auction/persistence/interfaces";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { IDeliveryQuoteReadyNotifier } from "./delivery-quote.service.js";

/**
 * Tells the member who asked for a courier quote that it is priced, in the product and by email.
 * One key per quote and price, so a revised price is a new notice and a retry is not.
 */
export class DeliveryQuoteReadyNotifier implements IDeliveryQuoteReadyNotifier {
  constructor(
    private readonly lots: Pick<ILotRepository, "findById">,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly factory: Pick<INotificationFactory, "createDeliveryQuoteReady">,
  ) {}

  async quoteReady(quote: DeliveryQuoteRow): Promise<void> {
    try {
      const recipient = quote.requestedByUserId;
      if (!recipient || !quote.amount) return;
      const lot = await this.lots.findById(quote.lotId);
      if (!lot) return;
      const row = this.factory.createDeliveryQuoteReady(lot, recipient, {
        amount: quote.amount,
        currency: quote.currency,
        legalEntityId: quote.buyerLegalEntityId,
      });
      const key = `delivery-quote:${quote.id}:${quote.amount}`;
      const payload = notificationRowToPayload(row);
      await this.dispatcher.dispatch(recipient, {
        ...payload,
        meta: { ...payload.meta, outboxIdempotencyKey: key, emailIdempotencyKey: key },
      });
    } catch (err) {
      console.error("[DeliveryQuoteReadyNotifier] notice failed", { quoteId: quote.id, err });
    }
  }
}
