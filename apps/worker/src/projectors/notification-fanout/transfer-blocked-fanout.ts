import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import {
  type TransferBlockedPayload,
  formatReason,
  listStaffAlertTargets,
  sellerPayoutsUrlFor,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutTransferBlocked(options: {
  notificationFanoutReader: INotificationFanoutReader;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  adminEmailAddress?: string | undefined;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: TransferBlockedPayload;
}): Promise<void> {
  const {
    notificationFanoutReader,
    staffOpsRecipientReader,
    adminEmailAddress,
    emailService,
    supportContactEmail,
    adminPayoutsUrl,
    eventId,
    payoutId,
    payload,
  } = options;
  if (!payload?.legalEntityId) return;

  const entityName = await notificationFanoutReader.getEntityDisplayName(payload.legalEntityId);
  const payoutRow = await notificationFanoutReader.getPayoutAmounts(payoutId);
  const payoutAmount = payoutRow?.netAmount ?? "0.00";
  const payoutCurrency = payoutRow?.currency ?? "GBP";

  const recipients = await notificationFanoutReader.listEntityRecipients(payload.legalEntityId);

  const sellerPayoutsUrl = sellerPayoutsUrlFor(adminPayoutsUrl);
  for (const recipient of recipients) {
    await emailService.enqueue({
      template: "payout-transfer-blocked-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        audience: "seller",
        recipientFirstName: recipient.firstName,
        entityName,
        payoutId,
        payoutAmount,
        payoutCurrency,
        blockReason: formatReason(payload.reason),
        supportContactEmail,
        payoutsUrl: sellerPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-transfer-blocked-notice:${eventId}:${recipient.userId}`,
    });
  }

  const staffTargets = await listStaffAlertTargets(staffOpsRecipientReader, adminEmailAddress);
  for (const target of staffTargets) {
    await emailService.enqueue({
      template: "payout-transfer-blocked-notice",
      to: target.to,
      ...(target.userId ? { userId: target.userId } : {}),
      ...(target.snapshot ? { recipientResolution: "snapshot" as const } : {}),
      vars: {
        audience: "staff",
        recipientFirstName: target.firstName,
        entityName,
        payoutId,
        payoutAmount,
        payoutCurrency,
        blockReason: formatReason(payload.reason),
        supportContactEmail,
        payoutsUrl: adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-transfer-blocked-notice:${eventId}:${target.keySuffix}`,
    });
  }
}
