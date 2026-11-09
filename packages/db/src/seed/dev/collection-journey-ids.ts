/**
 * Ids, names and days the collection journeys (apps/web/e2e/org-roles-collection.spec.ts and
 * admin-collections-desk.spec.ts) share with the seed that creates their data. Plain values and
 * pure functions only, so browser tests can import this file without loading the database schema.
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

const LONDON = "Europe/London";
const DAY_MS = 86_400_000;

/** The London calendar day of an instant, as "2026-11-10". */
export function londonDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

const dayParts = (day: string) => {
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

/** The instant a London wall clock reads `hhmm` on `day`, across the clock changes. */
export function londonInstant(day: string, hhmm: string): Date {
  const { year, month, date } = dayParts(day);
  const [hours, minutes] = hhmm.split(":").map(Number) as [number, number];
  const wanted = Date.UTC(year, month - 1, date, hours, minutes);
  let guess = wanted;
  // The offset of London from UTC at the guess; twice, because the guess itself may sit across a change.
  for (let round = 0; round < 2; round += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess -= wall - wanted;
  }
  return new Date(guess);
}

export type JourneyVisit = {
  /** The London day of the visit. */
  day: string;
  start: Date;
  end: Date;
};

const visit = (day: string, hhmm: string): JourneyVisit => {
  const start = londonInstant(day, hhmm);
  return { day, start, end: new Date(start.getTime() + 30 * 60_000) };
};

/**
 * When each seeded visit is, counted in working days from the day the seed runs (or the journey,
 * which must run the same day). Visits to come are at least two working days away, so the buyer
 * can still change or cancel them; the others are in the past.
 */
export function collectionJourneyVisits(now: Date) {
  const today = londonDay(now);
  return {
    toChange: visit(workday(today, 4), "14:00"),
    toCancel: visit(workday(today, 5), "14:00"),
    toHandOver: visit(workday(today, 2), "11:00"),
    unreleased: visit(workday(today, 2), "11:30"),
    noShow: visit(workday(today, -1), "14:00"),
    missed: visit(workday(today, -2), "15:00"),
    collected: visit(workday(today, -1), "11:00"),
    partlyCollected: visit(workday(today, -3), "12:00"),
    cancelled: visit(workday(today, 6), "16:00"),
  } as const;
}
