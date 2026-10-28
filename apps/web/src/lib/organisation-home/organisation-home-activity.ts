import type { HomeActivityEvent } from "@auction/domain";
import type { ItemSubmission, Lot, PortfolioRow } from "@auction/types";

/** What the organisation's lists already say happened; Home turns it into recent activity. */
export type HomeActivitySources = {
  submissions: readonly Pick<
    ItemSubmission,
    "id" | "title" | "status" | "createdAt" | "reviewedAt" | "changesRequestedAt"
  >[];
  lots: readonly Pick<Lot, "id" | "title" | "status" | "winnerId" | "endTime">[];
  purchases: readonly Pick<PortfolioRow, "lot">[];
  /** Members who joined, from the Members list. */
  members: readonly { id: string; name: string; acceptedAt: Date | null; invited: boolean }[];
};

const SENT = new Set<ItemSubmission["status"]>([
  "submitted",
  "under_review",
  "approved",
  "changes_requested",
  "converted",
  "rejected",
]);

function submissionEvents(sources: HomeActivitySources): HomeActivityEvent[] {
  return sources.submissions.flatMap((s) => {
    const subject = { id: s.id, title: s.title };
    const events: HomeActivityEvent[] = [];
    if (SENT.has(s.status)) events.push({ kind: "submission_sent", at: s.createdAt, subject });
    if (s.status === "changes_requested" && s.changesRequestedAt) {
      events.push({ kind: "changes_requested", at: s.changesRequestedAt, subject });
    }
    if ((s.status === "approved" || s.status === "converted") && s.reviewedAt) {
      events.push({ kind: "submission_accepted", at: s.reviewedAt, subject });
    }
    return events;
  });
}

function lotEvents(sources: HomeActivitySources): HomeActivityEvent[] {
  return sources.lots
    .filter((lot) => lot.status === "ended")
    .map((lot) => ({
      kind: lot.winnerId ? ("lot_sold" as const) : ("lot_unsold" as const),
      at: lot.endTime,
      subject: { id: lot.id, title: lot.title },
    }));
}

/**
 * Recent activity from data Home loads anyway. Who may see each line is decided by the domain
 * (`homeActivity`), not here.
 */
export function homeActivityEvents(sources: HomeActivitySources): HomeActivityEvent[] {
  return [
    ...submissionEvents(sources),
    ...lotEvents(sources),
    ...sources.purchases.map(({ lot }) => ({
      kind: "purchase_won" as const,
      at: lot.endTime,
      subject: { id: lot.id, title: lot.title },
    })),
    ...sources.members
      .filter((member) => member.invited && member.acceptedAt)
      .map((member) => ({
        kind: "member_joined" as const,
        at: member.acceptedAt as Date,
        subject: { id: member.id, title: member.name },
      })),
  ];
}
