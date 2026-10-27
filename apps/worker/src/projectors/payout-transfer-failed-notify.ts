import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  listStaffAlertTargets,
  sellerPayoutsUrlFor,
} from "./notification-fanout/notification-fanout-helpers.js";

const PROJECTOR_NAME = "payout_transfer_failed_notify";

type TransferFailedPayload = {
  legalEntityId: string;
  stripeErrorCode: string;
  stripeErrorMessage: string;
  amountCents: number;
  currency: string;
};

export async function processPayoutTransferFailedNotify(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
}): Promise<void> {
  const { ctx, log, emailService, supportContactEmail, adminPayoutsUrl } = options;
  const { projectorStateRepo, domainEventReader, payoutTransferFailedNotifyReader } = ctx;

  const cursor = await projectorStateRepo.getCursor(PROJECTOR_NAME);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["payout.transfer_failed"],
    limit: 50,
  });

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
      const context = await payoutTransferFailedNotifyReader.getTransferFailedContext(
        payload.legalEntityId,
        row.aggregateId,
        payload.amountCents,
        payload.currency,
      );

      const webOrigin = ctx.webOrigin?.replace(/\/$/, "") ?? "https://lax.bid";
      const sellerPayoutSetupUrl =
        context.entityKind === "organisation"
          ? `${webOrigin}/organisation/payouts?account=${payload.legalEntityId}`
          : `${webOrigin}/selling/payout-setup`;

      const failureReason = payload.stripeErrorMessage
        ? `${payload.stripeErrorCode}: ${payload.stripeErrorMessage}`
        : (payload.stripeErrorCode ?? "Unknown error");

      for (const m of context.financeMembers) {
        await emailService.enqueue({
          template: "payout-transfer-failed-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            audience: "seller",
            recipientFirstName: m.firstName,
            entityName: context.entityName,
            payoutId: row.aggregateId,
            payoutAmount: context.payoutAmount,
            payoutCurrency: context.payoutCurrency,
            failureReason,
            supportContactEmail,
            payoutsUrl: sellerPayoutsUrlFor(adminPayoutsUrl),
            sellerPayoutSetupUrl,
          },
          category: "transactional",
          idempotencyKey: `payout-transfer-failed-notice:${row.aggregateId}:${m.userId}`,
        });
      }

      // Staff need the provider's raw error and the admin queue; the seller copy has neither.
      const staffTargets = await listStaffAlertTargets(
        ctx.staffOpsRecipientReader,
        ctx.adminEmailAddress,
      );
      for (const target of staffTargets) {
        await emailService.enqueue({
          template: "payout-transfer-failed-notice",
          to: target.to,
          ...(target.userId ? { userId: target.userId } : {}),
          ...(target.snapshot ? { recipientResolution: "snapshot" as const } : {}),
          vars: {
            audience: "staff",
            recipientFirstName: target.firstName,
            entityName: context.entityName,
            payoutId: row.aggregateId,
            payoutAmount: context.payoutAmount,
            payoutCurrency: context.payoutCurrency,
            failureReason,
            supportContactEmail,
            payoutsUrl: adminPayoutsUrl,
            sellerPayoutSetupUrl,
          },
          category: "transactional",
          idempotencyKey: `payout-transfer-failed-notice:${row.aggregateId}:${target.keySuffix}`,
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
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
