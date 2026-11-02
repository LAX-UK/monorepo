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
