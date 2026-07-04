import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR = "source_of_funds_review_resolution";

type SourceOfFundsReviewedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  status?: string;
  trigger?: string;
};

export async function processSourceOfFundsReviewResolution(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder, sourceOfFundsReviewResolutionRepo } =
    ctx;

  const cursor = await projectorStateRepo.getCursor(SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["source_of_funds.reviewed"],
    limit: 50,
  });

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as SourceOfFundsReviewedPayload;
      const sourceOfFundsId = payload.sourceOfFundsId ?? row.aggregateId;

      await sourceOfFundsReviewResolutionRepo.resolveIfTerminal(
        sourceOfFundsId,
        row.actorUserId ?? null,
        log,
      );

      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
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
    await projectorStateRepo.advanceCursor(SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR, maxId);
  }
}
