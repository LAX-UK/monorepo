import { domainEvent, projectorState } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { and, eq, gt } from "drizzle-orm";
import type pino from "pino";
import type { IAdminReviewTaskProjectorRepository } from "../interfaces/admin-review-task-projector.repository.js";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import { recordProjectorEventFailure } from "./lib/projector-failure-guard.js";
import { escalateSourceOfFundsRequiredCase } from "./source-of-funds-review/escalate-required-case.js";
import { manageSourceOfFundsReviewTask } from "./source-of-funds-review/manage-review-task.js";
import type { SourceOfFundsRequiredPayload } from "./source-of-funds-review/sof-review-helpers.js";

export const SOURCE_OF_FUNDS_REVIEW_PROJECTOR = "source_of_funds_review";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

/**
 * Projects `source_of_funds.required` outbox events into durable MLRO/finance
 * review work items (`admin_review_task` of kind `source_of_funds_review`).
 * Settlement is already gated for the buyer (the case is `pending`), so this
 * projector guarantees a queryable task exists for the SoF disposition.
 *
 * Idempotent: at most one task per SoF case id; the cursor only advances past
 * events that were fully handled.
 */
export async function processSourceOfFundsReview(options: {
  db: Db;
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  log: pino.Logger;
  complianceRecipientReader: IComplianceRecipientReader;
  /** When set, an MLRO escalation email is enqueued per SoF case. */
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  webOrigin?: string | undefined;
  adminEmailAddress?: string | undefined;
}): Promise<void> {
  const {
    db,
    adminReviewTaskProjectorRepo,
    log,
    emailService,
    supportContactEmail,
    webOrigin,
    adminEmailAddress,
    complianceRecipientReader,
  } = options;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const adminReviewUrl = `${base}/admin/compliance/source-of-funds`;

  await db
    .insert(projectorState)
    .values({ projectorName: SOURCE_OF_FUNDS_REVIEW_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_REVIEW_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "source_of_funds.required")))
    .orderBy(domainEvent.id)
    .limit(50);

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

      // Active MLRO escalation (CDD Section 6). Idempotent via idempotencyKey.
      if (createdTask && emailService && supportContactEmail) {
        await escalateSourceOfFundsRequiredCase({
          db,
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
      const outcome = await recordProjectorEventFailure({
        db,
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
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, SOURCE_OF_FUNDS_REVIEW_PROJECTOR));
  }
}
