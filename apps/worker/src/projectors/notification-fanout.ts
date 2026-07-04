import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { fanoutPayoutClawbackRequired } from "./notification-fanout/clawback-fanout.js";
import { fanoutDisputeClosed, fanoutDisputeOpened } from "./notification-fanout/dispute-fanout.js";
import { fanoutLotVoided } from "./notification-fanout/lot-voided-fanout.js";
import { fanoutPaymentManualReview } from "./notification-fanout/manual-review-fanout.js";
import {
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
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
}): Promise<void> {
  const { ctx, log, emailService, supportContactEmail, adminPayoutsUrl } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    projectorFailureRecorder,
    notificationFanoutReader,
  } = ctx;

  const cursor = await projectorStateRepo.getCursor(NOTIFICATION_FANOUT_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...SUPPORTED_EVENT_TYPES],
    limit: 50,
  });

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      if (row.eventType === "payout.transfer_blocked") {
        await fanoutPayoutTransferBlocked({
          notificationFanoutReader,
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
          notificationFanoutReader,
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          paymentId: row.aggregateId,
          payload: row.payload as ManualReviewPayload,
        };
        if (ctx.adminEmailAddress) {
          manualReviewArgs.adminEmailAddress = ctx.adminEmailAddress;
        }
        if (ctx.webOrigin) {
          manualReviewArgs.webOrigin = ctx.webOrigin;
        }
        await fanoutPaymentManualReview(manualReviewArgs);
      }
      if (row.eventType === "payout.transfer_initiated") {
        await fanoutPayoutInitiated({
          notificationFanoutReader,
          emailService,
          adminPayoutsUrl,
          eventId: row.id,
          payoutId: row.aggregateId,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "payment.dispute_opened") {
        await fanoutDisputeOpened({
          notificationFanoutReader,
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          emailService,
          supportContactEmail,
          adminEmailAddress: ctx.adminEmailAddress,
          eventId: row.id,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "payment.dispute_closed") {
        await fanoutDisputeClosed({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      if (row.eventType === "bid.proxy_cancelled") {
        await fanoutProxyCancelled({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as ProxyCancelledPayload,
        });
      }
      if (row.eventType === "lot.voided") {
        await fanoutLotVoided({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          lotId: row.aggregateId,
          payload: row.payload as LotVoidedPayload,
        });
      }
      if (row.eventType === "payout.clawback_required") {
        await fanoutPayoutClawbackRequired({
          notificationFanoutReader,
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          emailService,
          adminPayoutsUrl,
          adminEmailAddress: ctx.adminEmailAddress,
          eventId: row.id,
          payoutId: row.aggregateId,
          payload: row.payload as SellerMoneyPayload,
        });
      }
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
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
    await projectorStateRepo.advanceCursor(NOTIFICATION_FANOUT_PROJECTOR, maxId);
  }
}
