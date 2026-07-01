import type { IEmailService } from "@auction/email";
import { listStaffOpsRecipients } from "../../lib/staff-ops-email-recipients.js";
import {
  type Db,
  type SellerMoneyPayload,
  entityName,
  listEntityRecipients,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutClawbackRequired(options: {
  db: Db;
  emailService: IEmailService;
  adminPayoutsUrl: string;
  adminEmailAddress?: string | undefined;
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
      template: "payout-clawback-required-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName: name,
        payoutId: options.payoutId,
        netAmount: options.payload.netAmount ?? "0.00",
        currency: options.payload.currency,
        adminPayoutsUrl: options.adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-clawback-required-notice:${options.eventId}:${recipient.userId}`,
    });
  }
  const staffOps = await listStaffOpsRecipients(options.db);
  if (staffOps.length > 0) {
    for (const s of staffOps) {
      await options.emailService.enqueue({
        template: "payout-clawback-required-notice",
        to: s.email,
        userId: s.id,
        vars: {
          recipientFirstName: s.firstName ?? "Team",
          entityName: name,
          payoutId: options.payoutId,
          netAmount: options.payload.netAmount ?? "0.00",
          currency: options.payload.currency,
          adminPayoutsUrl: options.adminPayoutsUrl,
        },
        category: "transactional",
        idempotencyKey: `payout-clawback-required-notice:${options.eventId}:ops:${s.id}`,
      });
    }
  } else if (options.adminEmailAddress) {
    await options.emailService.enqueue({
      template: "payout-clawback-required-notice",
      to: options.adminEmailAddress,
      recipientResolution: "snapshot",
      vars: {
        recipientFirstName: "Ops Team",
        entityName: name,
        payoutId: options.payoutId,
        netAmount: options.payload.netAmount ?? "0.00",
        currency: options.payload.currency,
        adminPayoutsUrl: options.adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-clawback-required-notice:${options.eventId}:admin`,
    });
  }
}
