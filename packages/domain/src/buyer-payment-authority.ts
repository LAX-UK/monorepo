import type { LegalEntityKind } from "@auction/types";
import { type EntityActor, entityActorCan } from "./entity-capabilities.js";

/** The won lot being paid for, as far as the payment rule needs to know it. */
export type PayableLot = {
  /** The person whose bid won; `null` while the lot has no winner. */
  winnerId: string | null;
  /** Whether the lot was won for a person's own account or for an organisation. */
  buyerAccountKind: LegalEntityKind;
};

export type BuyerPaymentAuthorityInput = {
  /** The person asking to pay. */
  payerUserId: string;
  lot: PayableLot;
  /**
   * The payer's active membership of the account the lot was won for, or `null` when they are
   * not a member (never were, or were removed). Removed members hold no membership.
   */
  membership: EntityActor | null;
};

export type PaymentRefusal =
  /** The lot has no winner, so there is nothing to pay. */
  | "lot_not_won"
  /** A personal purchase is paid only by the person who won it. */
  | "not_winner"
  /** The payer does not belong to the organisation the lot was won for. */
  | "not_member"
  /** The payer belongs to the organisation but does not handle its money. */
  | "not_payer";

export type PaymentAuthorityDecision =
  | { allowed: true }
  | { allowed: false; reason: PaymentRefusal };

const ALLOWED: PaymentAuthorityDecision = { allowed: true };
const refuse = (reason: PaymentRefusal): PaymentAuthorityDecision => ({ allowed: false, reason });

/**
 * Who may pay for a won lot.
 * - A personal purchase: the person who won it.
 * - An organisation's purchase: the members who move its money (`entity.finance.write`, so its
 *   owners, admins and finance), whoever placed the winning bid. The buyer agent who won is told
 *   but does not pay. A removed member has no membership and so cannot pay; a platform admin
 *   viewing as the organisation is read-only and cannot either.
 *
 * The organisation's state is deliberately not an input: a restricted organisation may no longer
 * bid, but it still settles what it already owes.
 */
export function buyerPaymentAuthority(input: BuyerPaymentAuthorityInput): PaymentAuthorityDecision {
  const { lot, membership, payerUserId } = input;
  if (!lot.winnerId) return refuse("lot_not_won");
  if (lot.buyerAccountKind === "individual") {
    return lot.winnerId === payerUserId ? ALLOWED : refuse("not_winner");
  }
  if (!membership) return refuse("not_member");
  return entityActorCan(membership, "entity.finance.write") ? ALLOWED : refuse("not_payer");
}

/**
 * How a member stands to a purchase of their account:
 * - `payer`: they pay it (the Pay button is theirs);
 * - `informed`: they won it but someone else pays, so they are told how payment is going;
 * - `none`: neither.
 */
export type PurchasePaymentRole = "payer" | "informed" | "none";

export function purchasePaymentRole(input: BuyerPaymentAuthorityInput): PurchasePaymentRole {
  if (buyerPaymentAuthority(input).allowed) return "payer";
  return input.lot.winnerId === input.payerUserId ? "informed" : "none";
}
