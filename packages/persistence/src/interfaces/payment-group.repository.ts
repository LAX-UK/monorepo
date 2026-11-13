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
  /** What a bank transfer has delivered so far, as a decimal string; never above the total. */
  amountReceived: string;
  receivedEventAt: Date | null;
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

/** A courier quote charged in a group, with the pounds charged for it, as a decimal string. */
export type PaymentGroupDelivery = {
  quoteId: string;
  lotId: string;
  amount: string;
};

export type ClaimPaymentGroupInput = {
  buyerLegalEntityId: string;
  createdByUserId: string;
  currency: string;
  totalAmount: string;
  checkoutRail: PaymentGroupRecord["checkoutRail"];
  /** The invoices' open payments, in the order picked. */
  paymentIds: readonly string[];
  /**
   * Accepted courier quotes charged with them. Each must still be accepted, belong to the account,
   * be for the lot named and be at exactly this price, or the claim is a conflict.
   */
  deliveries: readonly PaymentGroupDelivery[];
};

export type ClaimPaymentGroupResult =
  | { kind: "claimed"; group: PaymentGroupRecord }
  /** Some payment was no longer due, belonged elsewhere or was taken by another payment. */
  | { kind: "conflict" };

/** A quote charged in a group, with what the buyer was refunded for it so far, in pence. */
export type LockedPaymentGroupDelivery = PaymentGroupDelivery & { refundedPence: number };

/** A group and its invoices, locked for the rest of the caller's transaction. */
export type LockedPaymentGroup = {
  group: PaymentGroupRecord;
  members: PaymentGroupMember[];
  deliveries: LockedPaymentGroupDelivery[];
  /** The largest refund total, in pence, that no invoice or quote could take, announced so far. */
  refundUnattributedPence: number;
};

export interface IPaymentGroupRepository {
  /**
   * Creates the group and takes every listed payment and courier quote into it, all or none, in one
   * transaction. A payment is taken only while it is due (`pending`), billed to the account and in
   * no other group; a quote only while it is accepted and charged nowhere else. When two payments
   * race for the same invoices or quote, exactly one wins. The caller states the total; the
   * checkout charges the stored invoices and quotes and refuses a total they do not add up to, and
   * settlement checks it again before any invoice is marked paid.
   */
  claim(input: ClaimPaymentGroupInput): Promise<ClaimPaymentGroupResult>;
  findById(id: string): Promise<PaymentGroupRecord | null>;
  /** The group a Stripe charge or PaymentIntent belongs to, if it is a group's. */
  findByStripeRefs(refs: {
    chargeId?: string | null;
    paymentIntentId?: string | null;
  }): Promise<PaymentGroupRecord | null>;
  listMembers(groupId: string): Promise<PaymentGroupMember[]>;
  /** The courier quotes the group charges. */
  listDeliveries(groupId: string): Promise<PaymentGroupDelivery[]>;
  /**
   * The bank-transfer groups (`open`, `processing` or `paid`) created since `since` for the
   * account that owns this Stripe customer, newest first. A customer's balance cannot say which of
   * them its money is from, so callers treat more than one as no answer.
   */
  findBankTransferGroupsForCustomer(
    stripeCustomerId: string,
    since: Date,
  ): Promise<PaymentGroupRecord[]>;
  /** The groups still holding any of these payments (`open` or `processing`). */
  findLiveByPaymentIds(paymentIds: readonly string[]): Promise<PaymentGroupRecord[]>;
  /**
   * Records the money a bank transfer has delivered, inside `tx`. Applied only while the group is
   * live and only when the event is not older than the one last applied; the figure is only ever
   * raised and never passes the group's total. `false` when nothing changed.
   */
  recordReceivedInTransaction(
    tx: Database,
    groupId: string,
    received: { amount: string; eventAt: Date },
  ): Promise<boolean>;
  /**
   * Records the group's checkout, and its PaymentIntent (when the provider made one up front) on
   * the group and on each of its invoices' payments. Only a live group takes it; `false` when
   * the group was let go meanwhile, in which case nothing is recorded.
   */
  recordCheckout(
    groupId: string,
    checkout: { sessionId: string; paymentIntentId: string | null },
  ): Promise<boolean>;
  /**
   * Locks the group, then its invoices' payments in id order (`FOR UPDATE`), inside `tx`, so two
   * callers can never hold the payments in opposite order.
   */
  lockInTransaction(tx: Database, groupId: string): Promise<LockedPaymentGroup | null>;
  /**
   * Raises what is held as refunded for a quote of the group to `refundedPence`, inside `tx`
   * (the group is locked by the caller). Never lowers it; `true` only when it went up.
   */
  raiseDeliveryRefundedInTransaction(
    tx: Database,
    groupId: string,
    quoteId: string,
    refundedPence: number,
  ): Promise<boolean>;
  /**
   * Raises what is held as refund no invoice or quote could take to `unattributedPence`, inside
   * `tx` (the group is locked by the caller). Never lowers it; `true` only when it went up.
   */
  raiseUnattributedRefundInTransaction(
    tx: Database,
    groupId: string,
    unattributedPence: number,
  ): Promise<boolean>;
  /**
   * Groups paid by a charge that hold any refund (a buyer refund row, a seller refund line, a
   * courier refund or unattributed excess), in id order after `afterId`: what the refund repair
   * command checks against Stripe.
   */
  listChargedGroupsWithRefunds(input: {
    afterId: string | null;
    limit: number;
  }): Promise<{ id: string; stripeChargeId: string }[]>;
  /**
   * Lowers what is held as refunded for a quote of the group to `refundedPence`, inside `tx` (the
   * group is locked by the caller). Only the explicit refund repair uses it, for a total counted
   * under the old rule from a refund that later failed; `true` only when it went down.
   */
  lowerDeliveryRefundedInTransaction(
    tx: Database,
    groupId: string,
    quoteId: string,
    refundedPence: number,
  ): Promise<boolean>;
  /** As `lowerDeliveryRefundedInTransaction`, for the refund no invoice or quote could take. */
  lowerUnattributedRefundInTransaction(
    tx: Database,
    groupId: string,
    unattributedPence: number,
  ): Promise<boolean>;
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
   * Hands everything a released group held back: each payment still open (`pending` or
   * `authorized`) leaves the group and is due again (`pending`), and its courier quotes are free to
   * be charged again. Returns the payments released.
   */
  releaseMembersInTransaction(tx: Database, groupId: string): Promise<string[]>;
}

/** An accepted courier quote that no payment has charged yet. */
export type ChargeableDeliveryQuote = {
  quoteId: string;
  lotId: string;
  /** The accepted price, as a decimal string. */
  amount: string;
  destination: string;
  quoteNote: string | null;
};

export interface IChargeableDeliveryReader {
  /**
   * The accepted quotes of the account for these lots that are charged by no payment, open or
   * paid. A quote that was withdrawn, is still being priced or is already charged is absent.
   */
  acceptedFor(
    buyerLegalEntityId: string,
    lotIds: readonly string[],
  ): Promise<ChargeableDeliveryQuote[]>;
}

/** Facts about invoices that decide whether they can join a "Pay several" payment. */
export type PaySeveralInvoiceFlags = {
  /** The invoice waits for a finance review (the seller's account is closed). */
  heldForReview: boolean;
  /** The invoice is already in another group whose checkout is open. */
  inPaymentInProgress: boolean;
  /** The live group (`open` or `processing`) holding the invoice, if any. */
  group: LivePaymentGroupFacts | null;
};

/** What the Pay page needs to know about a group that holds an invoice. */
export type LivePaymentGroupFacts = {
  id: string;
  status: "open" | "processing";
  checkoutRail: PaymentGroupRecord["checkoutRail"];
  stripeCheckoutSessionId: string | null;
  /** Decimal strings, as stored. */
  totalAmount: string;
  amountReceived: string;
  /** How many invoices the group holds. */
  memberCount: number;
};

export interface IPaySeveralInvoiceFlagsReader {
  /** Flags for each payment id given; unknown ids are absent. */
  flagsFor(paymentIds: readonly string[]): Promise<Map<string, PaySeveralInvoiceFlags>>;
}
