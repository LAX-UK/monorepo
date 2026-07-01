import type { IEmailService } from "@auction/email";
import {
  type Db,
  type SellerMoneyPayload,
  centsToAmount,
  entityName,
  listEntityRecipients,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutInitiated(options: {
  db: Db;
  emailService: IEmailService;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: SellerMoneyPayload;
}) {
  const legalEntityId = options.payload.legalEntityId;
  if (!legalEntityId) return;
  const name = await entityName(options.db, legalEntityId);
  const recipients = await listEntityRecipients(options.db, legalEntityId);
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
