import {
  LONDON_TIME_ZONE,
  dayKey,
  firstExistingWallTime,
  instantToWallClock,
  wallClockToInstant,
} from "@auction/datetime";
import { addDaysToKey, isoWeekday } from "./collection-time.js";
import { invoiceDueAt } from "./purchase-invoice-state.js";
import {
  DEFAULT_OFFER_DAYS,
  MAX_OFFER_DAYS,
  MIN_OFFER_DAYS,
  OFFER_ENDS_AT_LOCAL,
  SELLER_CONSENT_REMINDER_WORKING_DAYS,
  SELLER_CONSENT_WORKING_DAYS,
} from "./reoffer-rules.js";
import { LONDON_WORKING_CALENDAR } from "./working-hours.js";

/**
 * Working days are Monday to Friday except the bank holidays of England and Wales (the London
 * office calendar). The wall-clock time of a deadline is the time the request was made.
 */

function isWorkingDay(key: string): boolean {
  return isoWeekday(key) <= 5 && !LONDON_WORKING_CALENDAR.isHoliday(key);
}

function londonInstant(day: string, time: string): Date {
  const exact = wallClockToInstant(day, time, LONDON_TIME_ZONE);
  if (exact.ok) return exact.instant;
  const existing = firstExistingWallTime(day, time, LONDON_TIME_ZONE);
  if (existing) {
    const shifted = wallClockToInstant(day, existing, LONDON_TIME_ZONE);
    if (shifted.ok) return shifted.instant;
  }
  throw new RangeError(`No London time for ${day} ${time}`);
}

/** The London day `count` working days after the day of `from`. */
function workingDayAfter(from: Date, count: number): string {
  let key = dayKey(from, LONDON_TIME_ZONE);
  let counted = 0;
  while (counted < count) {
    key = addDaysToKey(key, 1);
    if (isWorkingDay(key)) counted += 1;
  }
  return key;
}

function workingDeadline(askedAt: Date, workingDays: number): Date {
  const { time } = instantToWallClock(askedAt, LONDON_TIME_ZONE);
  return londonInstant(workingDayAfter(askedAt, workingDays), time);
}

export type SellerConsentWindow = { dueAt: Date; reminderAt: Date };

/** When the seller must answer (3 working days) and when the one reminder goes (after 2). */
export function sellerConsentWindow(askedAt: Date): SellerConsentWindow {
  return {
    dueAt: workingDeadline(askedAt, SELLER_CONSENT_WORKING_DAYS),
    reminderAt: workingDeadline(askedAt, SELLER_CONSENT_REMINDER_WORKING_DAYS),
  };
}

export function isValidOfferDays(days: number): boolean {
  return Number.isInteger(days) && days >= MIN_OFFER_DAYS && days <= MAX_OFFER_DAYS;
}

/** When an offer sent at `sentAt` ends: `days` London days later, at 17:00 London time. */
export function offerEndsAt(sentAt: Date, days: number = DEFAULT_OFFER_DAYS): Date {
  if (!isValidOfferDays(days)) {
    throw new RangeError(`An offer lasts ${MIN_OFFER_DAYS} to ${MAX_OFFER_DAYS} days`);
  }
  const lastDay = addDaysToKey(dayKey(sentAt, LONDON_TIME_ZONE), days);
  return londonInstant(lastDay, OFFER_ENDS_AT_LOCAL);
}

/** When the invoice raised on acceptance is due: the one invoice rule, from the acceptance day. */
export function invoiceDueAfterAcceptance(acceptedAt: Date): Date {
  return invoiceDueAt(acceptedAt);
}
