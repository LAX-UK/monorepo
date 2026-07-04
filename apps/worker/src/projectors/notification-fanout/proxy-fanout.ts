import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { ProxyCancelledPayload } from "./notification-fanout-helpers.js";

export async function fanoutProxyCancelled(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: ProxyCancelledPayload;
}) {
  if (!options.payload?.bidderUserId || !options.payload?.lotId) return;
  const lotTitle =
    (await options.notificationFanoutReader.getLotTitle(options.payload.lotId)) ?? "Unknown Lot";
  const bidder = await options.notificationFanoutReader.getUserForProxyNotice(
    options.payload.bidderUserId,
  );
  if (!bidder?.email) return;
  await options.emailService.enqueue({
    template: "proxy-cancelled-notice",
    to: bidder.email,
    userId: options.payload.bidderUserId,
    vars: {
      userName: bidder.firstName ?? bidder.name,
      lotTitle,
      reason: options.payload.reason,
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `proxy-cancelled-notice:${options.eventId}:${options.payload.bidderUserId}`,
  });
}
