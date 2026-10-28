import type {
  ConsignmentMoveRefusal,
  ItemSubmissionStatus,
  LegalEntityKind,
  LegalEntityMemberRole,
  LegalEntityStatus,
} from "@auction/types";
import { entityRoleCan } from "./entity-capabilities.js";
import { sellerSubmissionAccess } from "./submission-policy.js";

/**
 * Staff move a personal consignment to an organisation the seller belongs to, on the seller's
 * request. Consignments stay personal otherwise: creating an organisation never moves them.
 *
 * Only work that is not yet catalogued moves. A catalogued lot already carries its seller into
 * the sale, invoices and payouts, so it stays with the account it was catalogued for.
 */
export const CONSIGNMENT_MOVABLE_STATUSES: readonly ItemSubmissionStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
];

const MOVABLE_STATUSES: ReadonlySet<ItemSubmissionStatus> = new Set(CONSIGNMENT_MOVABLE_STATUSES);

/** Statuses that finished without becoming a lot. */
const CLOSED_STATUSES: ReadonlySet<ItemSubmissionStatus> = new Set(["rejected", "withdrawn"]);

/**
 * What happens to the consignment agreement:
 * - `none`: there is no agreement yet.
 * - `carried`: the proposal moves with the consignment, still waiting for acceptance.
 * - `reset`: the seller had accepted it personally. That acceptance bound them, not the
 *   organisation, so it does not carry over: the same terms are proposed again and an owner or
 *   admin of the organisation accepts them.
 */
export type ConsignmentMoveAgreementEffect = "none" | "carried" | "reset";

export type ConsignmentMoveFacts = {
  submission: { status: ItemSubmissionStatus; legalEntityKind: LegalEntityKind };
  /** The person the personal consignment belongs to, in the target organisation. */
  target: {
    legalEntityId: string;
    kind: LegalEntityKind;
    status: LegalEntityStatus;
    /** The seller's active role there, `null` when they are not a member. */
    sellerRole: LegalEntityMemberRole | null;
  };
  sourceLegalEntityId: string;
  agreement: { acceptedAt: Date | null } | null;
};

export type ConsignmentMoveDecision =
  | { kind: "move"; agreement: ConsignmentMoveAgreementEffect }
  | { kind: "refused"; reason: ConsignmentMoveRefusal; message: string };

export const CONSIGNMENT_MOVE_REFUSAL_MESSAGES: Record<ConsignmentMoveRefusal, string> = {
  not_found: "This consignment or organisation was not found.",
  not_personal: "Only a consignment in a person's own name can be moved to an organisation.",
  catalogued:
    "This work is already catalogued, so it stays with the account it was catalogued for.",
  closed: "This consignment was rejected or withdrawn, so there is nothing to move.",
  same_account: "The consignment is already in this account.",
  not_member: "The seller is not a member of this organisation.",
  role_cannot_submit: "The seller's role in this organisation cannot hand in work.",
  organisation_cannot_submit:
    "This organisation cannot take consignments yet. Only drafts can move until LAX approves it.",
};

function refuse(reason: ConsignmentMoveRefusal): ConsignmentMoveDecision {
  return { kind: "refused", reason, message: CONSIGNMENT_MOVE_REFUSAL_MESSAGES[reason] };
}

/** What happens to the agreement when a consignment moves, from whether it was accepted. */
export function consignmentMoveAgreementEffect(
  agreement: ConsignmentMoveFacts["agreement"],
): ConsignmentMoveAgreementEffect {
  if (!agreement) return "none";
  return agreement.acceptedAt ? "reset" : "carried";
}

/** Whether a consignment in this status is still before cataloguing, so it could move. */
export function consignmentStatusMovable(status: ItemSubmissionStatus): boolean {
  return MOVABLE_STATUSES.has(status);
}

/** Whether the consignment itself can move, before an organisation is chosen. */
export function consignmentMoveSourceRefusal(
  submission: ConsignmentMoveFacts["submission"],
): ConsignmentMoveRefusal | null {
  if (submission.legalEntityKind !== "individual") return "not_personal";
  if (CLOSED_STATUSES.has(submission.status)) return "closed";
  if (!MOVABLE_STATUSES.has(submission.status)) return "catalogued";
  return null;
}

/**
 * Whether the seller could hand this consignment in for the organisation themselves: a member
 * whose role may submit, in an organisation that may take it in its current state.
 */
export function consignmentMoveTargetRefusal(
  facts: Pick<ConsignmentMoveFacts, "submission" | "target" | "sourceLegalEntityId">,
): ConsignmentMoveRefusal | null {
  const { target } = facts;
  if (target.legalEntityId === facts.sourceLegalEntityId) return "same_account";
  // Consignments move only into organisations, never between people.
  if (target.kind !== "organisation") return "not_found";
  if (target.sellerRole === null) return "not_member";
  if (!entityRoleCan(target.sellerRole, "entity.submissions.create")) return "role_cannot_submit";
  const access = sellerSubmissionAccess({ kind: target.kind, status: target.status });
  const allowed = facts.submission.status === "draft" ? access.canDraft : access.canSubmit;
  return allowed ? null : "organisation_cannot_submit";
}

export function decideConsignmentMove(facts: ConsignmentMoveFacts): ConsignmentMoveDecision {
  const source = consignmentMoveSourceRefusal(facts.submission);
  if (source) return refuse(source);
  const target = consignmentMoveTargetRefusal(facts);
  if (target) return refuse(target);
  return { kind: "move", agreement: consignmentMoveAgreementEffect(facts.agreement) };
}
