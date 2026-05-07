import {
  domainEvent,
  legalEntity,
  legalEntityMember,
  lot,
  payout,
  projectorState,
  user,
} from "@auction/db/schema";
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

type ManualReviewPayload = {
  paymentId: string;
  lotId: string;
  buyerUserId: string;
  sellerLegalEntityId: string;
  amount: string;
  currency: string;
  reason: string;
};

const SUPPORTED_EVENT_TYPES = ["payout.transfer_blocked", "payment.requires_manual_review"] as const;

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
  adminEmailAddress?: string | undefined;
  webOrigin?: string | undefined;
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
      if (row.eventType === "payment.requires_manual_review") {
        const manualReviewArgs: Parameters<typeof fanoutPaymentManualReview>[0] = {
          db,
          emailService,
          supportContactEmail,
          eventId: row.id,
          paymentId: row.aggregateId,
          payload: row.payload as ManualReviewPayload,
        };
        if (options.adminEmailAddress) {
          manualReviewArgs.adminEmailAddress = options.adminEmailAddress;
        }
        if (options.webOrigin) {
          manualReviewArgs.webOrigin = options.webOrigin;
        }
        await fanoutPaymentManualReview({
          ...manualReviewArgs,
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

async function fanoutPaymentManualReview(options: {
  db: Db;
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

  if (adminEmailAddress) {
    const base = webOrigin?.replace(/\/$/, "") ?? "";
    await emailService.enqueue({
      template: "payment-manual-review-admin-notice",
      to: adminEmailAddress,
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
