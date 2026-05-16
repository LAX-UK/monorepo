import type { Lot } from "@auction/types";

/** Lots ending within this window (from `now`) appear in the home “Ending Soon” rail. */
export const HOME_ENDING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

function lotEndMs(lot: Lot): number {
  return lot.endTime instanceof Date ? lot.endTime.getTime() : Date.parse(String(lot.endTime));
}

function lotStartMs(lot: Lot): number {
  return lot.startTime instanceof Date
    ? lot.startTime.getTime()
    : Date.parse(String(lot.startTime));
}

/** Active lots whose `endTime` is within `windowMs` of `nowMs` (exclusive of past ends). */
export function lotsEndingSoon(lots: Lot[], opts?: { nowMs?: number; windowMs?: number }): Lot[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const windowMs = opts?.windowMs ?? HOME_ENDING_SOON_WINDOW_MS;
  const endingSoon: Lot[] = [];
  for (const lot of lots) {
    const end = lotEndMs(lot);
    if (
      lot.status === "active" &&
      Number.isFinite(end) &&
      end - nowMs > 0 &&
      end - nowMs <= windowMs
    ) {
      endingSoon.push(lot);
    }
  }
  return endingSoon;
}

/** Scheduled (or other) lots with `startTime` in the future, soonest first, capped at `limit`. */
export function nextUpcomingLots(lots: Lot[], limit: number, nowMs: number = Date.now()): Lot[] {
  const future = lots.filter((l) => {
    const s = lotStartMs(l);
    return Number.isFinite(s) && s > nowMs;
  });
  future.sort((a, b) => lotStartMs(a) - lotStartMs(b));
  return future.slice(0, limit);
}
