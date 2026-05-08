import {
  domainEvent,
  legalEntity,
  legalEntityMember,
  lot,
  payment,
  projectorState,
  user,
} from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type pino from "pino";

const PROJECTOR_NAME = "payment_refund_notify";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type RefundPayload = {
  stripeChargeId?: string;
  amountCents: number;
  currency: string;
  sellerLegalEntityId: string;
  via?: string;
};

export async function processPaymentRefundNotify(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminEmailAddress: string;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, adminEmailAddress } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: PROJECTOR_NAME, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, PROJECTOR_NAME))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      eventType: domainEvent.eventType,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "payment.refunded")))
    .orderBy(domainEvent.id)
    .limit(50);

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
      const [paymentRow] = await db
        .select({
          lotId: payment.lotId,
          amount: payment.amount,
        })
        .from(payment)
        .where(eq(payment.id, paymentId))
        .limit(1);

      if (!paymentRow) {
        log.warn({ eventId: row.id, paymentId }, "payment_refund_notify_skipped_no_payment");
        maxId = row.id;
        continue;
      }

      const [lotRow] = await db
        .select({
          title: lot.title,
          lotNumber: lot.lotNumber,
        })
        .from(lot)
        .where(eq(lot.id, paymentRow.lotId))
        .limit(1);

      const lotTitle = lotRow?.title ?? "Unknown Lot";
      const lotReference = lotRow?.lotNumber != null ? String(lotRow.lotNumber) : null;

      const [entityRow] = await db
        .select({ displayName: legalEntity.displayName })
        .from(legalEntity)
        .where(eq(legalEntity.id, sellerLegalEntityId))
        .limit(1);
      const entityName = entityRow?.displayName ?? "Unknown Organisation";

      const amountCents = payload.amountCents;
      const refundAmount = (amountCents / 100).toFixed(2);
      const refundCurrency = payload.currency?.toUpperCase() ?? "GBP";
      const eventKind = "refund";
      const reason: string | null = null;

      const sellerMembers = await db
        .selectDistinct({
          email: user.email,
          userId: user.id,
          firstName: user.firstName,
        })
        .from(legalEntityMember)
        .innerJoin(user, eq(user.id, legalEntityMember.userId))
        .where(
          and(
            eq(legalEntityMember.legalEntityId, sellerLegalEntityId),
            isNull(legalEntityMember.removedAt),
            isNotNull(legalEntityMember.acceptedAt),
            or(
              inArray(legalEntityMember.role, ["owner", "admin"]),
              eq(legalEntityMember.isPrimaryAdmin, true),
            ),
          ),
        );

      for (const m of sellerMembers) {
        await emailService.enqueue({
          template: "payment-refund-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            recipientFirstName: m.firstName,
            entityName,
            lotTitle,
            lotReference,
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

      await emailService.enqueue({
        template: "payment-refund-notice",
        to: adminEmailAddress,
        vars: {
          recipientFirstName: "Ops Team",
          entityName,
          lotTitle,
          lotReference,
          refundAmount,
          refundCurrency,
          eventKind,
          reason,
          supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `payment-refund-notice:${row.id}:admin`,
      });

      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "payment_refund_notify_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, PROJECTOR_NAME));
  }
}
