import { LEGAL_ENTITIES } from "./legal-entity.js";

/**
 * How visitors reach the London Art Exchange gallery. The address comes from the company's
 * registered address; the phone and email are the ones published in its policies. Seeds and
 * pages read the gallery's details from here, never from a string of their own.
 */
const { postal } = LEGAL_ENTITIES["london-art-exchange"].registeredAddress;

const WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** When the gallery is open: the one source for every line, row and structured-data entry. */
export const GALLERY_OPENING_HOURS = {
  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  opens: "10:00",
  closes: "19:00",
} as const satisfies { dayOfWeek: readonly string[]; opens: string; closes: string };

type OpeningDays = { dayOfWeek: readonly string[]; opens: string; closes: string };

/** "Monday to Friday, 10:00 to 19:00. Closed at weekends." for a run of consecutive open days. */
export function openingHoursSentence(hours: OpeningDays): string {
  const open = WEEK.filter((day) => hours.dayOfWeek.includes(day));
  const first = open[0];
  const last = open[open.length - 1];
  const days = !first ? "Closed" : first === last ? first : `${first} to ${last}`;
  const weekend = !hours.dayOfWeek.includes("Saturday") && !hours.dayOfWeek.includes("Sunday");
  return `${days}, ${hours.opens} to ${hours.closes}.${weekend ? " Closed at weekends." : ""}`;
}

/** The same hours as venue-editor rows ("Mon – Fri", "10:00 – 19:00"), closed days named. */
export function openingHoursRows(hours: OpeningDays): { label: string; hours: string }[] {
  const short = (day: string) => day.slice(0, 3);
  const open = WEEK.filter((day) => hours.dayOfWeek.includes(day));
  const closed = WEEK.filter((day) => !hours.dayOfWeek.includes(day));
  const range = (days: readonly string[]) =>
    days.length > 1
      ? `${short(days[0] ?? "")} – ${short(days[days.length - 1] ?? "")}`
      : short(days[0] ?? "");
  return [
    ...(open.length > 0 ? [{ label: range(open), hours: `${hours.opens} – ${hours.closes}` }] : []),
    ...(closed.length > 0 ? [{ label: range(closed), hours: "Closed" }] : []),
  ];
}

export const GALLERY_CONTACT = {
  name: "LAX Marylebone",
  streetLine: postal.streetAddress,
  city: postal.addressLocality,
  postcode: postal.postalCode,
  /** "156 New Cavendish Street, London". */
  address: `${postal.streetAddress}, ${postal.addressLocality}`,
  phone: "+44 800 208 4800",
  phoneHref: "tel:+448002084800",
  email: "info@thelax.art",
  openingHours: openingHoursSentence(GALLERY_OPENING_HOURS),
  /** Venue-editor rows for the same hours. */
  openingHoursRows: openingHoursRows(GALLERY_OPENING_HOURS),
} as const;
