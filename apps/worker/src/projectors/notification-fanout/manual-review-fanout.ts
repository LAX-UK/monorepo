import { legalEntity, lot, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { eq } from "drizzle-orm";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import type { Db, ManualReviewPayload } from "./notification-fanout-helpers.js";

export async function fanoutPaymentManualReview(options: {
  db: Db;
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
    db,
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

  const [lotRow] = await db
    .select({ title: lot.title, lotNumber: lot.lotNumber })
    .from(lot)
    .where(eq(lot.id, payload.lotId))
    .limit(1);
  const [buyerRow] = await db
    .select({ email: user.email, name: user.name, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, payload.buyerUserId))
    .limit(1);
  const [sellerRow] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, payload.sellerLegalEntityId))
    .limit(1);

  const lotTitle = lotRow?.title ?? "Unknown Lot";
  const lotReference = lotRow?.lotNumber == null ? null : String(lotRow.lotNumber);
  const sellerEntityName = sellerRow?.displayName ?? "Unknown Organisation";

  if (buyerRow?.email) {
    await emailService.enqueue({
      template: "payment-manual-review-buyer-notice",
      to: buyerRow.email,
      userId: payload.buyerUserId,
      vars: {
        userName: buyerRow.firstName ?? buyerRow.name,
        lotTitle,
        lotReference,
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
          lotTitle,
          lotReference,
          sellerEntityName,
          amount: payload.amount,
          currency: payload.currency,
          adminReviewUrl: `${base}/admin/payments/manual-review`,
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
        lotTitle,
        lotReference,
        sellerEntityName,
        amount: payload.amount,
        currency: payload.currency,
        adminReviewUrl: `${base}/admin/payments/manual-review`,
      },
      category: "transactional",
      idempotencyKey: `payment-manual-review-admin-notice:${eventId}:admin`,
    });
  }
}
