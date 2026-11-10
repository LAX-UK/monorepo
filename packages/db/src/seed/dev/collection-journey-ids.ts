/**
 * Ids, names and days the collection journeys (apps/web/e2e/org-roles-collection.spec.ts and
 * admin-collections-desk.spec.ts) share with the seed that creates their data. Plain values and
 * pure functions only, with no imports, so browser tests can load this file without building any
 * package. Where a visit falls in London time is in collection-journey-visits.ts, for the seed.
 */
export const COLLECTION_JOURNEY_IDS = {
  venue: "c0110001-0000-4000-8000-000000000001",
  sale: "c0110002-0000-4000-8000-000000000002",
  /** A lot nothing is booked for: the buyer books it. */
  lotToBook: "c0110101-0000-4000-8000-000000000101",
  /** In a booked visit the buyer moves to another time. */
  lotToChange: "c0110102-0000-4000-8000-000000000102",
  /** In a booked visit the buyer cancels. */
  lotToCancel: "c0110103-0000-4000-8000-000000000103",
  /** In a booked visit staff hand over. */
  lotToHandOver: "c0110104-0000-4000-8000-000000000104",
  /** In a booked visit, but not released yet: staff must release it first. */
  lotUnreleased: "c0110105-0000-4000-8000-000000000105",
  /** In a booked visit whose time has passed: staff mark it not collected. */
  lotNoShow: "c0110106-0000-4000-8000-000000000106",
  /** In a visit already marked not collected: staff rebook it. */
  lotMissed: "c0110107-0000-4000-8000-000000000107",
  /** Handed over at an earlier visit. */
  lotCollected: "c0110108-0000-4000-8000-000000000108",
  /** One of two lots of a visit where only this one was taken. */
  lotPartlyTaken: "c0110109-0000-4000-8000-000000000109",
  /** The other lot of that visit: left behind, still with us. */
  lotPartlyLeft: "c0110110-0000-4000-8000-000000000110",
  /** In a visit that was cancelled. */
  lotCancelled: "c0110111-0000-4000-8000-000000000111",
} as const;

/** The references staff quote at the desk, fixed so the journeys can find each visit. */
export const COLLECTION_JOURNEY_REFERENCES = {
  toChange: "COL-9102",
  toCancel: "COL-9103",
  toHandOver: "COL-9104",
  unreleased: "COL-9105",
  noShow: "COL-9106",
  missed: "COL-9107",
  collected: "COL-9108",
  partlyCollected: "COL-9109",
  cancelled: "COL-9110",
} as const;

export const COLLECTION_JOURNEY_NAMES = {
  venue: "Collections journeys gallery",
  /** The organisation that bought the lots, and whose owner books and collects. */
  buyer: "Northbank Gallery",
  /** Who comes to collect, as the desk records it. */
  collector: "Estate Owner",
  lots: {
    toBook: "Collection journey: to book",
    toChange: "Collection journey: to change",
    toCancel: "Collection journey: to cancel",
    toHandOver: "Collection journey: to hand over",
    unreleased: "Collection journey: not released",
    noShow: "Collection journey: did not come",
    missed: "Collection journey: missed visit",
    collected: "Collection journey: collected",
    partlyTaken: "Collection journey: partly taken",
    partlyLeft: "Collection journey: left behind",
    cancelled: "Collection journey: cancelled visit",
  },
} as const;

const DAY_MS = 86_400_000;

/** The year, month and day number of a "YYYY-MM-DD" key. */
export const dayParts = (day: string) => {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return { year, month, date };
};

/** A day key moved by whole days. */
export function addDays(day: string, days: number): string {
  const { year, month, date } = dayParts(day);
  return new Date(Date.UTC(year, month - 1, date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 1 for Monday to 7 for Sunday. */
export function isoWeekday(day: string): number {
  const { year, month, date } = dayParts(day);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay() || 7;
}

/** The working day (Monday to Friday) that many working days from `day`; 0 is `day` or the next one. */
export function workday(day: string, offset: number): string {
  const step = offset < 0 ? -1 : 1;
  let current = day;
  let remaining = Math.abs(offset);
  while (isoWeekday(current) > 5) current = addDays(current, step);
  while (remaining > 0) {
    current = addDays(current, step);
    if (isoWeekday(current) <= 5) remaining -= 1;
  }
  return current;
}
