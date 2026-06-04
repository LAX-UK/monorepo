const OG_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/London",
};

/** Stable en-GB formatting for OG image cards (avoids server-locale drift). */
export function formatOgDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", OG_DATE_FORMAT).format(date);
}
