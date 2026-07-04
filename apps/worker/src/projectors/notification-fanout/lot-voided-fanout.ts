import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import { type LotVoidedPayload } from "./notification-fanout-helpers.js";

export async function fanoutLotVoided(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  lotId: string;
  payload: LotVoidedPayload;
}) {
  const lotId = options.payload.lotId ?? options.lotId;
  const lotRow = await options.notificationFanoutReader.getLotForVoided(lotId);
  if (!lotRow) return;
  const lotTitle = lotRow.title;
  if (lotRow.sellerLegalEntityId) {
    const recipients = await options.notificationFanoutReader.listEntityRecipients(
      lotRow.sellerLegalEntityId,
    );
    for (const recipient of recipients) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: recipient.email,
        userId: recipient.userId,
        vars: {
          recipientFirstName: recipient.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:seller:${recipient.userId}`,
      });
    }
  }
  if (lotRow.winnerId) {
    const winner = await options.notificationFanoutReader.getWinnerContact(lotRow.winnerId);
    if (winner?.email) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: winner.email,
        userId: lotRow.winnerId,
        vars: {
          recipientFirstName: winner.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:winner:${lotRow.winnerId}`,
      });
    }
  }
}
