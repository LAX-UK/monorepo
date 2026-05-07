import { domainEvent, legalEntity, legalEntityMember, payout, projectorState, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type pino from "pino";

const PROJECTOR_NAME = "payout_transfer_failed_notify";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type TransferFailedPayload = {
  legalEntityId: string;
  stripeErrorCode: string;
  stripeErrorMessage: string;
  amountCents: number;
  currency: string;
};

export async function processPayoutTransferFailedNotify(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, adminPayoutsUrl } = options;

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
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "payout.transfer_failed")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    const payload = row.payload as TransferFailedPayload;
    if (!payload?.legalEntityId) {
      log.warn({ eventId: row.id }, "payout_transfer_failed_notify_skipped_malformed_payload");
      maxId = row.id;
      continue;
    }

    try {
      const [entityRow] = await db
        .select({ displayName: legalEntity.displayName })
        .from(legalEntity)
        .where(eq(legalEntity.id, payload.legalEntityId))
        .limit(1);
      const entityName = entityRow?.displayName ?? "Unknown Organisation";

      const [payoutRow] = await db
        .select({ netAmount: payout.netAmount, currency: payout.currency })
        .from(payout)
        .where(eq(payout.id, row.aggregateId))
        .limit(1);

      const payoutAmount = payoutRow?.netAmount ?? (payload.amountCents / 100).toFixed(2);
      const payoutCurrency = payoutRow?.currency ?? payload.currency ?? "GBP";

      const financeMembers = await db
        .selectDistinct({
          email: user.email,
          userId: user.id,
          firstName: user.firstName,
        })
        .from(legalEntityMember)
        .innerJoin(user, eq(user.id, legalEntityMember.userId))
        .where(
          and(
            eq(legalEntityMember.legalEntityId, payload.legalEntityId),
            isNull(legalEntityMember.removedAt),
            isNotNull(legalEntityMember.acceptedAt),
            or(
              inArray(legalEntityMember.role, ["owner", "admin"]),
              eq(legalEntityMember.isPrimaryAdmin, true),
            ),
          ),
        );

      const failureReason = payload.stripeErrorMessage
        ? `${payload.stripeErrorCode}: ${payload.stripeErrorMessage}`
        : payload.stripeErrorCode ?? "Unknown error";

      for (const m of financeMembers) {
        await emailService.enqueue({
          template: "payout-transfer-failed-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            recipientFirstName: m.firstName,
            entityName,
            payoutId: row.aggregateId,
            payoutAmount,
            payoutCurrency,
            failureReason,
            supportContactEmail,
            adminPayoutsUrl,
          },
          category: "transactional",
          idempotencyKey: `payout-transfer-failed-notice:${row.aggregateId}:${m.userId}`,
        });
      }
      maxId = row.id;
    } catch (err) {
      log.error(
        { err, eventId: row.id, payoutId: row.aggregateId },
        "payout_transfer_failed_notify_failed",
      );
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
