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
import { listStaffOpsRecipients } from "../lib/staff-ops-email-recipients.js";

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

type SellerMoneyPayload = {
  legalEntityId?: string;
  sellerLegalEntityId?: string;
  amountCents?: number;
  netAmount?: string;
  currency: string;
  reason?: string | null;
  outcome?: string;
};

type ProxyCancelledPayload = {
  lotId: string;
  bidderUserId: string;
  reason: string;
};

type LotVoidedPayload = {
  lotId?: string;
  reason: string;
};

const SUPPORTED_EVENT_TYPES = [
  "payout.transfer_blocked",
  "payment.requires_manual_review",
  "payout.transfer_initiated",
  "payment.dispute_opened",
  "payment.dispute_closed",
  "bid.proxy_cancelled",
  "lot.voided",
  "payout.clawback_required",
] as const;

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
    .where(
      and(gt(domainEvent.id, cursor), inArray(domainEvent.eventType, [...SUPPORTED_EVENT_TYPES])),
    )
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
      if (row.eventType === "payout.transfer_initiated") {
        await fanoutPayoutInitiated({
          db,
          emailService,
          adminPayoutsUrl,
          eventId: row.id,
          payoutId: row.aggregateId,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "payment.dispute_opened") {
        await fanoutDisputeOpened({
          db,
          emailService,
          supportContactEmail,
          adminEmailAddress: options.adminEmailAddress,
          eventId: row.id,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "payment.dispute_closed") {
        await fanoutDisputeClosed({
          db,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "bid.proxy_cancelled") {
        await fanoutProxyCancelled({
          db,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as ProxyCancelledPayload,
        });
      }
      if (row.eventType === "lot.voided") {
        await fanoutLotVoided({
          db,
          emailService,
          supportContactEmail,
          eventId: row.id,
          lotId: row.aggregateId,
          payload: row.payload as LotVoidedPayload,
        });
      }
      if (row.eventType === "payout.clawback_required") {
        await fanoutPayoutClawbackRequired({
          db,
          emailService,
          adminPayoutsUrl,
          adminEmailAddress: options.adminEmailAddress,
          eventId: row.id,
          payoutId: row.aggregateId,
          payload: row.payload as SellerMoneyPayload,
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

async function listEntityRecipients(db: Db, legalEntityId: string) {
  return db
    .selectDistinct({
      email: user.email,
      userId: user.id,
      firstName: user.firstName,
    })
    .from(legalEntityMember)
    .innerJoin(user, eq(user.id, legalEntityMember.userId))
    .where(
      and(
        eq(legalEntityMember.legalEntityId, legalEntityId),
        isNull(legalEntityMember.removedAt),
        isNotNull(legalEntityMember.acceptedAt),
        or(
          inArray(legalEntityMember.role, ["owner", "admin", "finance"]),
          eq(legalEntityMember.isPrimaryAdmin, true),
        ),
      ),
    );
}

async function entityName(db: Db, legalEntityId: string): Promise<string> {
  const [row] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, legalEntityId))
    .limit(1);
  return row?.displayName ?? "Unknown Organisation";
}

function centsToAmount(cents: number | undefined): string {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "0.00";
}

async function fanoutPayoutInitiated(options: {
  db: Db;
  emailService: IEmailService;
  adminPayoutsUrl: string;
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
      template: "payout-initiated-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName: name,
        payoutId: options.payoutId,
        amount: centsToAmount(options.payload.amountCents),
        currency: options.payload.currency,
        adminPayoutsUrl: options.adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-initiated-notice:${options.eventId}:${recipient.userId}`,
    });
  }
}

async function fanoutDisputeOpened(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  adminEmailAddress?: string | undefined;
  eventId: number;
  payload: SellerMoneyPayload;
}) {
  const sellerId = options.payload.sellerLegalEntityId;
  if (!sellerId) return;
  const name = await entityName(options.db, sellerId);
  const amount = centsToAmount(options.payload.amountCents);
  const recipients = await listEntityRecipients(options.db, sellerId);
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
  const staffOps = await listStaffOpsRecipients(options.db);
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

async function fanoutDisputeClosed(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: SellerMoneyPayload;
}) {
  const sellerId = options.payload.sellerLegalEntityId;
  if (!sellerId) return;
  const name = await entityName(options.db, sellerId);
  const recipients = await listEntityRecipients(options.db, sellerId);
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

  const staffOps = await listStaffOpsRecipients(db);
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

async function fanoutProxyCancelled(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: ProxyCancelledPayload;
}) {
  if (!options.payload?.bidderUserId || !options.payload?.lotId) return;
  const [lotRow] = await options.db
    .select({ title: lot.title })
    .from(lot)
    .where(eq(lot.id, options.payload.lotId))
    .limit(1);
  const [bidder] = await options.db
    .select({ email: user.email, name: user.name, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, options.payload.bidderUserId))
    .limit(1);
  if (!bidder?.email) return;
  await options.emailService.enqueue({
    template: "proxy-cancelled-notice",
    to: bidder.email,
    userId: options.payload.bidderUserId,
    vars: {
      userName: bidder.firstName ?? bidder.name,
      lotTitle: lotRow?.title ?? "Unknown Lot",
      reason: options.payload.reason,
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `proxy-cancelled-notice:${options.eventId}:${options.payload.bidderUserId}`,
  });
}

async function fanoutLotVoided(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  lotId: string;
  payload: LotVoidedPayload;
}) {
  const lotId = options.payload.lotId ?? options.lotId;
  const [lotRow] = await options.db
    .select({
      title: lot.title,
      winnerId: lot.winnerId,
      sellerLegalEntityId: lot.sellerLegalEntityId,
    })
    .from(lot)
    .where(eq(lot.id, lotId))
    .limit(1);
  if (!lotRow) return;
  const lotTitle = lotRow.title ?? "Unknown Lot";
  if (lotRow.sellerLegalEntityId) {
    const recipients = await listEntityRecipients(options.db, lotRow.sellerLegalEntityId);
    for (const recipient of recipients) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: recipient.email,
        userId: recipient.userId,
        vars: {
          recipientFirstName: recipient.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:seller:${recipient.userId}`,
      });
    }
  }
  if (lotRow.winnerId) {
    const [winner] = await options.db
      .select({ email: user.email, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, lotRow.winnerId))
      .limit(1);
    if (winner?.email) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: winner.email,
        userId: lotRow.winnerId,
        vars: {
          recipientFirstName: winner.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:winner:${lotRow.winnerId}`,
      });
    }
  }
}

async function fanoutPayoutClawbackRequired(options: {
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
