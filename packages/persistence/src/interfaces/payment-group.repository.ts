import type { Database } from "@auction/db";
import type { PaymentGroupStatus } from "@auction/domain";
import type { PaymentRecord } from "./payment-write.repository.js";

/** One "Pay several" payment: the checkout that settles several invoices of one account. */
export type PaymentGroupRecord = {
  id: string;
  buyerLegalEntityId: string;
  /** The member who paid; `null` once their user record is gone. */
  createdByUserId: string | null;
  status: PaymentGroupStatus;
  currency: string;
  /** The sum of the invoices' amounts, as a decimal string. */
  totalAmount: string;
  checkoutRail: "card" | "gb_bank_transfer";
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  createdAt: Date;
  settledAt: Date | null;
};

/** An invoice's payment inside a group, as settling, refunding and receipts need it. */
export type PaymentGroupMember = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  amount: string;
  status: PaymentRecord["status"];
  sellerLegalEntityId: string;
};

export type ClaimPaymentGroupInput = {
  buyerLegalEntityId: string;
  createdByUserId: string;
  currency: string;
  totalAmount: string;
  checkoutRail: PaymentGroupRecord["checkoutRail"];
  /** The invoices' open payments, in the order picked. */
  paymentIds: readonly string[];
};

export type ClaimPaymentGroupResult =
  | { kind: "claimed"; group: PaymentGroupRecord }
  /** Some payment was no longer due, belonged elsewhere or was taken by another payment. */
  | { kind: "conflict" };

/** A group and its invoices, locked for the rest of the caller's transaction. */
export type LockedPaymentGroup = {
  group: PaymentGroupRecord;
  members: PaymentGroupMember[];
};

export interface IPaymentGroupRepository {
  /**
   * Creates the group and takes every listed payment into it, all or none, in one transaction.
   * A payment is taken only while it is due (`pending`), billed to the account and in no other
   * group; when two payments race for the same invoices, exactly one wins.
   */
  claim(input: ClaimPaymentGroupInput): Promise<ClaimPaymentGroupResult>;
  findById(id: string): Promise<PaymentGroupRecord | null>;
  /** The group a Stripe charge or PaymentIntent belongs to, if it is a group's. */
  findByStripeRefs(refs: {
    chargeId?: string | null;
    paymentIntentId?: string | null;
  }): Promise<PaymentGroupRecord | null>;
  listMembers(groupId: string): Promise<PaymentGroupMember[]>;
  /**
   * Records the group's checkout, and its PaymentIntent (when the provider made one up front) on
   * the group and on each of its invoices' payments.
   */
  recordCheckout(
    groupId: string,
    checkout: { sessionId: string; paymentIntentId: string | null },
  ): Promise<void>;
  /** Locks the group and its invoices' payments (`FOR UPDATE`) inside `tx`. */
  lockInTransaction(tx: Database, groupId: string): Promise<LockedPaymentGroup | null>;
  /**
   * Moves the group from one of `from` to `to` inside `tx`; `false` when it was not in `from`.
   * Settling (`paid` or `cancelled`) stamps `settledAt`; the Stripe references are recorded when
   * given.
   */
  transitionInTransaction(
    tx: Database,
    groupId: string,
    from: readonly PaymentGroupStatus[],
    to: PaymentGroupStatus,
    opts?: { stripeChargeId?: string | null; stripePaymentIntentId?: string | null },
  ): Promise<boolean>;
  /**
   * Hands every invoice of a released group back: each payment still open (`pending` or
   * `authorized`) leaves the group and is due again (`pending`). Returns the payments released.
   */
  releaseMembersInTransaction(tx: Database, groupId: string): Promise<string[]>;
}

/** Facts about invoices that decide whether they can join a "Pay several" payment. */
export type PaySeveralInvoiceFlags = {
  /** The invoice waits for a finance review (the seller's account is closed). */
  heldForReview: boolean;
  /** The invoice is already in another group whose checkout is open. */
  inPaymentInProgress: boolean;
};

export interface IPaySeveralInvoiceFlagsReader {
  /** Flags for each payment id given; unknown ids are absent. */
  flagsFor(paymentIds: readonly string[]): Promise<Map<string, PaySeveralInvoiceFlags>>;
}
