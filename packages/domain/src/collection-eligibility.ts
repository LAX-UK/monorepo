import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { accountPurchaseScope } from "./account-buying-scope.js";
import { MAX_LOTS_PER_COLLECTION } from "./collection-rules.js";
import type { EntityActor } from "./entity-capabilities.js";

/** A check that holds a purchase until staff or the buyer finish it. */
export type CollectionCheck = "identity" | "source_of_funds" | "finance";

/** How the lot is being fulfilled, as far as collection needs to know. */
export type CollectionFulfilment = "none" | "cancelled" | "collected" | "courier" | "shipper";

/** What decides whether one paid lot can be booked for collection. */
export type CollectionLotFacts = {
  /** Card captured, or bank transfer reconciled in full. */
  paymentCleared: boolean;
  openChecks: readonly CollectionCheck[];
  /** The buying organisation's status; `null` for a personal account. */
  organisationStatus: LegalEntityStatus | null;
  disputeOpen: boolean;
  refundOpen: boolean;
  fulfilment: CollectionFulfilment;
  /** The booking already holding this lot, if any. A lot is in at most one active booking. */
  activeBookingId: string | null;
};

export type CollectionBlockReason =
  | "payment_not_cleared"
  | "identity_check_open"
  | "source_of_funds_check_open"
  | "finance_check_open"
  | "organisation_restricted"
  | "dispute_open"
  | "refund_open"
  | "lot_cancelled"
  | "lot_collected"
  | "lot_delivery_arranged"
  | "already_booked";

type BlockRule = {
  reason: CollectionBlockReason;
  /** What the buyer reads next to the lot. */
  message: string;
  blocks: (facts: CollectionLotFacts) => boolean;
};

const BLOCKED_STATUSES: readonly LegalEntityStatus[] = ["restricted", "rejected", "archived"];
const hasCheck = (facts: CollectionLotFacts, check: CollectionCheck) =>
  facts.openChecks.includes(check);

/**
 * The one table of why a paid lot cannot be booked, in the order the buyer should hear it. A new
 * reason is a new row; nothing else changes.
 */
const BLOCK_RULES: readonly BlockRule[] = [
  {
    reason: "lot_cancelled",
    message: "This sale was cancelled, so there is nothing to collect.",
    blocks: (f) => f.fulfilment === "cancelled",
  },
  {
    reason: "lot_collected",
    message: "This lot has already been collected.",
    blocks: (f) => f.fulfilment === "collected",
  },
  {
    reason: "lot_delivery_arranged",
    message: "Delivery is arranged for this lot, so it cannot also be collected.",
    blocks: (f) => f.fulfilment === "courier" || f.fulfilment === "shipper",
  },
  {
    reason: "already_booked",
    message: "This lot is already in a collection booking.",
    blocks: (f) => f.activeBookingId !== null,
  },
  {
    reason: "payment_not_cleared",
    message: "Not paid yet. Collection opens once payment has cleared.",
    blocks: (f) => !f.paymentCleared,
  },
  {
    reason: "identity_check_open",
    message:
      "Collection opens once we've finished checking your identity. We'll email you as soon as you can book.",
    blocks: (f) => hasCheck(f, "identity"),
  },
  {
    reason: "source_of_funds_check_open",
    message:
      "Collection and delivery open once we've finished checking the source of funds for this purchase. We'll email you as soon as you can book.",
    blocks: (f) => hasCheck(f, "source_of_funds"),
  },
  {
    reason: "finance_check_open",
    message:
      "Collection opens once our finance team has finished a check on this purchase. We'll email you as soon as you can book.",
    blocks: (f) => hasCheck(f, "finance"),
  },
  {
    reason: "organisation_restricted",
    message: "Collection is paused for this organisation. Contact client services.",
    blocks: (f) => f.organisationStatus !== null && BLOCKED_STATUSES.includes(f.organisationStatus),
  },
  {
    reason: "dispute_open",
    message: "Collection opens once the dispute on this purchase is resolved.",
    blocks: (f) => f.disputeOpen,
  },
  {
    reason: "refund_open",
    message: "Collection is not available while a refund on this purchase is open.",
    blocks: (f) => f.refundOpen,
  },
];

export type CollectionEligibility =
  | { eligible: true }
  | { eligible: false; reason: CollectionBlockReason };

/** Whether a paid lot can be booked, or the first reason it cannot. */
export function collectionEligibility(facts: CollectionLotFacts): CollectionEligibility {
  const rule = BLOCK_RULES.find((r) => r.blocks(facts));
  return rule ? { eligible: false, reason: rule.reason } : { eligible: true };
}

/** The sentence the page shows for a blocked lot. */
export function collectionBlockMessage(reason: CollectionBlockReason): string {
  const rule = BLOCK_RULES.find((r) => r.reason === reason);
  return rule ? rule.message : "This lot cannot be collected yet.";
}

export type BookerRefusal =
  /** A personal purchase is booked only by the person who won it. */
  | "not_winner"
  /** The person does not belong to the organisation the lot was won for. */
  | "not_member"
  /** The member neither handles the organisation's money nor won this lot. */
  | "not_booker"
  /** A platform admin viewing as the organisation only reads. */
  | "read_only";

export type BookerDecision = { allowed: true } | { allowed: false; reason: BookerRefusal };

export type CollectionBookerInput = {
  /** A platform admin acting as the account, whatever its kind: always read-only. */
  isImpersonation?: boolean | undefined;
  userId: string;
  accountKind: LegalEntityKind;
  /** The person whose bid won the lot; `null` while it has no winner. */
  winnerId: string | null;
  /** The person's active membership of the organisation; `null` if they have none. */
  membership: EntityActor | null;
};

const ALLOWED: BookerDecision = { allowed: true };
const refuse = (reason: BookerRefusal): BookerDecision => ({ allowed: false, reason });

/**
 * Who may book a paid lot for collection. A personal account: the person who won. An
 * organisation: its owners, admins and finance for any paid lot (the people who see its
 * purchases), and a buyer agent for the lots they won themselves. Other members and removed
 * members cannot; an impersonating platform admin only reads.
 */
export function collectionBooker(input: CollectionBookerInput): BookerDecision {
  const { userId, accountKind, winnerId, membership } = input;
  if (input.isImpersonation === true) return refuse("read_only");
  if (accountKind === "individual") {
    return winnerId !== null && winnerId === userId ? ALLOWED : refuse("not_winner");
  }
  if (!membership) return refuse("not_member");
  if (membership.isImpersonation) return refuse("read_only");
  const scope = accountPurchaseScope(membership);
  if (scope === "all") return ALLOWED;
  if (scope === "own" && winnerId !== null && winnerId === userId) return ALLOWED;
  return refuse("not_booker");
}

/** A lot in a booking request, as far as the selection rules need to know it. */
export type CollectionSelectionLot = {
  lotId: string;
  /** The account that bought it. */
  accountId: string;
  /** The place it is collected from. */
  placeId: string;
};

export type LotSelectionRefusal =
  | "no_lots"
  | "too_many_lots"
  | "duplicate_lots"
  | "mixed_accounts"
  | "mixed_places";

/**
 * Whether these lots can share one visit: between 1 and 20, each once, all bought by the same
 * account and collected from the same place. Returns the first reason they cannot.
 */
export function lotSelectionRefusal(
  lots: readonly CollectionSelectionLot[],
  max: number = MAX_LOTS_PER_COLLECTION,
): LotSelectionRefusal | null {
  if (lots.length === 0) return "no_lots";
  if (lots.length > max) return "too_many_lots";
  if (new Set(lots.map((l) => l.lotId)).size !== lots.length) return "duplicate_lots";
  if (new Set(lots.map((l) => l.accountId)).size > 1) return "mixed_accounts";
  if (new Set(lots.map((l) => l.placeId)).size > 1) return "mixed_places";
  return null;
}
