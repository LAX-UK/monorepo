import type { IEmailService } from "@auction/email";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import type { ManualReviewPayload } from "./notification-fanout-helpers.js";

export async function fanoutPaymentManualReview(options: {
  notificationFanoutReader: INotificationFanoutReader;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  emailService: IEmailService;
  supportContactEmail: string;
  adminEmailAddress?: string | undefined;
  webOrigin?: string | undefined;
  eventId: number;
  paymentId: string;
  payload: ManualReviewPayload;
}): Promise<void> {
  const {
    notificationFanoutReader,
    staffOpsRecipientReader,
    emailService,
    supportContactEmail,
    adminEmailAddress,
    webOrigin,
    eventId,
    paymentId,
    payload,
  } = options;
  if (!payload?.buyerUserId || !payload?.lotId || !payload?.sellerLegalEntityId) return;

  const context = await notificationFanoutReader.getManualReviewContext(
    payload.lotId,
    payload.buyerUserId,
    payload.sellerLegalEntityId,
  );

  if (context.buyerEmail) {
    await emailService.enqueue({
      template: "payment-manual-review-buyer-notice",
      to: context.buyerEmail,
      userId: payload.buyerUserId,
      vars: {
        userName: context.buyerName,
        lotTitle: context.lotTitle,
        lotReference: context.lotReference,
        supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `payment-manual-review-buyer-notice:${eventId}:${payload.buyerUserId}`,
    });
  }

  const staffOps = await staffOpsRecipientReader.listRecipients();
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  if (staffOps.length > 0) {
    for (const s of staffOps) {
      await emailService.enqueue({
        template: "payment-manual-review-admin-notice",
        to: s.email,
        userId: s.id,
        vars: {
          paymentId,
          lotTitle: context.lotTitle,
          lotReference: context.lotReference,
          sellerEntityName: context.sellerEntityName,
          amount: payload.amount,
          currency: payload.currency,
          adminReviewUrl: `${base}/admin/payments?manualReview=1`,
        },
        category: "transactional",
        idempotencyKey: `payment-manual-review-admin-notice:${eventId}:ops:${s.id}`,
      });
    }
  } else if (adminEmailAddress) {
    await emailService.enqueue({
      template: "payment-manual-review-admin-notice",
      to: adminEmailAddress,
      recipientResolution: "snapshot",
      vars: {
        paymentId,
        lotTitle: context.lotTitle,
        lotReference: context.lotReference,
        sellerEntityName: context.sellerEntityName,
        amount: payload.amount,
        currency: payload.currency,
        adminReviewUrl: `${base}/admin/payments?manualReview=1`,
      },
      category: "transactional",
      idempotencyKey: `payment-manual-review-admin-notice:${eventId}:admin`,
    });
  }
}
