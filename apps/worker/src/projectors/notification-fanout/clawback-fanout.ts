import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import {
  type SellerMoneyPayload,
  listStaffAlertTargets,
  sellerPayoutsUrlFor,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutClawbackRequired(options: {
  notificationFanoutReader: INotificationFanoutReader;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  emailService: IEmailService;
  adminPayoutsUrl: string;
  adminEmailAddress?: string | undefined;
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
      template: "payout-clawback-required-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        audience: "seller",
        recipientFirstName: recipient.firstName,
        entityName: name,
        payoutId: options.payoutId,
        netAmount: options.payload.netAmount ?? "0.00",
        currency: options.payload.currency,
        payoutsUrl: sellerPayoutsUrlFor(options.adminPayoutsUrl),
      },
      category: "transactional",
      idempotencyKey: `payout-clawback-required-notice:${options.eventId}:${recipient.userId}`,
    });
  }
  const staffTargets = await listStaffAlertTargets(
    options.staffOpsRecipientReader,
    options.adminEmailAddress,
  );
  for (const target of staffTargets) {
    await options.emailService.enqueue({
      template: "payout-clawback-required-notice",
      to: target.to,
      ...(target.userId ? { userId: target.userId } : {}),
      ...(target.snapshot ? { recipientResolution: "snapshot" as const } : {}),
      vars: {
        audience: "staff",
        recipientFirstName: target.firstName,
        entityName: name,
        payoutId: options.payoutId,
        netAmount: options.payload.netAmount ?? "0.00",
        currency: options.payload.currency,
        payoutsUrl: options.adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-clawback-required-notice:${options.eventId}:${target.keySuffix}`,
    });
  }
}
