import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import {
  INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES,
  type ItemSubmissionServiceDeps,
  SELLER_ENTITY_WRITE_STATUSES,
} from "./submission-types.js";

export async function assertSellerEntityAllowsSubmissions(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
): Promise<Result<void, SubmissionError>> {
  if (!deps.legalEntityRepository) return ok(undefined);
  const e = await deps.legalEntityRepository.findById(legalEntityId);
  if (!e) return err(new SubmissionError("Not found", 404));
  if (e.kind === "individual") {
    if (INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES.has(e.status)) {
      return err(
        new SubmissionError(
          "Your account cannot submit items in its current verification state",
          403,
        ),
      );
    }
    return ok(undefined);
  }
  if (!SELLER_ENTITY_WRITE_STATUSES.has(e.status)) {
    return err(
      new SubmissionError(
        "This organisation is not permitted to create or edit submissions in its current verification state",
        403,
      ),
    );
  }
  return ok(undefined);
}

export async function maybeLogRestrictedSellerWrite(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  submissionId: string,
  action: string,
): Promise<void> {
  if (!deps.legalEntityRepository || !deps.domainEventSink) return;
  const e = await deps.legalEntityRepository.findById(legalEntityId);
  if (e?.status !== "restricted") return;
  await deps.domainEventSink.publish({
    aggregateType: "item_submission",
    aggregateId: submissionId,
    eventType: "item_submission.restricted_entity_write",
    payload: { legalEntityId, submissionId, action },
    actorUserId: null,
    actingLegalEntityId: legalEntityId,
    schemaVersion: 1,
  });
}
