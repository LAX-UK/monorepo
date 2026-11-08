/** The earliest start an admin settlement period may have; anything older is an open-ended run. */
export const SETTLEMENT_PERIOD_FLOOR = new Date("2000-01-01T00:00:00Z");

export type SettlementPeriodRefusal =
  | "settlement_period_open_ended"
  | "settlement_period_overlaps"
  | "settlement_period_in_future";

export type SettlementPeriodResult =
  | { ok: true; periodStart: Date; periodEnd: Date }
  | { ok: false; reason: SettlementPeriodRefusal };

/**
 * The period an admin settlement covers: it ends now and starts where the last settled period
 * ended (or at the oldest waiting payment on a first run). A requested start may not reach back
 * before the floor, before the last settled end, or past now, so two runs never cover the same time.
 */
export function resolveSettlementPeriod(input: {
  now: Date;
  requestedStart?: Date | undefined;
  lastSettledEnd: Date | null;
  earliestPending: Date | null;
}): SettlementPeriodResult {
  const { now, requestedStart, lastSettledEnd, earliestPending } = input;
  if (lastSettledEnd && lastSettledEnd.getTime() > now.getTime()) {
    return { ok: false, reason: "settlement_period_overlaps" };
  }
  if (requestedStart) {
    if (requestedStart.getTime() < SETTLEMENT_PERIOD_FLOOR.getTime()) {
      return { ok: false, reason: "settlement_period_open_ended" };
    }
    if (requestedStart.getTime() > now.getTime()) {
      return { ok: false, reason: "settlement_period_in_future" };
    }
    if (lastSettledEnd && requestedStart.getTime() < lastSettledEnd.getTime()) {
      return { ok: false, reason: "settlement_period_overlaps" };
    }
    return { ok: true, periodStart: requestedStart, periodEnd: now };
  }
  const start = lastSettledEnd ?? earliestPending ?? now;
  return {
    ok: true,
    periodStart:
      start.getTime() < SETTLEMENT_PERIOD_FLOOR.getTime() ? SETTLEMENT_PERIOD_FLOOR : start,
    periodEnd: now,
  };
}
