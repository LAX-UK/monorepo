import {
  SELLER_SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_HINTS,
} from "@/lib/marketing/sell-flow-copy";
import type { ItemSubmissionStatus } from "@auction/types";

type Props = {
  status: ItemSubmissionStatus;
};

/** One-line contextual status under the lifecycle timeline on read-only detail pages. */
export function SubmissionStatusHint({ status }: Props) {
  const hint = SUBMISSION_STATUS_HINTS[status];
  if (!hint) return null;

  return (
    <p className="font-body text-sm text-on-surface-variant" data-testid="submission-status-hint">
      <span className="font-medium text-on-surface">{SELLER_SUBMISSION_STATUS_LABELS[status]}</span>
      {" — "}
      {hint}
    </p>
  );
}
