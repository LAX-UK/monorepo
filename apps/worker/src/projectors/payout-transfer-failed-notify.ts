import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

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
          ? `${webOrigin}/dashboard/organisations/${payload.legalEntityId}/connect`
          : `${webOrigin}/dashboard/seller/connect`;

      const failureReason = payload.stripeErrorMessage
        ? `${payload.stripeErrorCode}: ${payload.stripeErrorMessage}`
        : (payload.stripeErrorCode ?? "Unknown error");

      for (const m of context.financeMembers) {
        await emailService.enqueue({
          template: "payout-transfer-failed-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            recipientFirstName: m.firstName,
            entityName: context.entityName,
            payoutId: row.aggregateId,
            payoutAmount: context.payoutAmount,
            payoutCurrency: context.payoutCurrency,
            failureReason,
            supportContactEmail,
            adminPayoutsUrl,
            sellerPayoutSetupUrl,
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
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
