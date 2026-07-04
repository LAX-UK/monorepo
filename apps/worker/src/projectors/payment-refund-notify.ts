import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const PROJECTOR_NAME = "payment_refund_notify";

type RefundPayload = {
  stripeChargeId?: string;
  amountCents: number;
  currency: string;
  sellerLegalEntityId: string;
  via?: string;
};

export async function processPaymentRefundNotify(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
}): Promise<void> {
  const { ctx, log, emailService, supportContactEmail } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    paymentRefundNotifyReader,
    staffOpsRecipientReader,
    adminEmailAddress,
  } = ctx;

  const cursor = await projectorStateRepo.getCursor(PROJECTOR_NAME);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["payment.refunded"],
    limit: 50,
  });

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    const payload = row.payload as RefundPayload;
    const sellerLegalEntityId = payload.sellerLegalEntityId;
    if (!sellerLegalEntityId) {
      log.warn({ eventId: row.id }, "payment_refund_notify_skipped_missing_seller");
      maxId = row.id;
      continue;
    }

    try {
      const paymentId = row.aggregateId;
      const context = await paymentRefundNotifyReader.getRefundContext(
        paymentId,
        sellerLegalEntityId,
      );

      if (!context) {
        log.warn({ eventId: row.id, paymentId }, "payment_refund_notify_skipped_no_payment");
        maxId = row.id;
        continue;
      }

      const amountCents = payload.amountCents;
      const refundAmount = (amountCents / 100).toFixed(2);
      const refundCurrency = payload.currency?.toUpperCase() ?? "GBP";
      const eventKind = "refund";
      const reason: string | null = null;

      for (const m of context.sellerMembers) {
        await emailService.enqueue({
          template: "payment-refund-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            recipientFirstName: m.firstName,
            entityName: context.entityName,
            lotTitle: context.lotTitle,
            lotReference: context.lotReference,
            refundAmount,
            refundCurrency,
            eventKind,
            reason,
            supportContactEmail,
          },
          category: "transactional",
          idempotencyKey: `payment-refund-notice:${row.id}:${m.userId}`,
        });
      }

      const staffOps = await staffOpsRecipientReader.listRecipients();
      if (staffOps.length > 0) {
        for (const s of staffOps) {
          await emailService.enqueue({
            template: "payment-refund-notice",
            to: s.email,
            userId: s.id,
            vars: {
              recipientFirstName: s.firstName ?? "Team",
              entityName: context.entityName,
              lotTitle: context.lotTitle,
              lotReference: context.lotReference,
              refundAmount,
              refundCurrency,
              eventKind,
              reason,
              supportContactEmail,
            },
            category: "transactional",
            idempotencyKey: `payment-refund-notice:${row.id}:ops:${s.id}`,
          });
        }
      } else if (adminEmailAddress) {
        await emailService.enqueue({
          template: "payment-refund-notice",
          to: adminEmailAddress,
          recipientResolution: "snapshot",
          vars: {
            recipientFirstName: "Ops Team",
            entityName: context.entityName,
            lotTitle: context.lotTitle,
            lotReference: context.lotReference,
            refundAmount,
            refundCurrency,
            eventKind,
            reason,
            supportContactEmail,
          },
          category: "transactional",
          idempotencyKey: `payment-refund-notice:${row.id}:admin`,
        });
      }

      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "payment_refund_notify_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
