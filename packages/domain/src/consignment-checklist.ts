import type { ItemSubmissionStatus, LotStatus } from "@auction/types";

/**
 * "Before your work can go to sale": the three things a seller does after submitting, each
 * asked for only when it is needed.
 */
export type ConsignmentChecklistItemId = "identity" | "agreement" | "payouts";

/**
 * - `done`: ticked off.
 * - `action`: the person looking can do it now.
 * - `waiting`: someone else has to act (LAX checking documents, or another member).
 * - `not_yet`: it cannot be done yet (no terms proposed so far).
 */
export type ConsignmentChecklistItemState = "done" | "action" | "waiting" | "not_yet";

/** When each item is needed by. The date is known only for payouts, once the lot is in a sale. */
export type ConsignmentChecklistDeadline =
  | { kind: "before_specialist_accepts" }
  | { kind: "before_cataloguing" }
  | { kind: "before_sale_live"; date: Date | null };

/** Who or what the item is waiting on, when it is not the person looking. */
export type ConsignmentChecklistWaitingOn =
  | "lax_identity_check"
  | "organisation_acceptor"
  | "organisation_payouts";

export type ConsignmentChecklistItem = {
  id: ConsignmentChecklistItemId;
  state: ConsignmentChecklistItemState;
  deadline: ConsignmentChecklistDeadline;
  waitingOn: ConsignmentChecklistWaitingOn | null;
};

export type ConsignmentChecklist = {
  /** False for drafts, for consignments that ended, and once the lot's sale is live or over. */
  applies: boolean;
  items: ConsignmentChecklistItem[];
  doneCount: number;
  totalCount: number;
  complete: boolean;
};

export type ConsignmentChecklistFacts = {
  submissionStatus: ItemSubmissionStatus;
  /** The status of the consignment's lot, or `null` while it has none. */
  lotStatus: LotStatus | null;
  /** Whose consignment it is. An organisation's identity is checked through its documents. */
  accountKind: "personal" | "organisation";
  /** Identity of the person (personal) or verification of the organisation. */
  identity: "verified" | "checking" | "required";
  agreement: { proposed: boolean; accepted: boolean };
  payoutsReady: boolean;
  /** What the person looking may do, from the capability matrix. */
  viewer: { canAcceptAgreement: boolean; canSetUpPayouts: boolean };
  /** Start of the sale the lot is in, once it has one. */
  saleStartsAt: Date | null;
};

const CHECKLIST_STATUSES: ReadonlySet<ItemSubmissionStatus> = new Set([
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "converted",
]);

/** A lot still on its way to a sale: in preparation or scheduled. Live, ended and cancelled are past it. */
const PRE_SALE_LOT_STATUSES: ReadonlySet<LotStatus> = new Set(["draft", "scheduled"]);

function isPreSale(facts: ConsignmentChecklistFacts): boolean {
  return (
    CHECKLIST_STATUSES.has(facts.submissionStatus) &&
    (facts.lotStatus === null || PRE_SALE_LOT_STATUSES.has(facts.lotStatus))
  );
}

function identityItem(facts: ConsignmentChecklistFacts): ConsignmentChecklistItem {
  const deadline = { kind: "before_specialist_accepts" } as const;
  if (facts.identity === "verified")
    return { id: "identity", state: "done", deadline, waitingOn: null };
  if (facts.identity === "checking") {
    return { id: "identity", state: "waiting", deadline, waitingOn: "lax_identity_check" };
  }
  return { id: "identity", state: "action", deadline, waitingOn: null };
}

function agreementItem(facts: ConsignmentChecklistFacts): ConsignmentChecklistItem {
  const deadline = { kind: "before_cataloguing" } as const;
  if (facts.agreement.accepted)
    return { id: "agreement", state: "done", deadline, waitingOn: null };
  if (!facts.agreement.proposed) {
    return { id: "agreement", state: "not_yet", deadline, waitingOn: null };
  }
  if (facts.viewer.canAcceptAgreement) {
    return { id: "agreement", state: "action", deadline, waitingOn: null };
  }
  return { id: "agreement", state: "waiting", deadline, waitingOn: "organisation_acceptor" };
}

function payoutsItem(facts: ConsignmentChecklistFacts): ConsignmentChecklistItem {
  const deadline = { kind: "before_sale_live", date: facts.saleStartsAt } as const;
  if (facts.payoutsReady) return { id: "payouts", state: "done", deadline, waitingOn: null };
  if (facts.viewer.canSetUpPayouts) {
    return { id: "payouts", state: "action", deadline, waitingOn: null };
  }
  return { id: "payouts", state: "waiting", deadline, waitingOn: "organisation_payouts" };
}

/** Computes the checklist for one consignment from facts alone. */
export function computeConsignmentChecklist(
  facts: ConsignmentChecklistFacts,
): ConsignmentChecklist {
  const items = [identityItem(facts), agreementItem(facts), payoutsItem(facts)];
  const doneCount = items.filter((item) => item.state === "done").length;
  return {
    applies: isPreSale(facts),
    items,
    doneCount,
    totalCount: items.length,
    complete: doneCount === items.length,
  };
}

export type ConsignmentChecklistRollupItem = {
  id: ConsignmentChecklistItemId;
  state: Extract<ConsignmentChecklistItemState, "action" | "waiting">;
  waitingOn: ConsignmentChecklistWaitingOn | null;
  consignments: { id: string; title: string }[];
};

const ROLLUP_ORDER: Record<ConsignmentChecklistItemId, number> = {
  identity: 0,
  agreement: 1,
  payouts: 2,
};

/**
 * The open items across every consignment, for the Selling overview: one line per item and
 * state, naming the consignments it concerns. Things the person can do come before things
 * they are waiting on.
 */
export function rollupConsignmentChecklists(
  consignments: ReadonlyArray<{ id: string; title: string; checklist: ConsignmentChecklist }>,
): ConsignmentChecklistRollupItem[] {
  const byKey = new Map<string, ConsignmentChecklistRollupItem>();
  for (const consignment of consignments) {
    if (!consignment.checklist.applies) continue;
    for (const item of consignment.checklist.items) {
      if (item.state !== "action" && item.state !== "waiting") continue;
      const key = `${item.id}:${item.state}`;
      const existing = byKey.get(key);
      const ref = { id: consignment.id, title: consignment.title };
      if (existing) existing.consignments.push(ref);
      else {
        byKey.set(key, {
          id: item.id,
          state: item.state,
          waitingOn: item.waitingOn,
          consignments: [ref],
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.state !== b.state) return a.state === "action" ? -1 : 1;
    return ROLLUP_ORDER[a.id] - ROLLUP_ORDER[b.id];
  });
}
