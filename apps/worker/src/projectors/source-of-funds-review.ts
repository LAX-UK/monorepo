import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { escalateSourceOfFundsRequiredCase } from "./source-of-funds-review/escalate-required-case.js";
import { manageSourceOfFundsReviewTask } from "./source-of-funds-review/manage-review-task.js";
import type { SourceOfFundsRequiredPayload } from "./source-of-funds-review/sof-review-helpers.js";

export const SOURCE_OF_FUNDS_REVIEW_PROJECTOR = "source_of_funds_review";

export async function processSourceOfFundsReview(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    projectorFailureRecorder,
    adminReviewTaskProjectorRepo,
    emailService,
    supportContactEmail,
    webOrigin,
    adminEmailAddress,
    complianceRecipientReader,
    sourceOfFundsBuyerReader,
  } = ctx;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const adminReviewUrl = `${base}/admin/compliance/source-of-funds`;

  const cursor = await projectorStateRepo.getCursor(SOURCE_OF_FUNDS_REVIEW_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["source_of_funds.required"],
    limit: 50,
  });

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as SourceOfFundsRequiredPayload;
      const sourceOfFundsId = payload.sourceOfFundsId ?? row.aggregateId;

      const { createdTask } = await manageSourceOfFundsReviewTask({
        adminReviewTaskProjectorRepo,
        log,
        payload,
        sourceOfFundsId,
      });

      if (createdTask && emailService && supportContactEmail) {
        await escalateSourceOfFundsRequiredCase({
          sourceOfFundsBuyerReader,
          complianceRecipientReader,
          emailService,
          supportContactEmail,
          adminReviewUrl,
          adminEmailAddress,
          payload,
          sourceOfFundsId,
        });
      }
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
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
    await projectorStateRepo.advanceCursor(SOURCE_OF_FUNDS_REVIEW_PROJECTOR, maxId);
  }
}
