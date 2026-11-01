import { changesRequestedCopy } from "@/lib/seller/consignment-changes-copy";
import { formatDate } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
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
    <section
      aria-labelledby="changes-requested-heading"
      data-testid="changes-requested"
      className="rounded-lax-card border border-lax-line bg-lax-surface p-5"
    >
      <h2
        id="changes-requested-heading"
        className="font-lax-display text-lax-18 font-semibold text-lax-fg"
      >
        Your specialist asked for changes
      </h2>
      <p className="mt-1 text-lax-14 leading-5 text-lax-muted">{lead}</p>
      {submission.changesRequestedNote ? (
        <figure className="mt-4 flex gap-3 rounded-lax-card bg-lax-sunken p-4">
          <MessageSquareText aria-hidden className="mt-0.5 size-4 shrink-0 text-lax-muted" />
          <div className="min-w-0 space-y-1">
            <blockquote className="whitespace-pre-line text-lax-14 leading-5 text-lax-fg">
              {submission.changesRequestedNote}
            </blockquote>
            <figcaption className="text-lax-13 text-lax-muted">
              Specialist
              {submission.changesRequestedAt
                ? ` · ${formatDate(submission.changesRequestedAt)}`
                : ""}
            </figcaption>
          </div>
        </figure>
      ) : null}
      {editHref ? (
        <ButtonLink href={editHref} Link={Link} variant="primary" className="mt-4 w-full sm:w-auto">
          Make changes
        </ButtonLink>
      ) : null}
    </section>
  );
}
