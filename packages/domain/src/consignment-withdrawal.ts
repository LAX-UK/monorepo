import type {
  ConsignmentWithdrawalPathKind,
  ItemSubmissionStatus,
  LotStatus,
} from "@auction/types";
import { type EntityActor, type EntityCapability, entityActorCan } from "./entity-capabilities.js";
import { LOT_CANCELLABLE_STATUSES } from "./lot-transitions.js";
import { canTransition } from "./submission-state-machine.js";

/**
 * How a seller takes a consignment back. Until it is catalogued the work is still the seller's
 * to withdraw. Once it is a lot it has been catalogued and marketed, so under the Conditions of
 * Business (Part C, clause 28) withdrawal needs LAX's consent: the seller asks and staff decide.
 */
export function consignmentWithdrawalPath(input: {
  submissionStatus: ItemSubmissionStatus;
  /** The lot made from the consignment, once catalogued. */
  lot: { status: LotStatus } | null;
  /** A withdrawal request is waiting for staff. */
  pendingRequest: boolean;
}): ConsignmentWithdrawalPathKind {
  if (canTransition(input.submissionStatus, "withdraw")) return "withdraw_now";
  if (input.submissionStatus !== "converted" || !input.lot) return "unavailable";
  if (!LOT_CANCELLABLE_STATUSES.has(input.lot.status)) return "unavailable";
  return input.pendingRequest ? "requested" : "request";
}

/**
 * Who may act on each path. Taking a work back, or asking to, binds the account, so only owners
 * and admins may, before or after cataloguing (the same rule as `submissionMutationPolicy`). A
 * person's own profile always may. Deny by default.
 */
const WITHDRAWAL_CAPABILITY: Record<ConsignmentWithdrawalPathKind, EntityCapability | null> = {
  withdraw_now: "entity.consignments.withdraw",
  request: "entity.consignments.withdraw",
  requested: "entity.consignments.withdraw",
  unavailable: null,
};

export function canActOnConsignmentWithdrawal(
  path: ConsignmentWithdrawalPathKind,
  actor: EntityActor | null,
): boolean {
  const capability = WITHDRAWAL_CAPABILITY[path];
  if (capability === null) return false;
  return actor === null || entityActorCan(actor, capability);
}

export const WITHDRAWAL_FORBIDDEN_MESSAGE: Record<
  Exclude<ConsignmentWithdrawalPathKind, "unavailable">,
  string
> = {
  withdraw_now: "Only an owner or admin can withdraw this consignment.",
  request: "Only an owner or admin can ask to withdraw a catalogued lot.",
  requested: "Only an owner or admin can ask to withdraw a catalogued lot.",
};
