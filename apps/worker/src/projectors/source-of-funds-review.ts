import { adminReviewTask, domainEvent, projectorState } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, sql } from "drizzle-orm";
import type pino from "pino";
import { listComplianceRecipients } from "../lib/compliance-email-recipients.js";

export const SOURCE_OF_FUNDS_REVIEW_PROJECTOR = "source_of_funds_review";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type SourceOfFundsRequiredPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  trigger?: string;
  thresholdAmount?: string;
  exposureAmount?: string;
  currency?: string;
  reopened?: boolean;
};

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
  log: pino.Logger;
  /** When set, an MLRO escalation email is enqueued per SoF case. */
  emailService?: IEmailService | undefined;
  supportContactEmail?: string | undefined;
  webOrigin?: string | undefined;
  adminEmailAddress?: string | undefined;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, webOrigin, adminEmailAddress } = options;
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

      const reopened = Boolean(payload.reopened);
      const existingTask = existing[0];
      if (existingTask && reopened) {
        await db
          .update(adminReviewTask)
          .set({ status: "pending", resolvedAt: null, resolvedByUserId: null })
          .where(eq(adminReviewTask.id, existingTask.id));
        log.warn({ sourceOfFundsId }, "source_of_funds_review_task_reactivated");
      }

      const createdTask = existing.length === 0;
      if (createdTask) {
        await db.insert(adminReviewTask).values({
          kind: "source_of_funds_review",
          status: "pending",
          targetLotId: null,
          payload: {
            sourceOfFundsId,
            userId: payload.userId ?? null,
            trigger: payload.trigger ?? null,
            thresholdAmount: payload.thresholdAmount ?? null,
            exposureAmount: payload.exposureAmount ?? null,
            currency: payload.currency ?? null,
          },
        });
        log.warn(
          {
            sourceOfFundsId,
            userId: payload.userId ?? null,
            trigger: payload.trigger ?? null,
            exposureAmount: payload.exposureAmount ?? null,
          },
          "source_of_funds_review_task_created",
        );
      }

      // Active MLRO escalation (CDD Section 6). Idempotent via idempotencyKey.
      if (createdTask && emailService && supportContactEmail) {
        const detail =
          [
            payload.trigger ? `Trigger: ${payload.trigger}` : null,
            payload.exposureAmount
              ? `Exposure: ${payload.currency ?? ""} ${payload.exposureAmount}`.trim()
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Source-of-Funds threshold crossed";
        const recipients = await listComplianceRecipients(db);
        if (recipients.length > 0) {
          for (const r of recipients) {
            await emailService.enqueue({
              template: "aml-compliance-review-notice",
              to: r.email,
              userId: r.id,
              vars: {
                recipientFirstName: r.firstName,
                kind: "source_of_funds",
                caseReference: sourceOfFundsId,
                detail,
                adminReviewUrl,
                supportContactEmail,
              },
              category: "transactional",
              idempotencyKey: `aml-compliance-review-notice:sof:${sourceOfFundsId}:${r.id}`,
            });
          }
        } else if (adminEmailAddress) {
          await emailService.enqueue({
            template: "aml-compliance-review-notice",
            to: adminEmailAddress,
            recipientResolution: "snapshot",
            vars: {
              recipientFirstName: "Compliance",
              kind: "source_of_funds",
              caseReference: sourceOfFundsId,
              detail,
              adminReviewUrl,
              supportContactEmail,
            },
            category: "transactional",
            idempotencyKey: `aml-compliance-review-notice:sof:${sourceOfFundsId}:admin`,
          });
        }
      }
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "source_of_funds_review_failed");
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
