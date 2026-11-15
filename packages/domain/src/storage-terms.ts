import { type CollectionCalendar, nextOpenDay } from "./collection-calendar.js";
import { DEFAULT_COLLECT_BY_POLICY } from "./collection-storage.js";
import {
  type DateKey,
  addDaysToKey,
  formatCollectionDay,
  londonDateKey,
} from "./collection-time.js";

/** How a place counts its free storage days. */
export type StorageDayCount = "calendar" | "working";

/** A work is large when any side is over this, frame or crate included. Staff mark it on the lot. */
export const LARGE_WORK_SIDE_CM = 150;

/**
 * What a collection place charges to store a bought work after the free period. Money is integer
 * pence, entered before VAT. One set applies from `effectiveFrom`; a lot keeps the set in force
 * when its sale closed.
 */
export type StorageTerms = {
  /** Days the work is stored free, counted from the London day payment cleared. */
  freeDays: number;
  dayCount: StorageDayCount;
  /** Per lot per calendar day after the free period. */
  standardDailyPence: number;
  /** The same for a large work; `null` when the large band is off and standard applies. */
  largeDailyPence: number | null;
  /** Charged once per lot when charges start; 0 for none. */
  handlingFeePence: number;
  /** The first London day the terms apply to. */
  effectiveFrom: DateKey;
};

export type StorageBand = "standard" | "large";

/** Where a lot's storage stands. */
export type StorageState = "upcoming" | "soon" | "charging" | "extended" | "waived";

/** A run of London days, inclusive, in which the clock stands still: LAX holds the work. */
export type StoragePause = { from: DateKey; to: DateKey };

/** The days of a place the rules read: when it is open, and which days are working days. */
export type StorageCalendar = Pick<CollectionCalendar, "plan" | "isWorkingDay">;

export type StorageChargeInput = {
  terms: StorageTerms;
  /** The London day payment cleared; see `storageClearedOn`. */
  clearedOn: DateKey;
  /** Calendar days staff added to the free period for this lot. */
  extensionDays: number;
  /** Finance waived the charges on this lot. */
  waived: boolean;
  /** Days LAX held the work (open check, dispute, shipping quote owed). They are not counted. */
  pausedRanges: readonly StoragePause[];
  band: StorageBand;
  /** The London day to price up to, inclusive. */
  asOf: DateKey;
  calendar: StorageCalendar;
};

export type StorageCharge = {
  /** The last free day, moved to the next open day if it fell on a closed one. */
  collectBy: DateKey;
  /** The first charged day: the day after `collectBy`. */
  chargingFrom: DateKey;
  /** Charged days from `chargingFrom` to `asOf`, paused days not counted. */
  chargeableDays: number;
  /** What is due as of `asOf`, before VAT; 0 while waived or before charges start. */
  amountPence: number;
  state: StorageState;
};

/** Furthest a day count walks, so a calendar with no working days cannot loop. */
const MAX_WALK_DAYS = 1000;

/** The London day an instant falls on: the day payment cleared, for the clock to start from. */
export function storageClearedOn(clearedAt: Date): DateKey {
  return londonDateKey(clearedAt);
}

/** The daily rate for a band; a large work pays the standard rate when the large band is off. */
export function storageDailyPence(terms: StorageTerms, band: StorageBand): number {
  return band === "large" && terms.largeDailyPence !== null
    ? terms.largeDailyPence
    : terms.standardDailyPence;
}

const isPaused = (pauses: readonly StoragePause[], day: DateKey): boolean =>
  pauses.some((pause) => pause.from <= day && day <= pause.to);

/** The day on which `count` days that `counts` have passed after `from`; `from` for none. */
function walkDays(from: DateKey, count: number, counts: (day: DateKey) => boolean): DateKey {
  let day = from;
  let remaining = count;
  for (let step = 0; remaining > 0 && step < MAX_WALK_DAYS; step++) {
    day = addDaysToKey(day, 1);
    if (counts(day)) remaining--;
  }
  return day;
}

function collectByDay(input: StorageChargeInput): DateKey {
  const { terms, clearedOn, extensionDays, pausedRanges, calendar } = input;
  const notPaused = (day: DateKey) => !isPaused(pausedRanges, day);
  const freeThrough = walkDays(clearedOn, terms.freeDays, (day) =>
    terms.dayCount === "working" ? notPaused(day) && calendar.isWorkingDay(day) : notPaused(day),
  );
  return nextOpenDay(calendar, walkDays(freeThrough, extensionDays, notPaused));
}

function stateOf(input: StorageChargeInput, collectBy: DateKey): StorageState {
  const { terms, extensionDays, asOf } = input;
  if (input.waived) return "waived";
  if (asOf > collectBy) return "charging";
  if (extensionDays > 0) return "extended";
  const { reminderLeadDays } = DEFAULT_COLLECT_BY_POLICY;
  const early = terms.freeDays > reminderLeadDays;
  return asOf >= (early ? addDaysToKey(collectBy, -reminderLeadDays) : collectBy)
    ? "soon"
    : "upcoming";
}

/**
 * Where a lot's storage stands on `asOf` and what is due. The free period counts from the London
 * day payment cleared, in calendar or working days, skipping the days LAX held the work; an
 * extension then adds calendar days; a collect-by day on a closed day moves to the next open day.
 * Charges run per calendar day from the day after that, skipping held days, plus the handling fee
 * once. Pure: it reads no clock and no store.
 */
export function calculateStorageCharge(input: StorageChargeInput): StorageCharge {
  const { terms, pausedRanges, asOf } = input;
  const collectBy = collectByDay(input);
  const chargingFrom = addDaysToKey(collectBy, 1);
  let chargeableDays = 0;
  for (let day = chargingFrom; day <= asOf && chargeableDays < MAX_WALK_DAYS * 10; ) {
    if (!isPaused(pausedRanges, day)) chargeableDays++;
    day = addDaysToKey(day, 1);
  }
  const owed =
    chargeableDays * storageDailyPence(terms, input.band) +
    (chargeableDays > 0 ? terms.handlingFeePence : 0);
  return {
    collectBy,
    chargingFrom,
    chargeableDays,
    amountPence: input.waived ? 0 : owed,
    state: stateOf(input, collectBy),
  };
}

/* ---- What a buyer reads ---------------------------------------------------------------- */

const pounds = (pence: number): string => Math.floor(pence / 100).toLocaleString("en-GB");

/** "£3" for whole pounds, "£3.50" otherwise; `fixed` always shows pence. */
function money(pence: number, fixed = false): string {
  const rest = pence % 100;
  return fixed || rest !== 0
    ? `£${pounds(pence)}.${String(rest).padStart(2, "0")}`
    : `£${pounds(pence)}`;
}

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"}`;

const dayLabel = (day: DateKey, now: Date): string =>
  formatCollectionDay(new Date(`${day}T12:00:00Z`), now);

/**
 * The terms in one sentence for the lot page, shipping page and the staff preview: the free
 * period, the rates (pence shown on both when either has them), VAT and any handling fee.
 */
export function formatStorageTerms(terms: StorageTerms): string {
  const { freeDays, dayCount, standardDailyPence, largeDailyPence, handlingFeePence } = terms;
  const free =
    freeDays === 0
      ? null
      : `Storage is free for ${plural(freeDays, dayCount === "working" ? "working day" : "day")} after your payment clears.`;
  const charged = standardDailyPence > 0 || (largeDailyPence ?? 0) > 0;
  const fixed = standardDailyPence % 100 !== 0 || (largeDailyPence ?? 0) % 100 !== 0;
  const rates = `${money(standardDailyPence, fixed)} a day for each work${
    largeDailyPence === null
      ? ""
      : `, or ${money(largeDailyPence, fixed)} for works over ${LARGE_WORK_SIDE_CM} cm on any side`
  }, plus VAT where it applies.`;
  const sentences = [
    free ?? (charged ? "Storage is charged from the day after your payment clears." : null),
    !charged
      ? free
        ? "After that, storage charges may apply."
        : "Storage charges may apply from the day after your payment clears."
      : free
        ? `After that it is ${rates}`
        : `It is ${rates}`,
    handlingFeePence > 0
      ? `A handling fee of ${money(handlingFeePence)} applies once when charges start.`
      : null,
  ];
  return sentences.filter((sentence) => sentence !== null).join(" ");
}

/** The notice a buyer sees on a lot waiting to be collected. */
export type StorageNotice = { heading: string; body: string };

export type StorageNoticeContext = {
  placeName: string;
  /** Decides whether a day carries its year. */
  now: Date;
  /** The place raises storage invoices. Off, buyers see the free period and today's wording. */
  chargingOn: boolean;
};

/** The "Please collect by" notice for one state, with the running total once charging. */
export function formatStorageNotice(
  charge: StorageCharge,
  terms: StorageTerms,
  band: StorageBand,
  context: StorageNoticeContext,
): StorageNotice {
  const { placeName, now, chargingOn } = context;
  const collectBy = dayLabel(charge.collectBy, now);
  const rate = `${money(storageDailyPence(terms, band))} a day`;
  const waiting = `Your work is paid for and waiting at ${placeName}.`;
  const pleaseCollect = `Please collect by ${collectBy}`;
  switch (charge.state) {
    case "waived":
      return {
        heading: "No storage to pay",
        body: "We have waived the storage charges on this work. Book a time to collect.",
      };
    case "extended":
      return {
        heading: `Free storage extended to ${collectBy}`,
        body: "We have held your work longer at no charge. Book a time to collect before then.",
      };
    case "charging":
      return chargingOn
        ? {
            heading: `Storage charges since ${dayLabel(charge.chargingFrom, now)}`,
            body: `${money(charge.amountPence, true)} so far (${plural(charge.chargeableDays, "day")} at ${rate}), plus VAT where it applies. Book a time to collect, and you will pay the storage up to that day when you book.`,
          }
        : {
            heading: pleaseCollect,
            body: `That day has passed, so storage charges may apply. Book a time to collect your work from ${placeName}, or email us if you need longer.`,
          };
    case "soon":
      return {
        heading: pleaseCollect,
        body: `${waiting} Book a time to collect it soon: after ${collectBy}, ${chargingOn ? `storage is ${rate}` : "storage charges may apply"}.`,
      };
    case "upcoming":
      return {
        heading: pleaseCollect,
        body: `${waiting} Storage is free until then, and ${chargingOn ? `${rate} after that, plus VAT where it applies` : "storage charges may apply after that"}.`,
      };
  }
}

/** The short badge on a purchase list: the day, and the running total once charges are due. */
export function formatStorageBadge(charge: StorageCharge, now: Date, chargingOn: boolean): string {
  const day = `Collect by ${dayLabel(charge.collectBy, now)}`;
  return chargingOn && charge.state === "charging" && charge.amountPence > 0
    ? `${day} · Storage ${money(charge.amountPence, true)} so far`
    : day;
}

export type StorageInvoiceLine = {
  lotNumber: number;
  /** First and last charged day. */
  from: DateKey;
  to: DateKey;
  days: number;
  dailyPence: number;
};

/** The storage line on an invoice. */
export function formatStorageInvoiceLine(line: StorageInvoiceLine, now: Date): string {
  return `Storage, Lot ${line.lotNumber} · ${dayLabel(line.from, now)} to ${dayLabel(line.to, now)} · ${plural(line.days, "day")} at ${money(line.dailyPence)} a day`;
}

/** What the hand-over desk shows while storage is unpaid. */
export function formatStorageDeskLine(amountPence: number): string {
  return `Storage of ${money(amountPence, true)} is due on this lot. Take payment or waive it before hand-over.`;
}
