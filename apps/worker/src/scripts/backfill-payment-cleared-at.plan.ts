/** A lot's fulfilment record and what is known about when its payment cleared. */
export type FulfilmentToDate = {
  lotId: string;
  /** Where the record stands: only lots past "awaiting payment" have been paid. */
  status: string;
  paymentClearedAt: Date | null;
};

/** One `payment.captured` event: when the payment was captured, for which lot. */
export type CapturedEvent = { lotId: string; capturedAt: Date };

export type PlannedDate = { lotId: string; clearedAt: Date };

export type PaymentClearedPlan = {
  /** Lots to stamp, each with the earliest capture of its payments. */
  dates: PlannedDate[];
  /** Lots paid but with no capture event to take the time from; left empty rather than guessed. */
  withoutEvent: string[];
  /** Lots that already have a date. */
  alreadyDated: number;
};

/**
 * Works out the clearance date of lots that cleared before it was recorded, exactly: the time the
 * payment was captured, from the `payment.captured` event. A lot with no such event is reported,
 * never given an estimate, because a date that is a day out sends its reminder a day out.
 */
export function planPaymentClearedBackfill(
  fulfilments: readonly FulfilmentToDate[],
  events: readonly CapturedEvent[],
): PaymentClearedPlan {
  const earliest = new Map<string, Date>();
  for (const event of events) {
    const known = earliest.get(event.lotId);
    if (!known || event.capturedAt.getTime() < known.getTime()) {
      earliest.set(event.lotId, event.capturedAt);
    }
  }
  const plan: PaymentClearedPlan = { dates: [], withoutEvent: [], alreadyDated: 0 };
  for (const fulfilment of fulfilments) {
    if (fulfilment.status === "awaiting_payment") continue;
    if (fulfilment.paymentClearedAt) {
      plan.alreadyDated += 1;
      continue;
    }
    const clearedAt = earliest.get(fulfilment.lotId);
    if (clearedAt) plan.dates.push({ lotId: fulfilment.lotId, clearedAt });
    else plan.withoutEvent.push(fulfilment.lotId);
  }
  return plan;
}
