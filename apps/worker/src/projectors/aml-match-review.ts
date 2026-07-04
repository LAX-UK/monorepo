import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const AML_MATCH_REVIEW_PROJECTOR = "aml_match_review";

type AmlMatchFlaggedPayload = {
  screeningId?: string;
  userId?: string;
  providerSessionId?: string;
  outcome?: string;
  matchStatus?: string;
  categories?: string;
  reasons?: string;
};

export async function processAmlMatchReview(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    adminReviewTaskProjectorRepo,
    emailService,
    supportContactEmail,
    webOrigin,
    adminEmailAddress,
    complianceRecipientReader,
  } = ctx;
  const base = webOrigin?.replace(/\/$/, "") ?? "";
  const adminReviewUrl = `${base}/admin/compliance/aml`;

  const cursor = await projectorStateRepo.getCursor(AML_MATCH_REVIEW_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["aml.match_flagged"],
    limit: 50,
  });

  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = (row.payload ?? {}) as AmlMatchFlaggedPayload;
      const screeningId = payload.screeningId ?? row.aggregateId;

      const existing = await adminReviewTaskProjectorRepo.findAmlScreeningReview(screeningId);

      const createdTask = existing == null;
      if (createdTask) {
        await adminReviewTaskProjectorRepo.createAmlScreeningReview({
          screeningId,
          userId: payload.userId ?? null,
          providerSessionId: payload.providerSessionId ?? null,
          outcome: payload.outcome ?? null,
          matchStatus: payload.matchStatus ?? null,
          categories: payload.categories ?? null,
          reasons: payload.reasons ?? null,
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

      if (createdTask && emailService && supportContactEmail) {
        const detail =
          [payload.matchStatus, payload.categories].filter(Boolean).join(" · ") ||
          "Watchlist match flagged";
        const recipients = await complianceRecipientReader.listRecipients();
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
    await projectorStateRepo.advanceCursor(AML_MATCH_REVIEW_PROJECTOR, maxId);
  }
}
