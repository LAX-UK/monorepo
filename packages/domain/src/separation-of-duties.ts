/**
 * Separation-of-duty rules that apply per action rather than per role: one person may rightly
 * hold both permissions involved, but must not use them on the same case.
 */

/** The people already involved in a compliance case (AML screening or source of funds). */
export type ComplianceCaseParticipants = {
  /** The client the case is about. */
  readonly subjectUserId: string;
  /** Staff member who raised the case, when a person rather than the system raised it. */
  readonly raisedByUserId: string | null;
  /** Staff member who reviewed it first (triage). */
  readonly triagedByUserId: string | null;
};

export type ComplianceDecisionRefusal = "own_case" | "raised_case" | "triaged_case";

/**
 * Why `deciderUserId` may not make the binding decision on a case, or `null` when they may.
 * The decision needs a second person: never the client, nor whoever raised or reviewed the case.
 */
export function complianceDecisionRefusal(
  deciderUserId: string,
  participants: ComplianceCaseParticipants,
): ComplianceDecisionRefusal | null {
  if (participants.subjectUserId === deciderUserId) return "own_case";
  if (participants.raisedByUserId === deciderUserId) return "raised_case";
  if (participants.triagedByUserId === deciderUserId) return "triaged_case";
  return null;
}

export type PayoutReversalRefusal = "not_permitted" | "processed_payout";

/**
 * Why `actorUserId` may not reverse a payout, or `null` when they may. Reversing needs the
 * reversal permission (administrators only) and is never done by anyone who processed the payout.
 */
export function payoutReversalRefusal(input: {
  readonly actorUserId: string;
  readonly actorMayReverse: boolean;
  readonly processedByUserIds: readonly string[];
}): PayoutReversalRefusal | null {
  if (!input.actorMayReverse) return "not_permitted";
  if (input.processedByUserIds.includes(input.actorUserId)) return "processed_payout";
  return null;
}
