/**
 * Money that reached us but could not be applied to an invoice. It is never refunded
 * automatically: finance gets a task and an alert, and decides (reinstate, refund, or apply).
 */
export const UNAPPLIED_MONEY_EVENT = "payment.unapplied_money_received";
/** Recorded when that money is refunded in full, which closes the finance task. */
export const UNAPPLIED_MONEY_RESOLVED_EVENT = "payment.unapplied_money_resolved";

export const UNAPPLIED_MONEY_REASONS = [
  /**
   * The invoice was cancelled before this money arrived. Finance reinstates or refunds it from
   * the closed-payment item; recording it here keeps its refund away from the seller's payout.
   */
  "invoice_cancelled",
  /** The invoice was refunded before this money arrived. */
  "invoice_refunded",
  /** The invoice was already paid, by other money (a second checkout, or single and group). */
  "invoice_already_paid",
  /**
   * A bank transfer for an invoice arrived in part while the invoice was paid another way, so the
   * checkout holding it could not be closed. Finance returns or applies the part payment.
   */
  "transfer_partially_funded_after_paid",
  /** Stripe took a different amount from the invoice total. */
  "amount_mismatch",
  /** A "Pay several" payment arrived but its invoices could no longer all be settled. */
  "group_not_settleable",
  /** A "Pay several" payment is known to have received more than its own total. */
  "group_overpaid",
  /** A bank transfer landed in the buyer's Stripe balance with no open invoice to apply it to. */
  "customer_balance_unapplied",
  /** Stripe shows the invoice paid, but this process cannot record the payment itself. */
  "paid_not_recorded",
  /**
   * Money arrived for a private sale deal's payment that could no longer take it: its checkout had
   * been ended, or the deal was already paid another way (a transfer finance recorded).
   */
  "private_sale_payment_not_applied",
  /**
   * Money went back to a private sale buyer after the seller's payout included the deal, so the
   * payout may need adjusting. The amount is what went back in this report.
   */
  "private_sale_refund_after_payout",
  /**
   * A Shop buyer's payment arrived after their order had been closed (expired, cancelled or
   * failed) and its prints released. Nothing is refunded automatically: finance decides.
   */
  "shop_order_paid_after_close",
  /** A Shop buyer paid an amount that is not their order's total. Nothing was applied and the order was closed. */
  "shop_order_amount_mismatch",
  /** A Shop buyer paid in a payment session that is not the one their order was opened with. */
  "shop_order_session_mismatch",
  /** A Shop buyer paid, but the print held for their order was no longer reserved for it. */
  "shop_order_edition_state_invalid",
  /** A Shop order that was already paid received a second payment, in another session. */
  "shop_order_paid_twice",
  /**
   * A Shop buyer paid for an artwork Zoho says is Sold or Reserved (an open "Needs attention" item
   * paused its money) before or while they were paying. Nothing was fulfilled and the order was
   * closed; finance refunds the buyer; if staff say it is not sold, the buyer is asked to buy it again.
   */
  "shop_order_paid_while_paused",
  /** A Shop buyer paid for an order that does not exist here (live mode only). */
  "shop_order_not_found",
  /**
   * Stripe shows a Shop buyer's checkout as paid, but the payment could not be read or confirmed
   * by the time the order's hold had run its longest, so it was not applied and the order closed.
   */
  "shop_order_paid_not_confirmed",
  /**
   * A bank transfer sent with one invoice's payment reference was applied by the payment provider
   * to another open payment of the same buyer. Nothing is lost; finance checks both invoices.
   */
  "transfer_applied_to_other_invoice",
  /**
   * Zoho Books shows a payment against one of LAX's invoices that LAX never sent: staff recorded
   * it in Books by hand (a gallery sale, a cheque). The nightly status check found it. Nothing in
   * LAX was marked paid: finance checks the money arrived and records it in LAX, or corrects Books.
   */
  "books_payment_recorded_by_hand",
] as const;

export type UnappliedMoneyReason = (typeof UNAPPLIED_MONEY_REASONS)[number];

/** Reasons that close once the money is captured for its invoice (recorded, or reinstated). */
export const UNAPPLIED_MONEY_CLOSED_BY_CAPTURE: readonly UnappliedMoneyReason[] = [
  "paid_not_recorded",
  "invoice_cancelled",
];

/** Reasons finance handles from another inbox item (the closed-payment item), not this one. */
export const UNAPPLIED_MONEY_HANDLED_ELSEWHERE: readonly UnappliedMoneyReason[] = [
  "invoice_cancelled",
];

export type UnappliedMoney = {
  reason: UnappliedMoneyReason;
  paymentId: string | null;
  paymentGroupId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  /** Stripe customer, for money sitting in a customer balance. */
  stripeCustomerId: string | null;
  /**
   * A guess, never a fact: the one recent bank-transfer payment of the buyer's account this
   * balance might belong to. Set only when exactly one fits; finance checks before acting.
   */
  possibleGroup?: { id: string; status: "open" | "processing" | "paid" } | null;
  /** The Stripe event that reported money with no intent or charge (a balance credit). */
  stripeEventId?: string | null;
  /** The private sale deal and its payment the money belongs to, when it is a deal's. */
  privateSaleDealId?: string | null;
  /** What staff quote for that deal (PS-0012), so the alert says which deal. */
  privateSaleDealReference?: string | null;
  privateSaleDealPaymentId?: string | null;
  /** The Shop order the money was paid for (its id and the reference the buyer quotes). */
  shopOrderId?: string | null;
  shopOrderReference?: string | null;
  /** The Checkout Session the buyer paid in. */
  shopCheckoutSessionId?: string | null;
  /** The provider's ledger entry that applied the money: one task per entry. */
  cashBalanceTransactionId?: string | null;
  /** The reference the sender quoted on a transfer that was applied to another payment. */
  transferReference?: string | null;
  /** The payment (or combined payment) that reference was issued for, when it is known. */
  intendedPaymentId?: string | null;
  intendedPaymentGroupId?: string | null;
  /**
   * A payment recorded in Books by hand: its key
   * (`books:<organisation>:<Books payment id>:<LAX invoice reference>`), the
   * LAX reference of the invoice Books shows it against, and how Books says it was paid.
   */
  booksPaymentKey?: string | null;
  accountingReference?: string | null;
  booksPaymentMode?: string | null;
  booksPaymentDate?: string | null;
  amountCents: number;
  currency: string;
};

export type UnappliedMoneyPayload = UnappliedMoney & { dedupeKey: string };

/**
 * What finance reads about the payment a balance might belong to, worded by the payment's state.
 * A hedge, never a fact: the email and the work inbox both show it, so the words live here.
 */
export function possibleSourceText(
  group: NonNullable<UnappliedMoney["possibleGroup"]> | null,
): string | null {
  if (!group) return null;
  const ref = `PG-${group.id.slice(0, 8).toUpperCase()}`;
  return group.status === "paid"
    ? `Possible overpayment of payment ${ref}. Check before acting.`
    : `May belong to the unpaid payment ${ref}. Check before acting.`;
}

/**
 * One finance task per piece of money: the same intent (or balance credit) reported again, by a
 * webhook replay or a second cron run, has the same key and raises nothing new.
 */
export function unappliedMoneyDedupeKey(money: UnappliedMoney): string {
  const reference =
    money.booksPaymentKey ??
    money.cashBalanceTransactionId ??
    money.stripePaymentIntentId ??
    money.stripeChargeId ??
    money.shopCheckoutSessionId ??
    money.stripeEventId ??
    money.paymentGroupId ??
    money.paymentId ??
    "unknown";
  return `${money.reason}:${reference}`;
}

/**
 * The aggregate a task's events are recorded against, so the "received" event and the "resolved"
 * event that closes it sit on one audit trail: the payment, else the payment group, else the
 * task's own key (money that belongs to neither, such as a Shop order's).
 */
export function unappliedMoneyAggregate(
  money: Pick<UnappliedMoney, "paymentId" | "paymentGroupId">,
  dedupeKey: string,
): { aggregateType: "payment" | "payment_group"; aggregateId: string } {
  return {
    aggregateType: money.paymentId ? "payment" : "payment_group",
    aggregateId: money.paymentId ?? money.paymentGroupId ?? dedupeKey,
  };
}

export function unappliedMoneyPayload(money: UnappliedMoney): UnappliedMoneyPayload {
  return {
    ...money,
    currency: money.currency.toUpperCase(),
    dedupeKey: unappliedMoneyDedupeKey(money),
  };
}

const shortRef = (prefix: string, id: string) => `${prefix}-${id.slice(0, 8).toUpperCase()}`;

function paymentLabel(paymentId: string | null | undefined, groupId: string | null | undefined) {
  if (paymentId) return `invoice ${shortRef("PAY", paymentId)}`;
  if (groupId) return `combined payment ${shortRef("PG", groupId)}`;
  return null;
}

/**
 * What finance reads about a bank transfer applied to a different invoice than its reference
 * names, worded without naming the payment provider. Either invoice may be unknown (a reference
 * issued before references were kept), and is then described, never guessed.
 */
export function misappliedTransferText(
  money: Pick<
    UnappliedMoney,
    | "paymentId"
    | "paymentGroupId"
    | "intendedPaymentId"
    | "intendedPaymentGroupId"
    | "transferReference"
  >,
): string {
  const intended =
    paymentLabel(money.intendedPaymentId, money.intendedPaymentGroupId) ?? "another invoice";
  const received =
    paymentLabel(money.paymentId, money.paymentGroupId) ?? "a different invoice of the same buyer";
  const quoted = money.transferReference ? ` (reference ${money.transferReference})` : "";
  return `A bank transfer sent with ${intended}'s payment reference${quoted} was applied to ${received}. The money is not lost, but it is recorded against the wrong invoice. Check both invoices and move the payment if needed.`;
}

/** What the work inbox shows for an open task: its title and the line that says what to check. */
export function unappliedMoneyWorkItemWording(
  money: Pick<
    UnappliedMoney,
    | "reason"
    | "possibleGroup"
    | "paymentId"
    | "paymentGroupId"
    | "intendedPaymentId"
    | "intendedPaymentGroupId"
    | "transferReference"
  >,
): { title: string; hint: string | null } {
  if (money.reason === "transfer_applied_to_other_invoice") {
    return {
      title: "Bank transfer applied to another invoice",
      hint: misappliedTransferText(money),
    };
  }
  return {
    title: "Money received that could not be applied",
    hint: possibleSourceText(money.possibleGroup ?? null),
  };
}
