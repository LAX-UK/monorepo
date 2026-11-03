/** Every product sends its digest at this hour, London time. */
export const DIGEST_HOUR_LONDON = 8;
export const DIGEST_TIME_ZONE = "Europe/London";

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: DIGEST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function londonParts(now: Date): { date: string; hour: number } {
  const get = (type: string) => partsFormat.formatToParts(now).find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

/**
 * The London calendar day an instant falls on, as `YYYY-MM-DD`. A digest is unique per person,
 * product and this date, so the cap holds across midnight and across both clock changes: the
 * zone, not a fixed offset, decides where a day begins.
 */
export function digestDateFor(now: Date): string {
  return londonParts(now).date;
}

/** Whether London time has reached the digest hour today. */
export function isDigestDue(now: Date): boolean {
  return londonParts(now).hour >= DIGEST_HOUR_LONDON;
}
