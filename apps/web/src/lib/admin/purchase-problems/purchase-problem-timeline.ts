import type { PurchaseProblemView } from "@/lib/data/http/admin-purchase-problems.schema";
import type { TimelineEvent } from "@auction/staff-ui";

/**
 * The record's own history, newest first: when the buyer reported it, each note, and how it
 * ended. Who took it on and every status change are domain events and appear in the Audit log.
 */
export function purchaseProblemTimeline(
  problem: Pick<PurchaseProblemView, "raisedAt" | "notes" | "resolvedAt" | "resolvedByUserId">,
  nameOf: (userId: string | null) => string | undefined,
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { id: "reported", title: "Reported by the buyer", at: problem.raisedAt },
    ...problem.notes.map((note) => {
      const actor = nameOf(note.authorUserId);
      return {
        id: `note-${note.id}`,
        title: "Note added",
        at: note.createdAt,
        ...(actor ? { actor } : {}),
      };
    }),
  ];
  if (problem.resolvedAt) {
    const actor = nameOf(problem.resolvedByUserId);
    events.push({
      id: "resolved",
      title: "Resolved",
      at: problem.resolvedAt,
      tone: "success",
      ...(actor ? { actor } : {}),
    });
  }
  // A note made as the report was resolved shares its moment: the outcome reads last, on top.
  return events.sort((a, b) => b.at.localeCompare(a.at) || (a.id === "resolved" ? -1 : 1));
}
