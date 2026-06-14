import { adminReviewTask, domainEvent, projectorState, sourceOfFunds } from "@auction/db";
import { and, eq, gt, sql } from "drizzle-orm";
import type pino from "pino";

export const SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR = "source_of_funds_review_resolution";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type SourceOfFundsReviewedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  status?: string;
  trigger?: string;
};

/**
 * Projects `source_of_funds.reviewed` outbox events into resolved
 * `admin_review_task` rows of kind `source_of_funds_review`.
 *
 * Idempotent: already-resolved tasks are left unchanged; the cursor only
 * advances past events that were fully handled.
 */
export async function processSourceOfFundsReviewResolution(options: {
  db: Db;
  log: pino.Logger;
}): Promise<void> {
  const { db, log } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      actorUserId: domainEvent.actorUserId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "source_of_funds.reviewed")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as SourceOfFundsReviewedPayload;
      const sourceOfFundsId = payload.sourceOfFundsId ?? row.aggregateId;

      // Read the case's *current* status rather than trusting the event payload.
      // A later reopen (`source_of_funds.required`) is handled by a separate
      // projector with an independent cursor, so if the case has returned to
      // `pending` we must NOT resolve the (reactivated) task even when an older
      // reviewed event is replayed from a backlog. We still advance the cursor:
      // the stale reviewed event is genuinely consumed either way.
      const [caseRow] = await db
        .select({ status: sourceOfFunds.status })
        .from(sourceOfFunds)
        .where(eq(sourceOfFunds.id, sourceOfFundsId))
        .limit(1);
      const caseStatus = caseRow?.status ?? null;
      const caseIsTerminal = caseStatus === "approved" || caseStatus === "rejected";

      if (caseIsTerminal) {
        const existing = await db
          .select({ id: adminReviewTask.id, status: adminReviewTask.status })
          .from(adminReviewTask)
          .where(
            and(
              eq(adminReviewTask.kind, "source_of_funds_review"),
              sql`${adminReviewTask.payload} ->> 'sourceOfFundsId' = ${sourceOfFundsId}`,
            ),
          )
          .limit(1);

        const task = existing[0];
        if (task && (task.status === "pending" || task.status === "in_progress")) {
          await db
            .update(adminReviewTask)
            .set({
              status: "resolved",
              resolvedAt: new Date(),
              resolvedByUserId: row.actorUserId ?? null,
            })
            .where(eq(adminReviewTask.id, task.id));
          log.info({ sourceOfFundsId, taskId: task.id }, "source_of_funds_review_task_resolved");
        } else if (!task) {
          log.warn({ sourceOfFundsId }, "source_of_funds_review_task_not_found_for_resolution");
        }
      } else {
        log.info(
          { sourceOfFundsId, caseStatus },
          "source_of_funds_review_resolution_skipped_non_terminal",
        );
      }

      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "source_of_funds_review_resolution_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR));
  }
}
