import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import { parseCollectionReference } from "./collection-reference.js";

/**
 * The calendar file (RFC 5545) attached to booking emails and offered as "Add to calendar".
 * One stable UID per booking and a rising SEQUENCE, so a change updates the same calendar entry
 * and a cancellation removes it. Times are London wall-clock times under a VTIMEZONE, so every
 * calendar shows the right local time across the clock changes. It carries the place, the lots
 * and the ID rule, and never prices.
 */
export type CollectionCalendarMethod = "REQUEST" | "CANCEL";

export type CollectionIcsInput = {
  /** "COL-4821". */
  reference: string;
  /** Starts at 0 and goes up by one for every change and for the cancellation. */
  sequence: number;
  method: CollectionCalendarMethod;
  start: Date;
  end: Date;
  /** When the file was made, in UTC (DTSTAMP). */
  stamp: Date;
  summary: string;
  /** The gallery's address, one line. */
  location: string;
  /** Lines of detail: the lots, who collects, the photo ID rule. Never prices. */
  description: readonly string[];
  /** Minutes before the visit the alert goes; 120 by default. Cancellations carry none. */
  alertMinutesBefore?: number | undefined;
};

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const UID_DOMAIN = "lax.bid";
const PRODID = "-//LAX//Collection booking//EN";

/** The UID of a booking's calendar entry: stable for its whole life. */
export function collectionCalendarUid(reference: string): string {
  return `${reference}@${UID_DOMAIN}`;
}

/** "collection-COL-4821.ics". */
export function collectionCalendarFilename(reference: string): string {
  return `collection-${reference}.ics`;
}

/** Escapes text values: backslash, semicolon, comma and line breaks. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line to at most 75 octets, continuing on lines that begin with a space. It
 * never splits a multi-byte character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_LINE_OCTETS - 1; // the leading space counts
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function utcStamp(instant: Date): string {
  return (
    `${pad(instant.getUTCFullYear(), 4)}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}` +
    `T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}${pad(instant.getUTCSeconds())}Z`
  );
}

const LOCAL_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function londonWallClock(instant: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    LOCAL_PARTS.formatToParts(instant).find((p) => p.type === type)?.value ?? "00";
  return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}${part("second")}`;
}

const HOUR_MS = 3_600_000;

/** An hour that happens twice when the clocks go back cannot be named by wall-clock time alone. */
function isAmbiguousLocalTime(instant: Date): boolean {
  const local = londonWallClock(instant);
  return (
    londonWallClock(new Date(instant.getTime() + HOUR_MS)) === local ||
    londonWallClock(new Date(instant.getTime() - HOUR_MS)) === local
  );
}

function dateTimeLine(name: string, instant: Date): string {
  return isAmbiguousLocalTime(instant)
    ? `${name}:${utcStamp(instant)}`
    : `${name};TZID=${BUSINESS_TIME_ZONE}:${londonWallClock(instant)}`;
}

/** Europe/London: GMT in winter, BST from the last Sunday of March to the last of October. */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${BUSINESS_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:BST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const DEFAULT_ALERT_MINUTES = 120;

/** Builds the calendar file, with CRLF line ends and folded lines. Throws on invalid input. */
export function buildCollectionIcs(input: CollectionIcsInput): string {
  if (parseCollectionReference(input.reference) === null) {
    throw new RangeError(`Not a collection reference: ${input.reference}`);
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new RangeError(`Sequence must be a whole number from 0: ${input.sequence}`);
  }
  if (!(input.end > input.start)) throw new RangeError("A visit must end after it starts");
  const cancelled = input.method === "CANCEL";
  const alert = input.alertMinutesBefore ?? DEFAULT_ALERT_MINUTES;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${input.method}`,
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${collectionCalendarUid(input.reference)}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(input.stamp)}`,
    dateTimeLine("DTSTART", input.start),
    dateTimeLine("DTEND", input.end),
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `LOCATION:${escapeIcsText(input.location)}`,
    `DESCRIPTION:${escapeIcsText(input.description.join("\n"))}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
  ];
  if (!cancelled && alert > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(input.summary)}`,
      `TRIGGER:-PT${alert}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
