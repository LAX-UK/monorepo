import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR = "source_of_funds_document_review";

type DocumentReviewedPayload = {
  sourceOfFundsId?: string;
  documentId?: string;
  checks?: Record<string, unknown>;
  note?: string | null;
  reviewedByUserId?: string;
  reviewedAt?: string;
};

export async function processSourceOfFundsDocumentReview(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    projectorFailureRecorder,
    sourceOfFundsDocumentReviewRepo,
  } = ctx;

  const cursor = await projectorStateRepo.getCursor(SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["source_of_funds.document_reviewed"],
    limit: 50,
  });

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as DocumentReviewedPayload;
      const documentId = payload.documentId;
      const sourceOfFundsId = payload.sourceOfFundsId ?? row.aggregateId;
      const reviewedByUserId = payload.reviewedByUserId;
      const reviewedAtRaw = payload.reviewedAt;
      if (!documentId || !reviewedByUserId || !reviewedAtRaw) {
        maxId = row.id;
        continue;
      }

      const rawChecks = payload.checks;
      const checks =
        rawChecks && typeof rawChecks === "object" && !Array.isArray(rawChecks) ? rawChecks : {};

      await sourceOfFundsDocumentReviewRepo.upsertReview({
        documentId,
        sourceOfFundsId,
        reviewedByUserId,
        reviewedAt: new Date(reviewedAtRaw),
        checks: {
          matchesDeclaredSource: Boolean(checks.matchesDeclaredSource),
          coversExposure: Boolean(checks.coversExposure),
          recentEnough: Boolean(checks.recentEnough),
          legibleComplete: Boolean(checks.legibleComplete),
        },
        note: payload.note == null ? null : String(payload.note),
      });

      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
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
    await projectorStateRepo.advanceCursor(SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR, maxId);
  }
}
