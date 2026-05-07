import { domainEvent, legalEntity, legalEntityMember, payout, projectorState, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type pino from "pino";

export const NOTIFICATION_FANOUT_PROJECTOR = "notification_fanout";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type TransferBlockedPayload = {
  payoutId: string;
  legalEntityId: string;
  reason: string;
};

const SUPPORTED_EVENT_TYPES = ["payout.transfer_blocked"] as const;

function formatReason(reason: string): string {
  if (reason === "connect_not_ready") {
    return "Stripe Connect payouts are not enabled for this organisation";
  }
  return reason.replaceAll("_", " ");
}

export async function processNotificationFanout(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, adminPayoutsUrl } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: NOTIFICATION_FANOUT_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, NOTIFICATION_FANOUT_PROJECTOR))
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
    .where(and(gt(domainEvent.id, cursor), inArray(domainEvent.eventType, [...SUPPORTED_EVENT_TYPES])))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      if (row.eventType === "payout.transfer_blocked") {
        await fanoutPayoutTransferBlocked({
          db,
          emailService,
          supportContactEmail,
          adminPayoutsUrl,
          eventId: row.id,
          payoutId: row.aggregateId,
          payload: row.payload as TransferBlockedPayload,
        });
      }
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id, eventType: row.eventType }, "notification_fanout_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, NOTIFICATION_FANOUT_PROJECTOR));
  }
}

async function fanoutPayoutTransferBlocked(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: TransferBlockedPayload;
}): Promise<void> {
  const { db, emailService, supportContactEmail, adminPayoutsUrl, eventId, payoutId, payload } =
    options;
  if (!payload?.legalEntityId) return;

  const [entityRow] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, payload.legalEntityId))
    .limit(1);
  const entityName = entityRow?.displayName ?? "Unknown Organisation";

  const [payoutRow] = await db
    .select({ netAmount: payout.netAmount, currency: payout.currency })
    .from(payout)
    .where(eq(payout.id, payoutId))
    .limit(1);
  const payoutAmount = payoutRow?.netAmount ?? "0.00";
  const payoutCurrency = payoutRow?.currency ?? "GBP";

  const recipients = await db
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
          inArray(legalEntityMember.role, ["owner", "admin", "finance"]),
          eq(legalEntityMember.isPrimaryAdmin, true),
        ),
      ),
    );

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
