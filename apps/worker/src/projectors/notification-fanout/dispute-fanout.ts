import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import { type SellerMoneyPayload, centsToAmount } from "./notification-fanout-helpers.js";

export async function fanoutDisputeOpened(options: {
  notificationFanoutReader: INotificationFanoutReader;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  emailService: IEmailService;
  supportContactEmail: string;
  adminEmailAddress?: string | undefined;
  eventId: number;
  payload: SellerMoneyPayload;
}) {
  const sellerId = options.payload.sellerLegalEntityId;
  if (!sellerId) return;
  const name = await options.notificationFanoutReader.getEntityDisplayName(sellerId);
  const amount = centsToAmount(options.payload.amountCents);
  const recipients = await options.notificationFanoutReader.listEntityRecipients(sellerId);
  for (const recipient of recipients) {
    await options.emailService.enqueue({
      template: "dispute-opened-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName: name,
        amount,
        currency: options.payload.currency,
        reason: options.payload.reason ?? null,
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `dispute-opened-notice:${options.eventId}:${recipient.userId}`,
    });
  }
  const staffOps = await options.staffOpsRecipientReader.listRecipients();
  if (staffOps.length > 0) {
    for (const s of staffOps) {
      await options.emailService.enqueue({
        template: "dispute-opened-notice",
        to: s.email,
        userId: s.id,
        vars: {
          recipientFirstName: s.firstName ?? "Team",
          entityName: name,
          amount,
          currency: options.payload.currency,
          reason: options.payload.reason ?? null,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `dispute-opened-notice:${options.eventId}:ops:${s.id}`,
      });
    }
  } else if (options.adminEmailAddress) {
    await options.emailService.enqueue({
      template: "dispute-opened-notice",
      to: options.adminEmailAddress,
      recipientResolution: "snapshot",
      vars: {
        recipientFirstName: "Ops Team",
        entityName: name,
        amount,
        currency: options.payload.currency,
        reason: options.payload.reason ?? null,
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `dispute-opened-notice:${options.eventId}:admin`,
    });
  }
}

export async function fanoutDisputeClosed(options: {
  notificationFanoutReader: INotificationFanoutReader;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: SellerMoneyPayload;
}) {
  const sellerId = options.payload.sellerLegalEntityId;
  if (!sellerId) return;
  const name = await options.notificationFanoutReader.getEntityDisplayName(sellerId);
  const recipients = await options.notificationFanoutReader.listEntityRecipients(sellerId);
  for (const recipient of recipients) {
    await options.emailService.enqueue({
      template: "dispute-closed-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName: name,
        amount: centsToAmount(options.payload.amountCents),
        currency: options.payload.currency,
        outcome: options.payload.outcome ?? "closed",
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `dispute-closed-notice:${options.eventId}:${recipient.userId}`,
    });
  }
}
