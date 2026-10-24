import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { LotWithdrawalDeclinedPayload } from "./notification-fanout-helpers.js";

/** Tells the seller organisation why staff kept a lot they asked to withdraw. */
export async function fanoutLotWithdrawalDeclined(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  lotId: string;
  payload: LotWithdrawalDeclinedPayload;
}) {
  const lotTitle = await options.notificationFanoutReader.getLotTitle(options.lotId);
  if (!lotTitle) return;
  const recipients = await options.notificationFanoutReader.listEntityRecipients(
    options.payload.sellerLegalEntityId,
  );
  for (const recipient of recipients) {
    await options.emailService.enqueue({
      template: "lot-withdrawal-declined-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        lotTitle,
        reason: options.payload.reason,
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `lot-withdrawal-declined-notice:${options.eventId}:seller:${recipient.userId}`,
    });
  }
}
