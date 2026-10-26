import type { AdminOrderSummary } from "@auction/shop-contracts";
import type { AdminOrderDailyTotals } from "./ports/admin-readers.js";

/** Days in the orders summary's window; the comparison uses the same number of days before it. */
export const ORDER_SUMMARY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const ukDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" for each of the last `days` UK days ending today, oldest first. */
export function ukDayKeys(now: Date, days: number, offsetDays = 0): string[] {
  const keys: string[] = [];
  // Noon UTC never crosses a UK date boundary, whatever the clocks are doing.
  const noon = new Date(`${ukDay.format(now)}T12:00:00.000Z`).getTime();
  for (let i = days - 1 + offsetDays; i >= offsetDays; i -= 1) {
    keys.push(ukDay.format(new Date(noon - i * DAY_MS)));
  }
  return keys;
}

/** The earliest moment the summary reads: the start of the comparison window, with a day spare. */
export function orderSummarySince(now: Date, days = ORDER_SUMMARY_DAYS): Date {
  return new Date(now.getTime() - (days * 2 + 1) * DAY_MS);
}

/** Lays the daily totals out over the window and the window before it. */
export function buildOrderSummary(
  totals: AdminOrderDailyTotals,
  now: Date,
  days = ORDER_SUMMARY_DAYS,
): AdminOrderSummary {
  const current = ukDayKeys(now, days);
  const prior = ukDayKeys(now, days, days);
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
  const paidPence = (keys: readonly string[]) => keys.map((k) => totals.paid.get(k)?.pence ?? 0);
  const paidOrders = (keys: readonly string[]) =>
    sum(keys.map((k) => totals.paid.get(k)?.orders ?? 0));
  const placed = (keys: readonly string[]) => keys.map((k) => totals.placed.get(k) ?? 0);
  const paidDaily = paidPence(current);
  const placedDaily = placed(current);
  return {
    periodDays: days,
    paidPence: { daily: paidDaily, current: sum(paidDaily), prior: sum(paidPence(prior)) },
    orders: { daily: placedDaily, current: sum(placedDaily), prior: sum(placed(prior)) },
    paidOrders: { current: paidOrders(current), prior: paidOrders(prior) },
  };
}
