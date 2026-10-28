import { canSeeSubmission, submissionSenderScope } from "@auction/domain";
import type { SubmissionSenderFilter } from "@auction/persistence/interfaces";
import type { ItemSubmission } from "@auction/types";
import type { SubmissionLegalEntityContext } from "../interfaces/submission-routes/submission-route-http.js";

/**
 * The list filter for the signed-in member, from the domain rule (`submissionSenderScope`).
 * `undefined` when the member sees every submission, so lists stay unfiltered.
 */
export function submissionSenderFilter(
  legalEntity: SubmissionLegalEntityContext,
): SubmissionSenderFilter | undefined {
  if (!legalEntity.member) return undefined;
  const scope = submissionSenderScope(legalEntity.member.actor);
  return scope === "all" ? undefined : { scope, userId: legalEntity.member.userId };
}

/** Whether the signed-in member may open one submission of the account. */
export function memberCanSeeSubmission(
  legalEntity: SubmissionLegalEntityContext,
  submission: Pick<ItemSubmission, "submittedByUserId">,
): boolean {
  if (!legalEntity.member) return true;
  return canSeeSubmission({
    scope: submissionSenderScope(legalEntity.member.actor),
    submittedByUserId: submission.submittedByUserId,
    viewerUserId: legalEntity.member.userId,
  });
}
