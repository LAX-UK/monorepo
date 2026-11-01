import { changesRequestedCopy } from "@/lib/seller/consignment-changes-copy";
import { formatDate } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import { ButtonLink } from "@auction/ui/lax";
import { MessageSquareText } from "lucide-react";
import Link from "next/link";

type Props = {
  submission: Pick<ItemSubmission, "status" | "changesRequestedNote" | "changesRequestedAt">;
  /** The member who sent the work, named to people who cannot make the changes themselves. */
  sentBy: string | null;
  /** Where "Make changes" leads; `null` for a member whose role may only read. */
  editHref: string | null;
};

/**
 * "Needs changes": the specialist's request, word for word, and the one way to answer it. The
 * consignment stays a record; "Make changes" opens the form on its own page. Members who can
 * only read are told who is making the changes.
 */
export function SubmissionChangesRequestedPanel({ submission, sentBy, editHref }: Props) {
  if (submission.status !== "changes_requested") return null;
  const { lead } = changesRequestedCopy({ canEdit: editHref !== null, sentBy });
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
          <p className="font-body text-sm text-on-surface-variant">{lead}</p>
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
        {editHref ? (
          <ButtonLink href={editHref} Link={Link} variant="primary" className="w-full sm:w-auto">
            Make changes
          </ButtonLink>
        ) : null}
      </Surface>
    </section>
  );
}
