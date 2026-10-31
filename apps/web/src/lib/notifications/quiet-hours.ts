/**
 * Quiet hours as a person reads them: 24-hour local times, kept with their IANA time zone, so the
 * times they chose are the times that apply, through every clock change.
 */

/** Every half hour of the day, for the time pickers: "00:00" … "23:30". */
export const QUIET_HOUR_OPTIONS: readonly string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

/** "London time (GMT)" or "London time (BST)", for the hint. */
export function quietHoursZoneLabel(timeZone: string, on = new Date()): string {
  let name = "";
  try {
    name =
      new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
        .formatToParts(on)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    name = "";
  }
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return name ? `${city} time (${name})` : `${city} time`;
}
