import type {
  CreateNotificationRow,
  DeliveryQuoteRow,
  ILotRepository,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { IDeliveryQuoteNotifier } from "./delivery-quote.service.js";

/**
 * Tells the member who asked for a courier quote what the team decided, in the product and by
 * email: the quote is priced, or the team cannot deliver there. Best effort: a failed notice never
 * undoes the decision. Each notice has its own key, so a retry is not a second email, and a
 * revised price is a new one.
 */
export class DeliveryQuoteNotifier implements IDeliveryQuoteNotifier {
  constructor(
    private readonly lots: Pick<ILotRepository, "findById">,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly factory: Pick<
      INotificationFactory,
      "createDeliveryQuoteReady" | "createDeliveryQuoteDeclined"
    >,
  ) {}

  quoteReady(quote: DeliveryQuoteRow): Promise<void> {
    const amount = quote.amount;
    if (!amount) return Promise.resolve();
    return this.notify(quote, `delivery-quote:${quote.id}:${amount}`, (lot, recipient) =>
      this.factory.createDeliveryQuoteReady(lot, recipient, {
        amount,
        currency: quote.currency,
        legalEntityId: quote.buyerLegalEntityId,
      }),
    );
  }

  quoteDeclined(quote: DeliveryQuoteRow): Promise<void> {
    const reason = quote.declineReason;
    if (!reason) return Promise.resolve();
    // A quote is declined at most once (it ends withdrawn), so its id is the whole key.
    return this.notify(quote, `delivery-quote-declined:${quote.id}`, (lot, recipient) =>
      this.factory.createDeliveryQuoteDeclined(lot, recipient, {
        reason,
        legalEntityId: quote.buyerLegalEntityId,
      }),
    );
  }

  private async notify(
    quote: DeliveryQuoteRow,
    key: string,
    build: (lot: Lot, recipient: string) => CreateNotificationRow,
  ): Promise<void> {
    try {
      const recipient = quote.requestedByUserId;
      if (!recipient) return;
      const lot = await this.lots.findById(quote.lotId);
      if (!lot) return;
      const payload = notificationRowToPayload(build(lot, recipient));
      await this.dispatcher.dispatch(recipient, {
        ...payload,
        meta: { ...payload.meta, outboxIdempotencyKey: key, emailIdempotencyKey: key },
      });
    } catch (err) {
      // Ids only: the error may quote the notice, which carries the buyer's lot and the reason.
      console.error("[DeliveryQuoteNotifier] notice failed", {
        quoteId: quote.id,
        error: err instanceof Error ? err.name : "unknown",
      });
    }
  }
}
