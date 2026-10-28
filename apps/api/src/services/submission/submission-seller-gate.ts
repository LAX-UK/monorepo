import { sellerSubmissionAccess } from "@auction/domain";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

type SellerWrite = "draft" | "submit";

/**
 * Whether the account may write submissions: `draft` to create and edit, `submit` to send one
 * to a specialist. An organisation still under review may prepare drafts but not submit them.
 */
export async function assertSellerEntityAllows(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  write: SellerWrite,
): Promise<Result<void, SubmissionError>> {
  if (!deps.legalEntityRepository) return ok(undefined);
  const e = await deps.legalEntityRepository.findById(legalEntityId);
  if (!e) return err(new SubmissionError("Not found", 404));
  const access = sellerSubmissionAccess(e);
  const allowed = write === "draft" ? access.canDraft : access.canSubmit;
  if (allowed) return ok(undefined);
  if (e.kind === "individual") {
    return err(
      new SubmissionError(
        "Your account cannot submit items in its current verification state",
        403,
      ),
    );
  }
  return err(
    new SubmissionError(
      access.submitBlockedReason ??
        "This organisation is not permitted to create or edit submissions in its current verification state",
      403,
    ),
  );
}

/** Creating and editing drafts. */
export function assertSellerEntityAllowsSubmissions(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
): Promise<Result<void, SubmissionError>> {
  return assertSellerEntityAllows(deps, legalEntityId, "draft");
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
