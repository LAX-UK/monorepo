/**
 * Quiet hours as a person reads them: 24-hour times in their own time zone. The API stores them
 * as "HH:MM" in UTC, so they are converted at the edge with the zone's offset today (a time set
 * in summer shifts by an hour in winter, as it does on the server).
 */
export const QUIET_HOURS_TIME_ZONE = "Europe/London";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes the zone is ahead of UTC on `on`. */
function offsetMinutes(timeZone: string, on: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(on);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - on.getTime()) / 60_000);
}

function shift(hhmm: string, minutes: number): string {
  const match = HHMM.exec(hhmm);
  if (!match) return "";
  const total = (((Number(match[1]) * 60 + Number(match[2]) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A stored UTC time as the person's local time; "" when not set. */
export function quietTimeToLocal(
  utc: string,
  timeZone = QUIET_HOURS_TIME_ZONE,
  on = new Date(),
): string {
  return utc ? shift(utc, offsetMinutes(timeZone, on)) : "";
}

/** A local time as the UTC time the API stores; "" when not set. */
export function quietTimeToUtc(
  local: string,
  timeZone = QUIET_HOURS_TIME_ZONE,
  on = new Date(),
): string {
  return local ? shift(local, -offsetMinutes(timeZone, on)) : "";
}

/** Every half hour of the day, for the time pickers: "00:00" … "23:30". */
export const QUIET_HOUR_OPTIONS: readonly string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

/** "London time (GMT)" or "London time (BST)", for the hint. */
export function quietHoursZoneLabel(timeZone = QUIET_HOURS_TIME_ZONE, on = new Date()): string {
  const name =
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
      .formatToParts(on)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return name ? `${city} time (${name})` : `${city} time`;
}
