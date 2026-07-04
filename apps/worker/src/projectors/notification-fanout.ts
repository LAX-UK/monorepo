import { domainEvent, projectorState } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, inArray } from "drizzle-orm";
import type pino from "pino";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";
import { fanoutPayoutClawbackRequired } from "./notification-fanout/clawback-fanout.js";
import { fanoutDisputeClosed, fanoutDisputeOpened } from "./notification-fanout/dispute-fanout.js";
import { fanoutLotVoided } from "./notification-fanout/lot-voided-fanout.js";
import { fanoutPaymentManualReview } from "./notification-fanout/manual-review-fanout.js";
import {
  type Db,
  type LotVoidedPayload,
  type ManualReviewPayload,
  type ProxyCancelledPayload,
  SUPPORTED_EVENT_TYPES,
  type SellerMoneyPayload,
  type TransferBlockedPayload,
} from "./notification-fanout/notification-fanout-helpers.js";
import { fanoutPayoutInitiated } from "./notification-fanout/payout-fanout.js";
import { fanoutProxyCancelled } from "./notification-fanout/proxy-fanout.js";
import { fanoutPayoutTransferBlocked } from "./notification-fanout/transfer-blocked-fanout.js";

export const NOTIFICATION_FANOUT_PROJECTOR = "notification_fanout";

export async function processNotificationFanout(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  adminEmailAddress?: string | undefined;
  webOrigin?: string | undefined;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, adminPayoutsUrl, staffOpsRecipientReader } =
    options;

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
          staffOpsRecipientReader,
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
          staffOpsRecipientReader,
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
          staffOpsRecipientReader,
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
      const outcome = await recordProjectorEventFailure({
        db,
        log,
        projectorName: NOTIFICATION_FANOUT_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
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
