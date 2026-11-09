/**
 * How long a checkout holds the prints before the buyer pays, and when a payment session about to
 * be opened may stretch that hold. Pure rules; the order and the reservation are moved by the
 * caller.
 *
 * Stripe refuses a Checkout Session that expires less than 30 minutes after it is created, so a
 * session must be opened with more than that left on the hold. A small margin covers the time
 * between choosing the expiry and Stripe receiving the request.
 */
export const STRIPE_SESSION_MIN_LIFETIME_MS = 30 * 60 * 1000;
/** Time to spare over Stripe's minimum when deciding that a hold is long enough as it is. */
export const SESSION_SAFETY_MARGIN_MS = 30 * 1000;
/** How long a new checkout, or a stretched hold, lasts from the moment it is set: the minimum and a minute. */
export const CHECKOUT_HOLD_MS = STRIPE_SESSION_MIN_LIFETIME_MS + 60 * 1000;
/**
 * The longest a hold may be stretched past the moment it began (the order's creation, or the
 * buyer accepting a delivery quote). A buyer who keeps asking to pay cannot keep prints held
 * beyond it; they start again.
 */
export const MAX_HOLD_EXTENSION_MS = 2 * 60 * 60 * 1000;

/** When a checkout started at `now` holds the prints until. */
export function newCheckoutHoldEnd(now: Date): Date {
  return new Date(now.getTime() + CHECKOUT_HOLD_MS);
}

export type SessionHoldPlan =
  /** The hold is already long enough for a session: use it as it is. */
  | { kind: "keep"; endsAt: Date }
  /** Stretch the hold to this moment (order and reservation together), then open the session. */
  | { kind: "extend"; endsAt: Date }
  /** Stretching would pass the ceiling: the buyer starts again. */
  | { kind: "refuse" };

/**
 * What to do with an order's hold before opening a payment session at `now`:
 *  - keep it when it already lasts at least Stripe's minimum with the margin;
 *  - stretch it to {@link CHECKOUT_HOLD_MS} from now when it does not, unless that would end more
 *    than {@link MAX_HOLD_EXTENSION_MS} after `began`;
 *  - refuse otherwise.
 */
export function planSessionHold(input: {
  holdEndsAt: Date;
  /** When the hold began: the order's creation, or the buyer accepting a quote. */
  began: Date;
  now: Date;
}): SessionHoldPlan {
  const remaining = input.holdEndsAt.getTime() - input.now.getTime();
  if (remaining >= STRIPE_SESSION_MIN_LIFETIME_MS + SESSION_SAFETY_MARGIN_MS) {
    return { kind: "keep", endsAt: input.holdEndsAt };
  }
  const endsAt = newCheckoutHoldEnd(input.now);
  if (endsAt.getTime() > input.began.getTime() + MAX_HOLD_EXTENSION_MS) return { kind: "refuse" };
  return { kind: "extend", endsAt };
}

/** How long the reaper leaves an order alone before it looks at it again. */
export const HOLD_RECHECK_MS = 15 * 60 * 1000;
/**
 * The longest an order whose payment is still being confirmed, or that the reaper cannot yet end,
 * may keep its prints, counted from when the hold began. A bank debit can be confirmed or fail days
 * after the buyer paid: the longest window Stripe documents for the debits it offers is 14 business
 * days (SEPA Direct Debit; Bacs and ACH are shorter), which is 21 calendar days with weekends. Past
 * that, a payment that has still not been confirmed is treated as not made.
 */
export const MAX_ASYNC_PAYMENT_HOLD_MS = 21 * 24 * 60 * 60 * 1000;

export type HoldDeferralPlan =
  /** Look again at this moment: the order's hold and the prints' reservation both move to it. */
  | { kind: "defer"; endsAt: Date }
  /** The ceiling is reached: nothing more is deferred. */
  | { kind: "at_cap" };

/** The next look at an order the reaper must leave for now, never past {@link MAX_ASYNC_PAYMENT_HOLD_MS}. */
export function planHoldDeferral(input: { began: Date; now: Date }): HoldDeferralPlan {
  const cap = input.began.getTime() + MAX_ASYNC_PAYMENT_HOLD_MS;
  const endsAt = Math.min(input.now.getTime() + HOLD_RECHECK_MS, cap);
  return endsAt > input.now.getTime()
    ? { kind: "defer", endsAt: new Date(endsAt) }
    : { kind: "at_cap" };
}
