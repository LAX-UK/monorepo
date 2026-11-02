import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  fanoutOrganisationLimitChanged,
  fanoutSaleRegistrationDecided,
  fanoutSaleRegistrationLimitChanged,
} from "./notification-fanout/bidding-registration-fanout.js";
import { fanoutPayoutClawbackRequired } from "./notification-fanout/clawback-fanout.js";
import { fanoutDisputeClosed, fanoutDisputeOpened } from "./notification-fanout/dispute-fanout.js";
import { fanoutLotVoided } from "./notification-fanout/lot-voided-fanout.js";
import { fanoutPaymentManualReview } from "./notification-fanout/manual-review-fanout.js";
import { fanoutMemberRemoved } from "./notification-fanout/membership-fanout.js";
import {
  type LotVoidedPayload,
  type LotWithdrawalDeclinedPayload,
  type ManualReviewPayload,
  type MemberRemovedPayload,
  type OrganisationLimitChangedPayload,
  type PaymentCancelledPayload,
  type ProxyCancelledPayload,
  SUPPORTED_EVENT_TYPES,
  type SaleRegistrationDecidedPayload,
  type SaleRegistrationLimitChangedPayload,
  type SellerMoneyPayload,
  type TransferBlockedPayload,
} from "./notification-fanout/notification-fanout-helpers.js";
import { fanoutPaymentFailed } from "./notification-fanout/payment-failed-fanout.js";
import { fanoutPayoutInitiated } from "./notification-fanout/payout-fanout.js";
import { fanoutProxyCancelled } from "./notification-fanout/proxy-fanout.js";
import { fanoutPayoutTransferBlocked } from "./notification-fanout/transfer-blocked-fanout.js";
import { fanoutLotWithdrawalDeclined } from "./notification-fanout/withdrawal-declined-fanout.js";

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
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          adminEmailAddress: ctx.adminEmailAddress,
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
      if (row.eventType === "lot.withdrawal_declined") {
        await fanoutLotWithdrawalDeclined({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          lotId: row.aggregateId,
          payload: row.payload as LotWithdrawalDeclinedPayload,
        });
      }
      if (row.eventType === "legal_entity.member_removed") {
        await fanoutMemberRemoved({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          legalEntityId: row.aggregateId,
          payload: row.payload as MemberRemovedPayload,
          webOrigin: ctx.webOrigin,
        });
      }
      if (row.eventType === "sale_registration.decided") {
        await fanoutSaleRegistrationDecided({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as SaleRegistrationDecidedPayload,
          webOrigin: ctx.webOrigin,
        });
      }
      if (row.eventType === "sale_registration.bid_limit_changed") {
        await fanoutSaleRegistrationLimitChanged({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as SaleRegistrationLimitChangedPayload,
        });
      }
      if (row.eventType === "legal_entity.bidding_limit_changed") {
        await fanoutOrganisationLimitChanged({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          legalEntityId: row.aggregateId,
          payload: row.payload as OrganisationLimitChangedPayload,
        });
      }
      if (row.eventType === "payment.cancelled") {
        await fanoutPaymentFailed({
          notificationFanoutReader,
          emailService,
          supportContactEmail,
          eventId: row.id,
          payload: row.payload as PaymentCancelledPayload,
          webOrigin: ctx.webOrigin,
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
