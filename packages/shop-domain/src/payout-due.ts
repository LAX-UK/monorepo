export const REFUND_PERIOD_DAYS = 14 as const;

export function computeRefundPeriodEndsAt(paidAt: Date): Date {
  const ends = new Date(paidAt);
  ends.setUTCDate(ends.getUTCDate() + REFUND_PERIOD_DAYS);
  return ends;
}

export function computePayoutDueAt(refundPeriodEndsAt: Date): Date {
  return refundPeriodEndsAt;
}
