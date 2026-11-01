import type { DisputeDeskCase, DisputeDeskTimelineEntry } from "@auction/types";

type TimelineFacts = Pick<
  DisputeDeskCase,
  | "status"
  | "amountPence"
  | "openedAt"
  | "closedAt"
  | "fundsWithdrawnAt"
  | "fundsReinstatedAt"
  | "allocations"
>;

/**
 * What has happened to a case, newest first, read from the case's own facts: when Stripe opened
 * it, moved the funds and closed it, and when and by whom it was put on its invoices.
 */
export function buildDisputeTimeline(facts: TimelineFacts): DisputeDeskTimelineEntry[] {
  const entries: DisputeDeskTimelineEntry[] = [
    { id: "opened", kind: "opened", at: facts.openedAt, actor: "Stripe" },
  ];
  if (facts.fundsWithdrawnAt) {
    entries.push({
      id: "funds_withdrawn",
      kind: "funds_withdrawn",
      at: facts.fundsWithdrawnAt,
      actor: "Stripe",
      amountPence: facts.amountPence,
    });
  }
  if (facts.fundsReinstatedAt) {
    entries.push({
      id: "funds_reinstated",
      kind: "funds_reinstated",
      at: facts.fundsReinstatedAt,
      actor: "Stripe",
      amountPence: facts.amountPence,
    });
  }
  const [firstLine] = facts.allocations;
  if (firstLine) {
    const byStaff = firstLine.source === "staff";
    entries.push({
      id: "allocated",
      kind: byStaff ? "allocated_by_staff" : "allocated_automatically",
      at: firstLine.allocatedAt,
      actor: byStaff ? (firstLine.allocatedByName ?? "Finance") : "Bid",
      invoiceCount: facts.allocations.length,
    });
  }
  if (facts.closedAt) {
    entries.push({ id: "closed", kind: "closed", at: facts.closedAt, actor: "Stripe" });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
