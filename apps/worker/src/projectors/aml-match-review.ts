import { adminReviewTask, domainEvent, projectorState } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, sql } from "drizzle-orm";
import type pino from "pino";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

export const AML_MATCH_REVIEW_PROJECTOR = "aml_match_review";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type AmlMatchFlaggedPayload = {
  screeningId?: string;
  userId?: string;
  providerSessionId?: string;
  outcome?: string;
  matchStatus?: string;
  categories?: string;
  reasons?: string;
};

/**
 * Projects `aml.match_flagged` outbox events into durable MLRO review work
 * items (`admin_review_task` of kind `aml_screening_review`). The subject is
 * already on an AML hold (set transactionally at ingest), so this projector is
 * the escalation surface: it guarantees a queryable task exists for compliance.
 *
 * Idempotent: a task is created at most once per screening id, and the cursor
 * only advances past events that were fully handled.
 */
export async function processAmlMatchReview(options: {
  db: Db;
  log: pino.Logger;
  complianceRecipientReader: IComplianceRecipientReader;
  /** When set, an MLRO escalation email is enqueued per flagged screening. */
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  webOrigin?: string | undefined;
  adminEmailAddress?: string | undefined;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, webOrigin, adminEmailAddress } = options;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const adminReviewUrl = `${base}/admin/compliance/aml`;

  await db
    .insert(projectorState)
    .values({ projectorName: AML_MATCH_REVIEW_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, AML_MATCH_REVIEW_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "aml.match_flagged")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as AmlMatchFlaggedPayload;
      const screeningId = payload.screeningId ?? row.aggregateId;

      const existing = await db
        .select({ id: adminReviewTask.id })
        .from(adminReviewTask)
        .where(
          and(
            eq(adminReviewTask.kind, "aml_screening_review"),
            sql`${adminReviewTask.payload} ->> 'screeningId' = ${screeningId}`,
          ),
        )
        .limit(1);

      const createdTask = existing.length === 0;
      if (createdTask) {
        await db.insert(adminReviewTask).values({
          kind: "aml_screening_review",
          status: "pending",
          targetLotId: null,
          payload: {
            screeningId,
            userId: payload.userId ?? null,
            providerSessionId: payload.providerSessionId ?? null,
            outcome: payload.outcome ?? null,
            matchStatus: payload.matchStatus ?? null,
            categories: payload.categories ?? null,
            reasons: payload.reasons ?? null,
          },
        });
        log.warn(
          {
            screeningId,
            userId: payload.userId ?? null,
            outcome: payload.outcome ?? null,
            matchStatus: payload.matchStatus ?? null,
          },
          "aml_match_flagged_review_task_created",
        );
      }

      // Active MLRO escalation (CDD Section 5). Idempotent via idempotencyKey so
      // re-processing after a transient failure never double-sends. Only enqueue
      // when a new review task was created (avoids duplicate enqueue on replay).
      if (createdTask && emailService && supportContactEmail) {
        const detail =
          [payload.matchStatus, payload.categories].filter(Boolean).join(" · ") ||
          "Watchlist match flagged";
        const recipients = await options.complianceRecipientReader.listRecipients();
        if (recipients.length > 0) {
          for (const r of recipients) {
            await emailService.enqueue({
              template: "aml-compliance-review-notice",
              to: r.email,
              userId: r.id,
              vars: {
                recipientFirstName: r.firstName,
                kind: "screening",
                caseReference: screeningId,
                detail,
                adminReviewUrl,
                supportContactEmail,
              },
              category: "transactional",
              idempotencyKey: `aml-compliance-review-notice:screening:${screeningId}:${r.id}`,
            });
          }
        } else if (adminEmailAddress) {
          await emailService.enqueue({
            template: "aml-compliance-review-notice",
            to: adminEmailAddress,
            recipientResolution: "snapshot",
            vars: {
              recipientFirstName: "Compliance",
              kind: "screening",
              caseReference: screeningId,
              detail,
              adminReviewUrl,
              supportContactEmail,
            },
            category: "transactional",
            idempotencyKey: `aml-compliance-review-notice:screening:${screeningId}:admin`,
          });
        }
      }
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "aml_match_review_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, AML_MATCH_REVIEW_PROJECTOR));
  }
}
