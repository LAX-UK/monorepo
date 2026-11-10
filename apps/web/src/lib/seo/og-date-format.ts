import { LONDON_TIME_ZONE, formatLongMoment } from "@auction/datetime";

/** "18 June 2026 at 15:30" for OG image cards, in London time whatever the server's locale. */
export function formatOgDateTime(date: Date): string {
  return formatLongMoment(date, LONDON_TIME_ZONE);
}
