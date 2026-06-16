import { domainEvent, projectorState, sourceOfFundsDocumentReview } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type pino from "pino";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";

export const SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR = "source_of_funds_document_review";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type DocumentReviewedPayload = {
  sourceOfFundsId?: string;
  documentId?: string;
  checks?: Record<string, unknown>;
  note?: string | null;
  reviewedByUserId?: string;
  reviewedAt?: string;
};

/**
 * Folds `source_of_funds.document_reviewed` events into the read-model table.
 * Idempotent upsert — safe to replay.
 */
export async function processSourceOfFundsDocumentReview(options: {
  db: Db;
  log: pino.Logger;
}): Promise<void> {
  const { db, log } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      eventType: domainEvent.eventType,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(
      sql`${domainEvent.id} > ${cursor} AND ${domainEvent.eventType} = 'source_of_funds.document_reviewed'`,
    )
    .orderBy(domainEvent.id)
    .limit(50);

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

      await db
        .insert(sourceOfFundsDocumentReview)
        .values({
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
        })
        .onConflictDoUpdate({
          target: sourceOfFundsDocumentReview.documentId,
          set: {
            reviewedByUserId,
            reviewedAt: new Date(reviewedAtRaw),
            checks: {
              matchesDeclaredSource: Boolean(checks.matchesDeclaredSource),
              coversExposure: Boolean(checks.coversExposure),
              recentEnough: Boolean(checks.recentEnough),
              legibleComplete: Boolean(checks.legibleComplete),
            },
            note: payload.note == null ? null : String(payload.note),
          },
        });

      maxId = row.id;
    } catch (err) {
      const outcome = await recordProjectorEventFailure({
        db,
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
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR));
  }
}
