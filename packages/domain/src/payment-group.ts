/**
 * One payment that settles several invoices of the same account ("Pay several"). Each invoice
 * keeps its own payment row; the group ties them to the one checkout the payer completes.
 *
 * - `open`: the checkout is issued and waiting for the payer;
 * - `processing`: the payer chose a bank transfer and the funds are on their way;
 * - `paid`: the money arrived and every invoice in the group is paid;
 * - `cancelled`: the checkout was cancelled, expired or failed, and every invoice went back to
 *   being due on its own.
 */
export type PaymentGroupStatus = "open" | "processing" | "paid" | "cancelled";

export type PaymentGroupEvent =
  /** The bank transfer was started; the money is not there yet. */
  | "funds_processing"
  /** The money arrived. */
  | "succeeded"
  /** The checkout was cancelled, expired or failed. */
  | "released";

const TRANSITIONS: Record<
  PaymentGroupStatus,
  Partial<Record<PaymentGroupEvent, PaymentGroupStatus>>
> = {
  open: { funds_processing: "processing", succeeded: "paid", released: "cancelled" },
  processing: { succeeded: "paid", released: "cancelled" },
  paid: {},
  cancelled: {},
};

/** The status after `event`, or `null` when the event does not apply (a late or repeated one). */
export function paymentGroupTransition(
  from: PaymentGroupStatus,
  event: PaymentGroupEvent,
): PaymentGroupStatus | null {
  return TRANSITIONS[from][event] ?? null;
}

/** Whether the group still holds its invoices (its checkout can still be paid). */
export function paymentGroupIsLive(status: PaymentGroupStatus): boolean {
  return status === "open" || status === "processing";
}

/** The payment-row states a grouped invoice can be settled from. */
const SETTLEABLE_MEMBER_STATUSES = new Set(["pending", "authorized"]);

export type PaymentGroupMemberFacts = {
  paymentId: string;
  amountPence: number;
  status:
    | "pending"
    | "authorized"
    | "captured"
    | "refunded"
    | "requires_manual_review"
    | "cancelled";
};

export type PaymentGroupSettlementRefusal =
  /** The group was settled before: a repeated or late notice, nothing to do. */
  | "already_paid"
  /** The group was released before the money arrived; its invoices are no longer held. */
  | "group_released"
  /** The group holds no invoices. */
  | "no_members"
  /** An invoice in the group was paid, cancelled or held some other way meanwhile. */
  | "member_not_settleable"
  /** The money received is not what the group's invoices add up to. */
  | "amount_mismatch"
  /** The money arrived in another currency. */
  | "currency_mismatch";

export type PaymentGroupSettlementDecision =
  | { apply: true }
  | { apply: false; reason: PaymentGroupSettlementRefusal; alert: boolean };

/**
 * Whether money received for a group settles every invoice in it. It is all or nothing: either
 * every invoice is marked paid, or none is and (unless it is a repeat of a settled group) the
 * finance team is alerted to put the money right by hand.
 */
export function decidePaymentGroupSettlement(input: {
  group: { status: PaymentGroupStatus; totalPence: number; currency: string };
  members: readonly PaymentGroupMemberFacts[];
  received: { amountPence: number; currency: string };
}): PaymentGroupSettlementDecision {
  const { group, members, received } = input;
  if (group.status === "paid") return { apply: false, reason: "already_paid", alert: false };
  if (group.status === "cancelled") return { apply: false, reason: "group_released", alert: true };
  if (members.length === 0) return { apply: false, reason: "no_members", alert: true };
  if (received.currency.toUpperCase() !== group.currency.toUpperCase()) {
    return { apply: false, reason: "currency_mismatch", alert: true };
  }
  if (members.some((m) => !SETTLEABLE_MEMBER_STATUSES.has(m.status))) {
    return { apply: false, reason: "member_not_settleable", alert: true };
  }
  const membersPence = members.reduce((sum, m) => sum + m.amountPence, 0);
  if (membersPence !== group.totalPence || received.amountPence !== group.totalPence) {
    return { apply: false, reason: "amount_mismatch", alert: true };
  }
  return { apply: true };
}

export type GroupRefund = {
  /** The invoice's payment the refund was made for, from the refund's own record. */
  paymentId: string | null;
  amountPence: number;
};

export type GroupRefundAttribution = {
  /** Everything refunded so far for each invoice in the group, in pence. */
  refundedPenceByPayment: Map<string, number>;
  /** Refunds that name no invoice of the group; these are never guessed at. */
  unattributedPence: number;
};

/**
 * Which invoice each refund of a group's payment belongs to. Refunds are made per invoice and
 * carry the invoice's payment id, so a partial refund of one invoice never touches the others.
 * A refund that names no invoice of the group (for example one made outside the platform) is
 * reported rather than spread across invoices.
 */
export function attributeGroupRefunds(
  memberPaymentIds: readonly string[],
  refunds: readonly GroupRefund[],
): GroupRefundAttribution {
  const members = new Set(memberPaymentIds);
  const refundedPenceByPayment = new Map<string, number>();
  let unattributedPence = 0;
  for (const refund of refunds) {
    if (refund.paymentId && members.has(refund.paymentId)) {
      refundedPenceByPayment.set(
        refund.paymentId,
        (refundedPenceByPayment.get(refund.paymentId) ?? 0) + refund.amountPence,
      );
    } else {
      unattributedPence += refund.amountPence;
    }
  }
  return { refundedPenceByPayment, unattributedPence };
}
