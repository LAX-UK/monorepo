import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionTransition =
  | "submit"
  | "startReview"
  | "accept"
  | "reject"
  | "convert"
  | "withdraw";

const TRANSITIONS: Record<
  SubmissionTransition,
  { from: ItemSubmissionStatus[]; to: ItemSubmissionStatus }
> = {
  submit: { from: ["draft"], to: "submitted" },
  startReview: { from: ["submitted"], to: "under_review" },
  accept: { from: ["under_review"], to: "approved" },
  reject: { from: ["under_review"], to: "rejected" },
  convert: { from: ["approved"], to: "converted" },
  withdraw: { from: ["draft", "submitted"], to: "withdrawn" },
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
  from: ItemSubmissionStatus,
  action: SubmissionTransition,
): string {
  switch (action) {
    case "submit":
      return "Only drafts can be submitted for review";
    case "startReview":
      return "Only submitted items can move to review";
    case "accept":
      return "Submission must be under review to accept";
    case "reject":
      return "Submission must be under review to reject";
    case "convert":
      return "Submission must be accepted before converting to a lot";
    case "withdraw":
      return "This submission cannot be withdrawn";
    default:
      return `Cannot ${action} from status ${from}`;
  }
}
