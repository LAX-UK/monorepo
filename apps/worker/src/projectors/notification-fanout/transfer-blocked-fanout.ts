import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import {
  type TransferBlockedPayload,
  formatReason,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutTransferBlocked(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: TransferBlockedPayload;
}): Promise<void> {
  const { notificationFanoutReader, emailService, supportContactEmail, adminPayoutsUrl, eventId, payoutId, payload } =
    options;
  if (!payload?.legalEntityId) return;

  const entityName = await notificationFanoutReader.getEntityDisplayName(payload.legalEntityId);
  const payoutRow = await notificationFanoutReader.getPayoutAmounts(payoutId);
  const payoutAmount = payoutRow?.netAmount ?? "0.00";
  const payoutCurrency = payoutRow?.currency ?? "GBP";

  const recipients = await notificationFanoutReader.listEntityRecipients(payload.legalEntityId);

  for (const recipient of recipients) {
    await emailService.enqueue({
      template: "payout-transfer-blocked-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName,
        payoutId,
        payoutAmount,
        payoutCurrency,
        blockReason: formatReason(payload.reason),
        supportContactEmail,
        adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-transfer-blocked-notice:${eventId}:${recipient.userId}`,
    });
  }
}
