/**
 * Venue opening hours are stored as a JSON list of `{ label, hours }` rows that lax.art prints
 * as written, for example `{ "label": "Tue – Sat", "hours": "10:00 – 18:00" }` or
 * `{ "label": "Mon", "hours": "Closed" }`. The editor works per weekday and collapses runs of
 * identical days back into one row, so a venue saved here stays compact on the public page.
 */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type DayState = "unlisted" | "open" | "closed";
export type DayHours = { state: DayState; opens: string; closes: string };

/** One entry per weekday, in `WEEKDAYS` order. */
export type WeekHours = DayHours[];

/**
 * `days` is the weekday editor. `unrecognised` carries stored hours the editor cannot show
 * faithfully (free text, odd labels), which are left untouched unless staff replace them.
 */
export type OpeningHoursForm =
  | { mode: "days"; days: WeekHours }
  | { mode: "unrecognised"; stored: unknown };

export type OpeningHoursRow = { label: string; hours: string };

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DASH = /\s*[–-]\s*/;
const HOURS_RANGE = /^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/;
const DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function emptyWeek(): WeekHours {
  return WEEKDAYS.map(() => ({ state: "unlisted", opens: "", closes: "" }));
}

export function emptyOpeningHoursForm(): OpeningHoursForm {
  return { mode: "days", days: emptyWeek() };
}

function padTime(value: string): string {
  const [hours = "", minutes = ""] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function dayIndex(name: string): number {
  const prefix = name.trim().slice(0, 3).toLowerCase();
  return DAY_NAMES.indexOf(prefix);
}

/** "Mon", "Tuesday" or "Tue – Sat" to the weekday indexes it covers; null when it is not a day label. */
function daysInLabel(label: string): number[] | null {
  const parts = label.trim().split(DASH);
  if (parts.length === 0 || parts.length > 2) return null;
  const indexes = parts.map(dayIndex);
  if (indexes.some((index) => index < 0)) return null;
  const [from, to = from] = indexes as [number, number?];
  if (to < from) return null;
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
}

function parseHours(hours: string): DayHours | null {
  const text = hours.trim();
  if (/^closed$/i.test(text)) return { state: "closed", opens: "", closes: "" };
  const match = HOURS_RANGE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  if (!TIME.test(match[1]) || !TIME.test(match[2])) return null;
  return { state: "open", opens: padTime(match[1]), closes: padTime(match[2]) };
}

function rowsOf(stored: unknown): OpeningHoursRow[] | null {
  if (Array.isArray(stored)) {
    const rows: OpeningHoursRow[] = [];
    for (const row of stored) {
      if (!row || typeof row !== "object") return null;
      const { label, hours } = row as Record<string, unknown>;
      if (typeof label !== "string" || typeof hours !== "string") return null;
      rows.push({ label, hours });
    }
    return rows;
  }
  if (stored && typeof stored === "object") {
    // The map form `{ "Tue – Sat": "10:00 – 18:00" }` is also accepted by lax.art.
    const rows: OpeningHoursRow[] = [];
    for (const [label, hours] of Object.entries(stored)) {
      if (typeof hours !== "string") return null;
      rows.push({ label, hours });
    }
    return rows;
  }
  return null;
}

/** Reads stored hours into the weekday editor, or marks them unrecognised rather than guess. */
export function openingHoursFormFromStored(stored: unknown): OpeningHoursForm {
  if (stored === null || stored === undefined) return emptyOpeningHoursForm();
  const rows = rowsOf(stored);
  if (!rows) return { mode: "unrecognised", stored };
  const week = emptyWeek();
  for (const row of rows) {
    const days = daysInLabel(row.label);
    const hours = parseHours(row.hours);
    if (!days || !hours) return { mode: "unrecognised", stored };
    for (const index of days) {
      const slot = week[index];
      if (!slot || slot.state !== "unlisted") return { mode: "unrecognised", stored };
      week[index] = { ...hours };
    }
  }
  return { mode: "days", days: week };
}

function sameDay(a: DayHours, b: DayHours): boolean {
  return a.state === b.state && a.opens === b.opens && a.closes === b.closes;
}

function describeDay(day: DayHours): string {
  return day.state === "closed" ? "Closed" : `${day.opens} – ${day.closes}`;
}

/** Collapses consecutive identical days, skipping days left unlisted. */
export function weekToRows(week: WeekHours): OpeningHoursRow[] {
  const rows: OpeningHoursRow[] = [];
  let index = 0;
  while (index < WEEKDAYS.length) {
    const day = week[index];
    if (!day || day.state === "unlisted") {
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < WEEKDAYS.length) {
      const next = week[end + 1];
      if (!next || !sameDay(day, next)) break;
      end += 1;
    }
    const first = WEEKDAYS[index];
    const last = WEEKDAYS[end];
    rows.push({
      label: end === index ? `${first}` : `${first} – ${last}`,
      hours: describeDay(day),
    });
    index = end + 1;
  }
  return rows;
}

/** Per-day problems, keyed by weekday index, for days that are open without a valid time span. */
export function weekProblems(week: WeekHours): Record<number, string> {
  const problems: Record<number, string> = {};
  week.forEach((day, index) => {
    if (day.state !== "open") return;
    const label = WEEKDAYS[index];
    if (!TIME.test(day.opens) || !TIME.test(day.closes)) {
      problems[index] = `${label}: enter opening and closing times.`;
    } else if (padTime(day.opens) >= padTime(day.closes)) {
      problems[index] = `${label}: closing time must be after opening time.`;
    }
  });
  return problems;
}

/** The JSON to store: `null` when nothing is listed, the original value when it was not editable. */
export function openingHoursToStored(form: OpeningHoursForm): unknown {
  if (form.mode === "unrecognised") return form.stored;
  const rows = weekToRows(form.days);
  return rows.length > 0 ? rows : null;
}
