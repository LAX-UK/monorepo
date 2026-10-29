import {
  type EntityActor,
  type SubmissionMutation,
  canTransition,
  sellerCanEditSubmission,
  submissionMutationPolicy,
} from "@auction/domain";
import type { ItemSubmission } from "@auction/types";

/** What the consignment page offers this person, from the submission's state and who they are. */
export type ConsignmentActionsVm = {
  /** Edit the submission (the wizard); otherwise it is shown read-only. */
  canEdit: boolean;
  /** Send a draft to the specialist. */
  canSubmit: boolean;
  /** Take the submission back before it is catalogued (their own, or any for owners and admins). */
  canWithdraw: boolean;
  /** Add and remove supporting documents. */
  canManageDocuments: boolean;
};

/**
 * The page asks the same submission policy as the API, so it never offers a change the server
 * would refuse: the state machine says whether the submission can change, the policy whether
 * this person may change it.
 */
export function consignmentActionsVm(input: {
  /** `null` for the holder of a person's own account. */
  actor: { userId: string; member: EntityActor } | null;
  submission: Pick<ItemSubmission, "status" | "submittedByUserId">;
}): ConsignmentActionsVm {
  const may = (mutation: SubmissionMutation) =>
    submissionMutationPolicy(input.actor, input.submission, mutation).allowed;
  const { status } = input.submission;
  return {
    canEdit: sellerCanEditSubmission(status) && may("edit"),
    canSubmit: status === "draft" && may("submit"),
    canWithdraw: canTransition(status, "withdraw") && may("withdraw"),
    canManageDocuments: may("attach_document"),
  };
}
