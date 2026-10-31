import { formatDate } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import { MessageSquareText } from "lucide-react";

type Props = {
  submission: Pick<ItemSubmission, "status" | "changesRequestedNote" | "changesRequestedAt">;
};

/**
 * "Needs changes": the specialist's note, word for word, and what to do next. The form below
 * edits the same submission, which goes back to the specialist with its history.
 */
export function SubmissionChangesRequestedPanel({ submission }: Props) {
  if (submission.status !== "changes_requested") return null;
  return (
    <section aria-labelledby="changes-requested-heading" data-testid="changes-requested">
      <Surface variant="section" className="space-y-4 border-warning/50 bg-warning-container/20">
        <div className="space-y-1">
          <h2
            id="changes-requested-heading"
            className="font-headline text-lg font-semibold tracking-tight text-on-surface"
          >
            Your specialist asked for changes
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Update the details below and send it back. It keeps its place and its history.
          </p>
        </div>
        {submission.changesRequestedNote ? (
          <figure className="flex gap-3 rounded-lg bg-surface-container-lowest p-4">
            <MessageSquareText
              className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <blockquote className="whitespace-pre-line font-body text-sm text-on-surface">
                {submission.changesRequestedNote}
              </blockquote>
              <figcaption className="font-body text-xs text-on-surface-variant">
                Specialist
                {submission.changesRequestedAt
                  ? ` · ${formatDate(submission.changesRequestedAt)}`
                  : ""}
              </figcaption>
            </div>
          </figure>
        ) : null}
      </Surface>
    </section>
  );
}
