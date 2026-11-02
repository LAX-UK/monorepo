import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import {
  ASYNC_PAYMENT_FAILED_REASON,
  type PaymentCancelledPayload,
} from "./notification-fanout-helpers.js";

/**
 * Tells the buyer their bank did not complete a delayed payment and links to checkout to try
 * again. Other cancellations (the buyer's own, or an expired checkout) are not announced.
 */
export async function fanoutPaymentFailed(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: PaymentCancelledPayload;
  /** Bid's web origin; the email links to checkout there. */
  webOrigin: string | undefined;
}) {
  const { payload, notificationFanoutReader, webOrigin } = options;
  if (payload?.reason !== ASYNC_PAYMENT_FAILED_REASON) return;
  if (!payload.buyerUserId || !payload.lotId || !webOrigin) return;
  const [buyer, lotTitle] = await Promise.all([
    notificationFanoutReader.getUserForProxyNotice(payload.buyerUserId),
    notificationFanoutReader.getLotTitle(payload.lotId),
  ]);
  if (!buyer?.email) return;
  await options.emailService.enqueue({
    template: "payment-failed-notice",
    to: buyer.email,
    userId: payload.buyerUserId,
    vars: {
      userName: buyer.firstName ?? buyer.name,
      lotTitle: lotTitle ?? "your lot",
      payUrl: new URL(
        `/purchases/checkout/${encodeURIComponent(payload.lotId)}`,
        webOrigin,
      ).toString(),
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `payment-failed-notice:${options.eventId}:${payload.buyerUserId}`,
  });
}
