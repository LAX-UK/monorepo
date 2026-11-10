/** A lot's fulfilment record and what is known about when its payment cleared. */
export type FulfilmentToDate = {
  lotId: string;
  /** Where the record stands: only lots past "awaiting payment" have been paid. */
  status: string;
  /** The payment the record stands on now: the lot may have been sold again after a refund. */
  paymentId: string | null;
  paymentClearedAt: Date | null;
};

/** One `payment.captured` event: when the payment was captured, for which payment and lot. */
export type CapturedEvent = { lotId: string; paymentId: string; capturedAt: Date };

export type PlannedDate = { lotId: string; clearedAt: Date };

export type PaymentClearedPlan = {
  /** Lots to stamp, each with the capture of the payment its record stands on. */
  dates: PlannedDate[];
  /** Lots paid but with no capture event for their current payment; left empty rather than guessed. */
  withoutEvent: string[];
  /** Lots that already have a date. */
  alreadyDated: number;
};

/**
 * Works out the clearance date of lots that cleared before it was recorded, exactly: the time the
 * lot's current payment was captured, from that payment's `payment.captured` event. A lot sold
 * again after a refund has an older capture for the first buyer's payment, which says nothing of
 * the second. A lot with no event for its current payment is reported, never given an estimate,
 * because a date that is a day out sends its reminder a day out.
 */
export function planPaymentClearedBackfill(
  fulfilments: readonly FulfilmentToDate[],
  events: readonly CapturedEvent[],
): PaymentClearedPlan {
  const earliest = new Map<string, Date>();
  for (const event of events) {
    const key = `${event.lotId}:${event.paymentId}`;
    const known = earliest.get(key);
    if (!known || event.capturedAt.getTime() < known.getTime()) earliest.set(key, event.capturedAt);
  }
  const plan: PaymentClearedPlan = { dates: [], withoutEvent: [], alreadyDated: 0 };
  for (const fulfilment of fulfilments) {
    if (fulfilment.status === "awaiting_payment") continue;
    if (fulfilment.paymentClearedAt) {
      plan.alreadyDated += 1;
      continue;
    }
    const clearedAt = fulfilment.paymentId
      ? earliest.get(`${fulfilment.lotId}:${fulfilment.paymentId}`)
      : undefined;
    if (clearedAt) plan.dates.push({ lotId: fulfilment.lotId, clearedAt });
    else plan.withoutEvent.push(fulfilment.lotId);
  }
  return plan;
}
