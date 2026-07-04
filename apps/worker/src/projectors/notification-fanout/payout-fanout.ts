import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import {
  type SellerMoneyPayload,
  centsToAmount,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutInitiated(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: SellerMoneyPayload;
}) {
  const legalEntityId = options.payload.legalEntityId;
  if (!legalEntityId) return;
  const name = await options.notificationFanoutReader.getEntityDisplayName(legalEntityId);
  const recipients = await options.notificationFanoutReader.listEntityRecipients(legalEntityId);
  for (const recipient of recipients) {
    await options.emailService.enqueue({
      template: "payout-initiated-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName: name,
        payoutId: options.payoutId,
        amount: centsToAmount(options.payload.amountCents),
        currency: options.payload.currency,
        adminPayoutsUrl: options.adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-initiated-notice:${options.eventId}:${recipient.userId}`,
    });
  }
}
