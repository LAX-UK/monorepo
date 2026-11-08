import type { PrivateSaleDealStage } from "@auction/types";

/** The lists staff work from, in the order they are offered. */
export const DEAL_VIEWS = [
  "active",
  "needs_me",
  "waiting_on_checks",
  "payment_due",
  "settled",
  "cancelled",
  "all",
] as const;
export type DealView = (typeof DEAL_VIEWS)[number];

export const DEFAULT_DEAL_VIEW: DealView = "active";

/** What a view selects, and how it is ordered. */
export type DealViewCriteria = {
  /** Null for every stage. */
  stages: readonly PrivateSaleDealStage[] | null;
  /** Only deals the viewer owns. */
  ownedByViewer: boolean;
  /** Working views show the deal that has waited longest first; archives show the latest first. */
  order: "oldest_first" | "newest_first";
};

/** A deal that has ended: sold and paid out, or cancelled. */
export const CLOSED_DEAL_STAGES: readonly PrivateSaleDealStage[] = ["settled", "cancelled"];

export const isDealClosed = (stage: PrivateSaleDealStage): boolean =>
  CLOSED_DEAL_STAGES.includes(stage);

/** Stages in which a deal still needs someone to move it on. */
export const OPEN_DEAL_STAGES: readonly PrivateSaleDealStage[] = [
  "proposed",
  "offer",
  "agreed",
  "cleared",
  "invoiced",
  "paid",
  "released",
];

const WORKING = { order: "oldest_first" } as const;

const VIEW_CRITERIA: Readonly<Record<DealView, DealViewCriteria>> = {
  active: { ...WORKING, stages: OPEN_DEAL_STAGES, ownedByViewer: false },
  needs_me: { ...WORKING, stages: OPEN_DEAL_STAGES, ownedByViewer: true },
  // Agreed, and not yet cleared: waiting on identity, screening or source of funds.
  waiting_on_checks: { ...WORKING, stages: ["agreed"], ownedByViewer: false },
  payment_due: { ...WORKING, stages: ["invoiced"], ownedByViewer: false },
  settled: { order: "newest_first", stages: ["settled"], ownedByViewer: false },
  cancelled: { order: "newest_first", stages: ["cancelled"], ownedByViewer: false },
  all: { order: "newest_first", stages: null, ownedByViewer: false },
};

export function dealViewCriteria(view: DealView): DealViewCriteria {
  return VIEW_CRITERIA[view];
}

/**
 * Which deals a person may see at all. Those who run every deal see them all; a specialist sees
 * the deals they own; fulfilment sees only the deals that are paid and waiting to be handed over.
 */
export type DealScope =
  | { kind: "all" }
  | { kind: "owned"; userId: string }
  | { kind: "stages"; stages: readonly PrivateSaleDealStage[] };

/** Stages in which a paid work is waiting to be handed over. */
export const RELEASE_READY_STAGES: readonly PrivateSaleDealStage[] = ["paid"];

/** Whether a deal is inside a person's scope. */
export function dealInScope(
  deal: { stage: PrivateSaleDealStage; ownerUserId: string | null },
  scope: DealScope,
): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "owned") return deal.ownerUserId === scope.userId;
  return scope.stages.includes(deal.stage);
}

/** Deals per stage, and how many of them the viewer owns. */
export type DealStageCount = { stage: PrivateSaleDealStage; total: number; ownedByViewer: number };

/** How many deals each view holds, from the counts per stage. */
export function dealViewCounts(rows: readonly DealStageCount[]): Record<DealView, number> {
  const counts = {} as Record<DealView, number>;
  for (const view of DEAL_VIEWS) {
    const { stages, ownedByViewer } = VIEW_CRITERIA[view];
    counts[view] = rows
      .filter((row) => !stages || stages.includes(row.stage))
      .reduce((sum, row) => sum + (ownedByViewer ? row.ownedByViewer : row.total), 0);
  }
  return counts;
}

/** Whether a deal in `stage`, owned by `ownerUserId`, belongs to `view` for `viewerUserId`. */
export function dealIsInView(
  view: DealView,
  deal: { stage: PrivateSaleDealStage; ownerUserId: string | null },
  viewerUserId: string,
): boolean {
  const criteria = VIEW_CRITERIA[view];
  if (criteria.stages && !criteria.stages.includes(deal.stage)) return false;
  return !criteria.ownedByViewer || deal.ownerUserId === viewerUserId;
}
