import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionTransition =
  | "submit"
  | "startReview"
  | "accept"
  | "reject"
  | "requestChanges"
  | "resubmit"
  | "convert"
  | "withdraw";

type TransitionRule = {
  from: readonly ItemSubmissionStatus[];
  to: ItemSubmissionStatus;
  error: string;
};

/**
 * Every move a submission can make. A specialist who needs more from the seller asks for
 * changes; the seller edits the same submission and sends it back, so it re-enters the queue as
 * submitted rather than starting again.
 */
const TRANSITIONS: Record<SubmissionTransition, TransitionRule> = {
  submit: { from: ["draft"], to: "submitted", error: "Only drafts can be submitted for review" },
  startReview: {
    from: ["submitted"],
    to: "under_review",
    error: "Only submitted items can move to review",
  },
  accept: {
    from: ["under_review"],
    to: "approved",
    error: "Submission must be under review to accept",
  },
  reject: {
    from: ["under_review"],
    to: "rejected",
    error: "Submission must be under review to reject",
  },
  requestChanges: {
    from: ["under_review"],
    to: "changes_requested",
    error: "Changes can only be requested while the submission is under review",
  },
  resubmit: {
    from: ["changes_requested"],
    to: "submitted",
    error: "Only a submission that needs changes can be sent back for review",
  },
  convert: {
    from: ["approved"],
    to: "converted",
    error: "Submission must be accepted before converting to a lot",
  },
  withdraw: {
    from: ["draft", "submitted", "changes_requested"],
    to: "withdrawn",
    error: "This submission cannot be withdrawn",
  },
};

export function canTransition(from: ItemSubmissionStatus, action: SubmissionTransition): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(
  from: ItemSubmissionStatus,
  action: SubmissionTransition,
): ItemSubmissionStatus {
  if (!canTransition(from, action)) {
    throw new Error(`Invalid transition: ${action} from ${from}`);
  }
  return TRANSITIONS[action].to;
}

export function transitionErrorMessage(
  _from: ItemSubmissionStatus,
  action: SubmissionTransition,
): string {
  return TRANSITIONS[action].error;
}

/** Statuses in which the seller may still change what they told us. */
const SELLER_EDITABLE_STATUSES: ReadonlySet<ItemSubmissionStatus> = new Set([
  "draft",
  "changes_requested",
]);

export function sellerCanEditSubmission(status: ItemSubmissionStatus): boolean {
  return SELLER_EDITABLE_STATUSES.has(status);
}

/**
 * How the seller's "Submit" moves this submission: a first submission from a draft, or a
 * resubmission after the specialist asked for changes. `null` when it cannot be sent.
 */
export function sellerSubmitTransition(
  status: ItemSubmissionStatus,
): Extract<SubmissionTransition, "submit" | "resubmit"> | null {
  if (canTransition(status, "submit")) return "submit";
  if (canTransition(status, "resubmit")) return "resubmit";
  return null;
}
