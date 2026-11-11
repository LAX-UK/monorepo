const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

/** "23 October 2026 at 14:05 BST": the time as a person in London would read it, with the zone named. */
export function formatLondonTime(at: Date): string {
  return `${DATE.format(at)} at ${TIME.format(at)}`;
}

/** "22 November 2026": the calendar day in London, for dates that are not a moment. */
export function formatLondonDate(at: Date): string {
  return DATE.format(at);
}

const LONDON = "Europe/London";

type ZoneFormats = { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat };
const formatsByZone = new Map<string, ZoneFormats>();

function formatsFor(zone: string): ZoneFormats {
  let formats = formatsByZone.get(zone);
  if (!formats) {
    formats = {
      date: new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      }),
    };
    formatsByZone.set(zone, formats);
  }
  return formats;
}

/**
 * "24 October 2026 at 01:05 GMT+11": the time as the person's own clock reads it, with the zone
 * named. A personal event is shown on the person's clock only: their saved Account zone, or
 * London when they have none.
 */
export function formatNoticeTime(at: Date, savedZone: string | null): string {
  const { date, time } = formatsFor(savedZone ?? LONDON);
  return `${date.format(at)} at ${time.format(at)}`;
}
