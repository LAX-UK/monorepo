import type { ItemSubmission } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  submission: Pick<ItemSubmission, "status" | "rejectionReason" | "reviewNotes" | "id">;
};

export function SubmissionRejectionPanel({ submission }: Props) {
  if (submission.status !== "rejected") return null;

  return (
    <div className="space-y-4 rounded-lg border border-error/30 bg-error-container/10 p-4">
      <h3 className="font-headline text-base text-on-surface">Submission not accepted</h3>
      {submission.rejectionReason ? (
        <p className="font-body text-sm text-on-surface">
          <span className="font-semibold">Reason: </span>
          {submission.rejectionReason}
        </p>
      ) : null}
      {submission.reviewNotes ? (
        <p className="font-body text-sm text-on-surface-variant">{submission.reviewNotes}</p>
      ) : null}
      <p className="font-body text-sm text-on-surface-variant">
        You can submit a new item with updated information. Our team will review it again.
      </p>
      <Button asChild variant="cta">
        <Link href={`/dashboard/submissions/new?fromRejected=${encodeURIComponent(submission.id)}`}>
          Resubmit with updates
        </Link>
      </Button>
    </div>
  );
}
