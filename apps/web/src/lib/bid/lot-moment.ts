/** Sale times are UK times, wherever the page is drawn. */
const ZONE = "Europe/London";

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  day: "numeric",
  month: "short",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

function dayOffset(date: Date, now: Date): number {
  const a = Date.parse(DAY_KEY.format(date));
  const b = Date.parse(DAY_KEY.format(now));
  return Math.round((a - b) / 86_400_000);
}

/**
 * A lot's moment in a list, in UK time and as short as it can be read: "Today 18:12",
 * "Tomorrow 14:00", "19 Nov 14:00", or "19 Nov" without the time; the year only when it is not
 * this year's.
 */
export function formatLotMoment(date: Date, now: Date, options: { time?: boolean } = {}): string {
  const withTime = options.time ?? true;
  const offset = dayOffset(date, now);
  const time = withTime ? ` ${TIME.format(date)}` : "";
  if (offset === 0) return `Today${time}`;
  if (offset === 1) return `Tomorrow${time}`;
  if (offset === -1) return `Yesterday${time}`;
  const sameYear = DAY_KEY.format(date).slice(0, 4) === DAY_KEY.format(now).slice(0, 4);
  return `${(sameYear ? DAY_MONTH : DAY_MONTH_YEAR).format(date)}${time}`;
}
