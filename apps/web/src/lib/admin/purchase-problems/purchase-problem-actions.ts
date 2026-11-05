import type { PurchaseProblemStatus } from "@auction/domain";

type Record_ = { status: PurchaseProblemStatus; nextStatuses: readonly PurchaseProblemStatus[] };

/** What a person can do on one report: the buttons the record shows, and nothing else. */
export type PurchaseProblemRecordActions = {
  /** Take the report on: in progress, and given to the person when nobody has it. */
  canStart: boolean;
  canResolve: boolean;
  canAssign: boolean;
  canNote: boolean;
};

/**
 * Derived from the domain's own next statuses, so the screen never offers a move the API would
 * refuse. A resolved report can still be noted, but not handed over or moved.
 */
export function purchaseProblemRecordActions(record: Record_): PurchaseProblemRecordActions {
  const next = new Set(record.nextStatuses);
  return {
    canStart: next.has("in_progress"),
    canResolve: next.has("resolved"),
    canAssign: record.status !== "resolved",
    canNote: true,
  };
}
